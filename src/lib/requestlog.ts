// The Request Log's follow-ups. Radarr and Sonarr report grabs and imports through the webhook (api/hooks/arr); this
// watch adds what happens in between and after: the download finishing (with its speeds), a copy of each .torrent so
// its link outlives the torrent, and the moment the title shows up in Plex. Movies are searched by Arrmy itself, so
// every release and why it was turned down is logged; audiobooks are followed through LazyLibrarian's history.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { arr, posterOf, queueOf, type Media } from './arr'
import { editionOf, sameBook, type LLBook } from './bookrules'
import { ll, owned } from './books'
import { addLog, getSetting, logItem, recentLog, requestsFor, waitingOfType } from './db'
import { announce } from './discord'
import { embed } from './embeds'
import { whyNothing, type Grabbed, type Imported, type IndexerHealth, type Note, type Release, type Searched } from './logrules'
import { plex, PLEX_URL } from './plex'
import { qbit, torrents } from './qbit'

type RadarrRelease = {
  guid: string
  indexerId: number
  indexer: string
  title: string
  size: number
  seeders?: number
  quality?: { quality?: { name: string } }
  customFormatScore?: number
  approved: boolean
  downloadAllowed?: boolean
  rejections?: (string | { reason: string })[]
}
type ProwlarrQuery = { indexerId: number; date: string; successful: boolean; eventType: string; data?: { elapsedTime?: string; queryResults?: string; source?: string } }

/** How each indexer answered the searches `app` made since `since` (ms), from Prowlarr's history. */
async function indexerHealth(app: string, since: number): Promise<IndexerHealth[]> {
  const [history, indexers] = await Promise.all([
    arr<{ records: ProwlarrQuery[] }>('prowlarr', '/history?pageSize=200&sortKey=date&sortDirection=descending'),
    arr<{ id: number; name: string }[]>('prowlarr', '/indexer'),
  ])
  const names = new Map(indexers.map((i) => [i.id, i.name]))
  const byIndexer = new Map<number, IndexerHealth>()
  // Prowlarr's dates are to the second; one indexer can run several queries (pages, title variants).
  for (const q of history.records.filter((q) => q.eventType === 'indexerQuery' && q.data?.source === app && Date.parse(q.date) >= since - 1000)) {
    const h = byIndexer.get(q.indexerId) ?? { name: names.get(q.indexerId) ?? `Indexer ${q.indexerId}`, ms: 0, results: 0, ok: true }
    byIndexer.set(q.indexerId, {
      ...h,
      ms: Math.max(h.ms, Number(q.data?.elapsedTime ?? 0)),
      results: h.results + Number(q.data?.queryResults ?? 0),
      ok: h.ok && q.successful,
    })
  }
  return [...byIndexer.values()].sort((a, b) => Number(a.ok) - Number(b.ok) || b.results - a.results)
}

/**
 * Searches for a movie the way Radarr would, but in the open: Radarr lists every release (best first) with why it
 * would turn each down, Arrmy logs them all and grabs the first acceptable one, which is Radarr's own pick. Nothing
 * acceptable goes to #problems. If the search itself fails, Radarr searches by itself instead.
 */
