// The Admin view's Stuck list: every Request that hasn't started downloading or has stopped, and why.
import { metaFor, unfinished } from './admin'
import { arr, queueOf } from './arr'
import { editionOf, type LLBook } from './bookrules'
import { ll } from './books'
import { logFor, logItem, requestsFor, waitingOfType } from './db'
import { editionSearch, editionStatuses } from './editions'
import { utc, whyNothing, type Searched } from './logrules'
import { byDownload, day, movieStuck, seasonStuck, torrentStuck, type MissingEpisode, type MissingMovie, type Stuck } from './problems'
import { qbit } from './qbit'

type Indexer = { id: number; name: string; enable: boolean }
type IndexerStatus = { indexerId: number; disabledTill?: string }

/** Reads one source; a Service that's down leaves its part of the list out instead of failing the page. */
const tryRead = <T>(read: Promise<T>, fallback: T) =>
  read.catch((e) => {
    console.warn(`[stuck] ${(e as Error).message}`)
    return fallback
  })

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// Most urgent first; anything else goes last.
const ORDER = ['Stalled', 'Fetching file list', 'Error', 'Nothing found', 'Searching', 'Queued', 'Paused', 'Not released yet']
const rank = (s: Stuck) => (ORDER.includes(s.reason) ? ORDER.indexOf(s.reason) : ORDER.length)

/**
 * A wanted movie, with Arrmy's own last search (see searchMovie): Radarr doesn't count it as a search, and it says why
 * nothing was grabbed.
 */
function movieWithSearch(m: MissingMovie, now: number) {
  const last = m.tmdbId ? logFor(logItem('movie', m.tmdbId)).findLast((e) => e.kind === 'searched') : undefined
  if (!last) return movieStuck(m, now)
  const ours = new Date(utc(last.at)).toISOString()
  const stuck = movieStuck({ ...m, lastSearchTime: !m.lastSearchTime || ours > m.lastSearchTime ? ours : m.lastSearchTime }, now)
  const search = JSON.parse(last.detail) as Searched
  if (stuck.reason === 'Nothing found' && !search.error && !search.picked) stuck.detail += `. ${whyNothing(search.releases)}`
  return stuck
}

