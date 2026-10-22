// Audiobook Editions: one narrator's reading, or the Full Cast, of a book. LazyLibrarian keeps one audiobook per book
// and knows no narrators, so Arrmy finds these itself: a Prowlarr search, qBittorrent, then hard links into the folder
// Audiobookshelf watches (no extra space, and the torrent keeps seeding).
import { createHash } from 'node:crypto'
import { link, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { searchAudiobookBay } from './abb'
import { arr } from './arr'
import { commonDir, editionCandidates, editionOf, packFiles, safeName, searchText, seriesOf, titleVariants, type EditionSearch, type Release } from './bookrules'
import { abs, owned, scanLibrary } from './books'
import { getSetting, markAvailable, setSetting, type RequestRow } from './db'
import { tellDiscord } from './notify'
import type { Torrent } from './problems'
import { deleteTorrents, qbit, torrentFiles } from './qbit'
import type { Status } from './status'

const AUDIOBOOKS_ROOT = '/data/media/audiobooks' // Audiobookshelf's /audiobooks
const OPENLIBRARY_URL = process.env.OPENLIBRARY_URL ?? 'https://openlibrary.org'
export const EDITIONS_CATEGORY = 'editions'
const SEARCH_EVERY = 6 * 3_600_000

/** What Arrmy keeps per Edition id. `series` is OpenLibrary's name for it (null: it has none). `folder` (Author/Title (Edition), under AUDIOBOOKS_ROOT) is set once it's filed. */
type Edition = { title: string; author: string; series?: string | null; folder?: string; searchedAt?: number; search?: EditionSearch }

// shortcut: kept in one settings row, read and rewritten whole; fine for a family's few dozen Editions.
const editions = () => getSetting<Record<string, Edition>>('editions') ?? {}
function update(id: string, change: Partial<Edition> | undefined) {
  const all = editions()
  if (change) all[id] = { ...all[id], ...change }
  else delete all[id]
  setSetting('editions', all)
}

/** The qBittorrent tag that marks an Edition's torrent. */
const tagOf = (id: string) => `edition-${createHash('sha1').update(id).digest('hex').slice(0, 12)}`
export const editionForTags = (tags: string) => Object.keys(editions()).find((id) => tags.split(', ').includes(tagOf(id)))

const editionTorrents = async (): Promise<Torrent[]> => (await qbit(`/torrents/info?category=${EDITIONS_CATEGORY}`)).json()
const torrentOf = (list: Torrent[], id: string) => list.find((t) => t.tags.split(', ').includes(tagOf(id)))

/** A work's title, first author, series and cover from OpenLibrary, the same source as the search. */
async function openLibraryWork(bookId: string) {
  const get = async <T>(p: string): Promise<T> => {
    const res = await fetch(`${OPENLIBRARY_URL}${p}.json`, {
      headers: { 'User-Agent': 'Arrmy (https://github.com/Craftyplayz/Arrmy)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`OpenLibrary ${p} → ${res.status}`)
    return res.json()
  }
  const work = await get<{ title: string; authors?: { author: { key: string } }[]; covers?: number[]; series?: { series: { key: string } }[] }>(`/works/${bookId}`)
  const key = work.authors?.[0]?.author.key
  const author = key ? (await get<{ name: string }>(key).catch(() => undefined))?.name : undefined
  const seriesKey = work.series?.[0]?.series.key
  const series = seriesKey ? (await get<{ name: string }>(seriesKey).catch(() => undefined))?.name : undefined
  const cover = work.covers?.find((c) => c > 0)
  return { title: work.title, author: author ?? 'Unknown author', series, poster: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : undefined }
}

/** Remembers a new Edition and starts looking for it in the background. */
export async function addEdition(id: string) {
  const { bookId } = editionOf(id)!
  const work = await openLibraryWork(bookId)
  if (!editions()[id]) update(id, { title: work.title, author: work.author, series: work.series ?? null })
  void findEdition(id)
  return work
}

const searching = new Set<string>()

/** Searches Prowlarr and AudioBook Bay for the Edition and sends the best release to qBittorrent. Nothing found: tried again later. */
async function findEdition(id: string) {
  let e = editions()[id]
  const edition = editionOf(id)?.edition
  if (!e || !edition || searching.has(id)) return
  searching.add(id)
  try {
    if (!('series' in e)) {
      // Saved before series were kept: look it up once (a failure just means the guess from the title).
      const series = await openLibraryWork(editionOf(id)!.bookId).then((w) => w.series ?? null, () => undefined)
      if (series !== undefined) update(id, { series })
      e = editions()[id] ?? e
    }
    update(id, { searchedAt: Date.now() })
    // Indexers match words loosely: the edition's own words with each title the book goes by, the series (for packs) and the
    // title alone, with the edition checked here. Audio/Audiobook, and Audio for the indexers that file audiobooks there.
    const search = (query: string) =>
      arr<Release[]>('prowlarr', `/search?${new URLSearchParams({ query, type: 'search' })}&categories=3030&categories=3000`)
    const titles = titleVariants(e.title)
    const series = e.series ?? seriesOf(e.title)
    const queries = [...new Set([...titles.map((t) => `${t} ${edition}`), ...(series !== e.title ? [`${series} ${edition}`] : []), ...titles])]
    // AudioBook Bay isn't in Prowlarr and has narrated editions it lacks; only the queries with the edition, as each
    // result costs a page fetch. Down or changed: Prowlarr's results still count.
    const abb = (query: string) =>
      searchAudiobookBay(query).catch((err) => (console.warn(`[editions] AudioBook Bay: ${(err as Error).message}`), [] as Release[]))
    const found = await Promise.all([...queries.map(search), ...queries.filter((q) => q.endsWith(` ${edition}`)).map(abb)])
    const releases = [...new Map(found.flat().map((r) => [r.downloadUrl ?? r.magnetUrl ?? r.title, r])).values()]
    const candidates = editionCandidates(releases, titles, edition, series)
    const summary: EditionSearch = {
      at: Date.now(),
      found: releases.filter((r) => r.protocol === 'torrent').length,
      singles: candidates.filter((c) => c.kind !== 'pack').length,
      seeded: candidates.filter((c) => c.kind === 'single').length,
      packs: candidates.filter((c) => c.kind === 'pack').length,
    }
    for (const { release, kind } of candidates) {
      if (kind === 'pack' ? !(await grabPack(release, tagOf(id), titles).catch(() => false)) : !(await grab(release, tagOf(id)).then(() => true, () => false))) continue
      summary.grabbed =
        kind === 'single'
          ? `Grabbed ${release.title}.`
          : kind === 'pack'
            ? `Grabbed ${release.title}, downloading only this book's files.`
            : `Grabbed ${release.title}, which has no seeders yet: waiting for one.`
      update(id, { search: summary })
      return console.log(`[editions] ${e.title} (${edition}): ${summary.grabbed}`)
    }
    update(id, { search: summary })
    console.log(`[editions] ${e.title} (${edition}): nothing found yet. ${searchText(summary, edition)}`)
  } catch (err) {
    console.warn(`[editions] ${e.title} (${edition}): ${(err as Error).message}`)
  } finally {
    searching.delete(id)
  }
}

/**
 * Sends a release to qBittorrent with the Edition's tag. Arrmy fetches the .torrent itself, as Radarr does: qBittorrent
 * sits behind the VPN and can't reach Prowlarr's links.
 */
async function grab(r: Release, tag: string) {
  const form = new FormData()
  if (r.magnetUrl) form.append('urls', r.magnetUrl)
  else {
    let res = await fetch(r.downloadUrl!, { redirect: 'manual', cache: 'no-store' })
    const to = res.headers.get('location')
    if (to?.startsWith('magnet:')) form.append('urls', to)
    else {
      if (to) res = await fetch(to, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Prowlarr download → ${res.status}`)
      form.append('torrents', await res.blob(), 'release.torrent')
    }
  }
  await qbit('/torrents/createCategory', new URLSearchParams({ category: EDITIONS_CATEGORY })).catch(() => {}) // 409: already there
  form.append('category', EDITIONS_CATEGORY)
  form.append('tags', tag)
  const reply = await (await qbit('/torrents/add', form)).text()
  if (reply.trim() === 'Fails.') throw new Error('qBittorrent refused the release')
}

/** What the last search for an Edition found, in words, for the Request Log and Stuck. */
export const editionSearch = (id: string) => {
  const s = editions()[id]?.search
  return s ? searchText(s, editionOf(id)!.edition) : undefined
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Sends a series pack to qBittorrent and keeps only this book's files: once the file list is known (a magnet needs its
 * metadata first), every other file is set to "do not download". false if none of the files is this book: the pack is
 * deleted and the next candidate is tried. shortcut: a few seconds of the other files can download before they are skipped.
 */
async function grabPack(r: Release, tag: string, titles: string[]) {
  await grab(r, tag)
  for (let i = 0; i < 45; i++) {
    const t: Torrent | undefined = (await (await qbit(`/torrents/info?tag=${tag}`)).json())[0]
    const files = t && (await torrentFiles(t.hash).catch(() => []))
    if (t && files?.length) {
      const wanted = packFiles(files, titles)
      if (!wanted.length) {
        await deleteTorrents([t.hash])
        return false
      }
      const skip = files.flatMap((f, n) => (wanted.includes(f) ? [] : [n]))
      if (skip.length) await qbit('/torrents/filePrio', new URLSearchParams({ hash: t.hash, id: skip.join('|'), priority: '0' }))
      return true
    }
    await pause(2_000)
  }
  const stuck: Torrent | undefined = (await (await qbit(`/torrents/info?tag=${tag}`)).json())[0]
  if (stuck) await deleteTorrents([stuck.hash]) // never got its file list: another pack may
  return false
}

/** Hard-links a finished torrent into Author/Title (Edition), without its own top folder, and has Audiobookshelf scan. */
async function file(id: string, e: Edition, t: Torrent) {
  const folder = `${safeName(e.author)}/${safeName(`${e.title} (${editionOf(id)!.edition})`)}`
  const dir = path.join(AUDIOBOOKS_ROOT, folder)
  const files = (await torrentFiles(t.hash)).filter((f) => (f.priority ?? 1) > 0) // a pack's other books are skipped
  const shared = commonDir(files.map((f) => f.name))
  for (const f of files) {
    const dest = path.join(dir, f.name.slice(shared.length))
    if (path.relative(dir, dest).startsWith('..')) continue
    await mkdir(path.dirname(dest), { recursive: true })
    await link(path.join(t.save_path, f.name), dest).catch((err) => {
      if (err.code !== 'EEXIST') throw err
    })
  }
  update(id, { folder })
  await scanLibrary()
  console.log(`[editions] filed ${folder}`)
}

/** Live status per Edition id, same order. */
export async function editionStatuses(ids: string[]): Promise<Status[]> {
  const list = ids.length ? await editionTorrents() : []
  return ids.map((id) => {
    if (editions()[id]?.folder) return { label: 'Available' }
    const t = torrentOf(list, id)
    return t ? { label: 'Downloading', progress: Math.floor(t.progress * 100) } : { label: 'Requested' }
  })
}

/** Run every 2 minutes with the Edition Requests still waiting: files finished downloads, searches again for missing ones. */
export async function watchEditions(waiting: RequestRow[]) {
  if (!waiting.length) return
  const list = await editionTorrents()
  for (const id of new Set(waiting.map((r) => String(r.external_id)))) {
    const e = editions()[id]
    if (!e) continue
    const t = torrentOf(list, id)
    if (!e.folder && t && (t.progress >= 1 || t.completion_on > 0)) await file(id, e, t)
    else if (!e.folder && !t && (!e.search || Date.now() - (e.searchedAt ?? 0) > SEARCH_EVERY)) void findEdition(id)
    if (!editions()[id]?.folder) continue
    for (const r of waiting.filter((r) => String(r.external_id) === id)) {
      markAvailable(r.id)
      tellDiscord(r)
    }
  }
}

/** Deletes the Edition's torrent and, once filed, its folder in Audiobookshelf. Its folder is always one Arrmy made. */
export async function removeEdition(id: string) {
  const e = editions()[id]
  const t = torrentOf(await editionTorrents(), id)
  if (t) await deleteTorrents([t.hash])
  if (e?.folder) {
    const item = (await owned(e.title)).find((i) => i.path === `/audiobooks/${e.folder}`)
    if (item) await abs(`/items/${item.id}?hard=1`, 'DELETE')
    else {
      // shortcut: Audiobookshelf hasn't listed it (or has no API key); it marks the item missing until "Remove missing".
      await rm(path.join(AUDIOBOOKS_ROOT, e.folder), { recursive: true, force: true })
      await scanLibrary()
    }
  }
  update(id, undefined)
}