export async function searchMovie(movieId: number, note?: Note) {
  const movie = await arr<Media & { tmdbId: number; isAvailable: boolean }>('radarr', `/movie/${movieId}`)
  const item = logItem('movie', movie.tmdbId)
  if (note) addLog(item, 'note', note)
  const started = Date.now()
  let found: RadarrRelease[]
  try {
    found = await arr<RadarrRelease[]>('radarr', `/release?movieId=${movieId}`)
  } catch (e) {
    addLog(item, 'searched', { releases: [], indexers: [], error: (e as Error).message } satisfies Searched)
    await arr('radarr', '/command', 'POST', { name: 'MoviesSearch', movieIds: [movieId] })
    return
  }
  const pick = found.find((r) => r.approved && r.downloadAllowed !== false)
  const releases: Release[] = found.slice(0, 100).map((r) => ({
    title: r.title,
    indexer: r.indexer.replace(/ \(Prowlarr\)$/, ''),
    size: r.size,
    seeders: r.seeders,
    quality: r.quality?.quality?.name,
    score: r.customFormatScore,
    rejections: r === pick ? [] : (r.rejections ?? []).map((x) => (typeof x === 'string' ? x : x.reason)),
  }))
  const indexers = await indexerHealth('Radarr', started).catch((e) => {
    console.warn(`[log] indexer health: ${(e as Error).message}`)
    return []
  })
  addLog(item, 'searched', { releases, indexers, picked: pick?.title } satisfies Searched)
  if (pick) await arr('radarr', '/release', 'POST', { guid: pick.guid, indexerId: pick.indexerId })
  else if (movie.isAvailable)
    announce(
      'problems',
      embed({
        colour: 'danger',
        app: 'Radarr',
        title: `${movie.title}${movie.year ? ` (${movie.year})` : ''}`,
        art: posterOf(movie),
        description: `Nothing to grab. ${whyNothing(releases)} Radarr keeps watching for new releases.`,
      }),
    )
}

/** Where .torrent copies live: next to Arrmy's database, in the config folder that's backed up. */
export const torrentFile = (hash: string) => join(dirname(process.env.DB_PATH ?? '/config/arrmy.db'), 'torrents', `${hash.toLowerCase()}.torrent`)

async function saveTorrent(hash: string) {
  const file = torrentFile(hash)
  if (existsSync(file)) return
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, Buffer.from(await (await qbit(`/torrents/export?hash=${hash}`)).arrayBuffer()))
}

const peaks = new Map<string, { seeds: number; peers: number }>() // most seeders and peers seen, per download

/** Grabs still downloading: keep their .torrent, note their peak seeders and peers, and log when they finish. */
async function followDownloads() {
  const ended = new Set([...recentLog('downloaded', 14), ...recentLog('dead', 14)].map((e) => JSON.parse(e.detail).downloadId))
  const open = recentLog('grabbed', 14).filter((e) => !ended.has(JSON.parse(e.detail).downloadId))
  if (!open.length) return
  const live = new Map((await torrents()).map((t) => [t.hash.toLowerCase(), t]))
  for (const e of open) {
    const g = JSON.parse(e.detail) as Grabbed
    const t = live.get(g.downloadId)
    if (!t) continue // not in qBittorrent yet, or removed
    await saveTorrent(g.downloadId).catch((err) => console.warn(`[log] .torrent of ${t.name}: ${(err as Error).message}`))
    const peak = peaks.get(g.downloadId) ?? { seeds: 0, peers: 0 }
    peaks.set(g.downloadId, { seeds: Math.max(peak.seeds, t.num_seeds), peers: Math.max(peak.peers, t.num_leechs) })
    // completion_on survives a restart's recheck, when progress can briefly read under 100%.
    if (t.progress < 1 && !(t.completion_on > 0)) continue
    const finished = t.completion_on > 0 ? t.completion_on : Date.now() / 1000
    addLog(e.item, 'downloaded', { downloadId: g.downloadId, seconds: Math.round(finished - t.added_on), size: t.size, ...peaks.get(g.downloadId), seasons: g.seasons })
    peaks.delete(g.downloadId)
  }
}

/** A row of LazyLibrarian's history: one release of one book. NZBprov is the Prowlarr feed it came from. */
type LLDownload = { BookID: string; AuxInfo?: string; DownloadID?: string; Status?: string; NZBtitle?: string; NZBprov?: string; NZBsize?: string; DLResult?: string }

/**
 * Audiobooks, from LazyLibrarian's history (it has no webhook): each release it grabbed, why one failed, when it was
 * filed (Seeding or Processed), then when Audiobookshelf lists the book.
 */