// shortcut: reads the wanted lists, queues and LazyLibrarian's whole library each time; fine for a family server.
export async function stuckRequests() {
  const [movies, episodes, movieQueue, tvQueue, list, transfer, indexers, statuses, books, snatched] = await Promise.all([
    tryRead(arr<{ records: MissingMovie[] }>('radarr', '/wanted/missing?pageSize=500&monitored=true'), { records: [] }),
    tryRead(arr<{ records: MissingEpisode[] }>('sonarr', '/wanted/missing?pageSize=1000&monitored=true&includeSeries=true'), { records: [] }),
    tryRead(queueOf('radarr'), []),
    tryRead(queueOf('sonarr'), []),
    tryRead(unfinished(), []),
    tryRead(
      qbit('/transfer/info').then((r) => r.json() as Promise<{ connection_status: string }>),
      undefined,
    ),
    tryRead(arr<Indexer[]>('prowlarr', '/indexer'), []),
    tryRead(arr<IndexerStatus[]>('prowlarr', '/indexerstatus'), []),
    tryRead(ll<LLBook[]>('getAllBooks'), []),
    tryRead(ll<{ BookID: string; AuxInfo?: string }[]>('getSnatched'), []),
  ])
  const now = Date.now()
  const offline = transfer?.connection_status === 'disconnected'
  const items: Stuck[] = []

  // In qBittorrent but not downloading. With no connection at all, stalled says nothing new: the banner covers it.
  const metas = await metaFor(list)
  const queued = new Map(
    [...byDownload(movieQueue).map((g) => ({ service: 'radarr' as const, g })), ...byDownload(tvQueue).map((g) => ({ service: 'sonarr' as const, g }))]
      .filter((d) => d.g[0].downloadId)
      .map((d) => [d.g[0].downloadId!.toLowerCase(), { service: d.service, ids: d.g.map((r) => r.id) }]),
  )
  for (const t of list) {
    const why = torrentStuck(t, now)
    if (!why || (offline && t.state === 'stalledDL')) continue
    const hash = t.hash.toLowerCase()
    const meta = metas.get(hash)
    const q = queued.get(hash)
    const book = t.category === 'books'
    // Only a torrent that can't get going is swapped: a paused or queued one is waiting on purpose.
    const swap = ['stalledDL', 'metaDL', 'forcedMetaDL', 'error'].includes(t.state) && (q || book)
    items.push({
      ...why,
      service: q?.service ?? (t.category === 'tv' ? 'sonarr' : t.category === 'movies' ? 'radarr' : 'lazylibrarian'),
      title: meta?.title ?? t.name,
      ids: q?.ids ?? [],
      hash: book ? hash : undefined,
      poster: meta?.art,
      by: meta?.by ?? [],
      fix: swap ? 'retry' : undefined,
    })
  }

  // Wanted, and nothing in the queue yet. Just after a restart Radarr and Sonarr report an empty queue for about a minute
  // while qBittorrent is still downloading for them; their wanted lists would then all read "Searching", so they wait.
  const settling = (queue: unknown[], category: string) => !queue.length && list.some((t) => t.category === category)
  const downloadingMovies = new Set(movieQueue.map((q) => q.movieId))
  for (const m of settling(movieQueue, 'movies') ? [] : movies.records.filter((m) => !downloadingMovies.has(m.id)))
    items.push({ ...movieWithSearch(m, now), by: m.tmdbId ? requestsFor('movie', m.tmdbId).map((r) => r.username) : [] })
  const downloadingEpisodes = new Set(tvQueue.map((q) => q.episodeId))
  const seasons = new Map<string, MissingEpisode[]>()
  for (const e of settling(tvQueue, 'tv') ? [] : episodes.records.filter((e) => !downloadingEpisodes.has(e.id))) {
    const key = `${e.seriesId}:${e.seasonNumber}`
    seasons.set(key, [...(seasons.get(key) ?? []), e])
  }
  for (const eps of seasons.values()) {
    const tvdbId = eps[0].series?.tvdbId
    items.push({ ...seasonStuck(eps, now), by: tvdbId ? requestsFor('tv', tvdbId).map((r) => r.username) : [] })
  }

  // Audiobooks LazyLibrarian wants and hasn't sent to qBittorrent.
  const grabbed = new Set(snatched.filter((s) => s.AuxInfo === 'AudioBook').map((s) => s.BookID))
  for (const b of books.filter((b) => (b.AudioStatus ?? b.audiostatus) === 'Wanted' && !grabbed.has(b.BookID))) {
    const requests = requestsFor('audiobook', b.BookID)
    const asked = requests[0] ? `. Requested ${day(`${requests[0].created_at.replace(' ', 'T')}Z`, now)}` : ''
    items.push({
      reason: 'Nothing found',
      detail: `No release found yet${asked}`,
      service: 'lazylibrarian',
      title: requests[0]?.title ?? b.BookName,
      ids: [],
      poster: requests[0]?.poster ?? b.BookImg,
      by: requests.map((r) => r.username),
    })
  }

  // Editions Arrmy is looking for itself (editions.ts).
  const editions = [...new Set(waitingOfType('audiobook').map((r) => String(r.external_id)))].filter((id) => editionOf(id))
  const editionStatus = await tryRead(editionStatuses(editions), [])
  for (const [i, id] of editions.entries()) {
    if (editionStatus[i]?.label !== 'Requested') continue
    const requests = requestsFor('audiobook', id)
    items.push({
      reason: 'Nothing found',
      detail: `${editionSearch(id) ?? 'No release of this edition found yet'} Searched every 6 hours. Requested ${day(`${requests[0].created_at.replace(' ', 'T')}Z`, now)}`,
      service: 'lazylibrarian',
      title: requests[0].title,
      ids: [],
      poster: requests[0].poster,
      by: requests.map((r) => r.username),
    })
  }

  // Indexers Prowlarr has switched off after repeated failures, until the time it gives.
  const names = new Map(indexers.map((i) => [i.id, i.name]))
  const off = statuses
    .filter((s) => s.disabledTill && Date.parse(s.disabledTill) > now && names.has(s.indexerId))
    .sort((a, b) => Date.parse(a.disabledTill!) - Date.parse(b.disabledTill!))
  const indexerNote = off.length
    ? `${off.length} of ${indexers.filter((i) => i.enable).length} indexers are switched off by Prowlarr after failing: ${off
        .map((s) => `${names.get(s.indexerId)} until ${time(s.disabledTill!)}`)
        .join(', ')}.`
    : undefined

  return { items: items.sort((a, b) => rank(a) - rank(b)), offline, indexerNote }
}