async function followBooks() {
  const books = (kind: 'grabbed' | 'imported', days: number) => recentLog(kind, days).filter((e) => e.item.startsWith('audiobook:'))
  const imported = books('imported', 30)
  const shown = new Set(recentLog('playable', 30).map((e) => e.item))
  const filed = new Set(imported.map((e) => JSON.parse(e.detail).downloadId))
  // Waiting Requests, and grabs not yet filed (the Request can turn Available before this sees it filed).
  const following = new Set([
    ...waitingOfType('audiobook').filter((r) => !editionOf(r.external_id)).map((r) => `audiobook:${r.external_id}`),
    ...books('grabbed', 14).filter((e) => !filed.has(JSON.parse(e.detail).downloadId)).map((e) => e.item),
  ])
  const landing = new Set(imported.filter((e) => !shown.has(e.item)).map((e) => e.item))
  if (!following.size && !landing.size) return

  const history = await ll<LLDownload[]>('getHistory')
  const grabbed = new Set(books('grabbed', 30).map((e) => JSON.parse(e.detail).downloadId))
  const dead = new Set(recentLog('dead', 30).map((e) => JSON.parse(e.detail).downloadId))
  const indexers = new Map((await arr<{ id: number; name: string }[]>('prowlarr', '/indexer').catch(() => [])).map((i) => [i.id, i.name]))
  for (const h of history) {
    const item = `audiobook:${h.BookID}`
    if (h.AuxInfo !== 'AudioBook' || !h.DownloadID || !following.has(item)) continue
    const downloadId = h.DownloadID.toLowerCase()
    if (!grabbed.has(downloadId)) {
      const feed = Number(h.NZBprov?.match(/\/(\d+)\/api$/)?.[1])
      const mb = Number(h.NZBsize)
      addLog(item, 'grabbed', { downloadId, release: h.NZBtitle, indexer: indexers.get(feed) ?? h.NZBprov, size: mb ? mb * 1024 * 1024 : undefined } satisfies Grabbed)
      grabbed.add(downloadId)
    }
    if ((h.Status === 'Seeding' || h.Status === 'Processed') && !filed.has(downloadId)) {
      addLog(item, 'imported', { downloadId, file: h.DLResult ? basename(h.DLResult) : undefined } satisfies Imported)
      filed.add(downloadId)
      landing.add(item)
    }
    if ((h.Status === 'Failed' || h.Status === 'Aborted') && !dead.has(downloadId) && !filed.has(downloadId)) {
      addLog(item, 'dead', { downloadId, reason: h.DLResult || `LazyLibrarian marked it ${h.Status}` })
      dead.add(downloadId)
    }
  }

  // shortcut: without an Audiobookshelf API key Arrmy can't look, so a filed book counts as in Audiobookshelf.
  const all = landing.size && process.env.ABS_API_KEY ? await ll<LLBook[]>('getAllBooks') : []
  for (const item of landing) {
    const id = item.slice('audiobook:'.length)
    const request = requestsFor('audiobook', id)[0]
    const book = all.find((b) => b.BookID === id)
    const there =
      !process.env.ABS_API_KEY ||
      (!!request && !!book && (await owned(request.title)).some((i) => sameBook(i, { title: request.title, author: book.AuthorName })))
    if (there) addLog(item, 'playable', { app: 'Audiobookshelf' })
  }
}

/** A one-click Try another release, logged before it happens: the release's Downloading step ends, Searching starts again. */
export async function logRetry(service: 'radarr' | 'sonarr', queueIds: number[], by: string) {
  const logged = new Set<string>()
  for (const r of (await queueOf(service)).filter((r) => queueIds.includes(r.id) && r.downloadId)) {
    const id = r.movie?.tmdbId ?? r.series?.tvdbId
    const downloadId = r.downloadId!.toLowerCase()
    if (!id || logged.has(downloadId)) continue
    logged.add(downloadId)
    const seasons = r.seasonNumber === undefined ? undefined : [r.seasonNumber]
    addLog(logItem(service === 'radarr' ? 'movie' : 'tv', id), 'dead', { downloadId, reason: 'Try another release', by, seasons })
  }
}

/** A one-click Search again for a show's episodes, as a note in the log of every Request for those seasons. */
export async function logEpisodeSearch(episodeIds: number[], by: string) {
  const query = episodeIds.map((id) => `episodeIds=${id}`).join('&')
  const episodes = await arr<{ seasonNumber: number; series?: { tvdbId: number } }[]>('sonarr', `/episode?${query}&includeSeries=true`)
  const shows = new Map<number, Set<number>>()
  for (const e of episodes.filter((e) => e.series?.tvdbId)) shows.set(e.series!.tvdbId, (shows.get(e.series!.tvdbId) ?? new Set()).add(e.seasonNumber))
  for (const [tvdbId, seasons] of shows) addLog(logItem('tv', tvdbId), 'note', { text: 'Search again', by, seasons: [...seasons] } satisfies Note)
}

type PlexItem = { ratingKey: string; Guid?: { id: string }[] }
type Section = { key: string; type: string }

/** Imports not yet in Plex: logged as playable once Plex lists the movie, or every season of the show. */
async function followImports() {
  const token = getSetting<string>('plexToken') // kept when the Admin signs in
  if (!token) return
  const shown = new Set(recentLog('playable', 7).map((e) => `${e.item}:${JSON.parse(e.detail).seasons ?? ''}`))
  const pending = recentLog('imported', 7).filter((e) => !e.item.startsWith('audiobook:') && !shown.has(`${e.item}:${JSON.parse(e.detail).seasons ?? ''}`))
  if (!pending.length) return
  const sections = (await plex<{ MediaContainer: { Directory?: Section[] } }>(`${PLEX_URL}/library/sections`, token)).MediaContainer.Directory ?? []
  const all = async (type: string) =>
    (
      await Promise.all(
        sections
          .filter((s) => s.type === type)
          .map(async (s) => (await plex<{ MediaContainer: { Metadata?: PlexItem[] } }>(`${PLEX_URL}/library/sections/${s.key}/all?includeGuids=1`, token)).MediaContainer.Metadata ?? []),
      )
    ).flat()
  const [movies, shows] = await Promise.all([all('movie'), all('show')])
  const find = (items: PlexItem[], guid: string) => items.find((i) => i.Guid?.some((g) => g.id === guid))

  const logged = new Set<string>()
  for (const e of pending) {
    const d = JSON.parse(e.detail) as Imported
    const key = `${e.item}:${d.seasons ?? ''}`
    if (logged.has(key)) continue // one show can have several imports for the same season
    const [type, id] = e.item.split(':')
    let playable = false
    if (type === 'movie') playable = !!find(movies, `tmdb://${id}`)
    else {
      const show = find(shows, `tvdb://${id}`)
      if (show) {
        const seasons = await plex<{ MediaContainer: { Metadata?: { index: number }[] } }>(`${PLEX_URL}/library/metadata/${show.ratingKey}/children`, token)
        const have = new Set(seasons.MediaContainer.Metadata?.map((s) => s.index))
        playable = (d.seasons ?? []).every((s) => have.has(s))
      }
    }
    if (!playable) continue
    addLog(e.item, 'playable', { app: 'Plex', seasons: d.seasons })
    logged.add(key)
  }
}

export function startRequestLogWatch() {
  let running = false
  setInterval(async () => {
    if (running) return
    running = true
    for (const [name, step] of [['downloads', followDownloads], ['Plex', followImports], ['audiobooks', followBooks]] as const)
      await step().catch((e) => console.warn(`[log] ${name}: ${(e as Error).message}`))
    running = false
  }, 30_000)
}
