// Audiobook Editions: one narrator's reading, or the Full Cast, of a book. LazyLibrarian keeps one audiobook per book
// and knows no narrators, so Arrmy finds these itself: a Prowlarr search, qBittorrent, then hard links into the folder
// Audiobookshelf watches (no extra space, and the torrent keeps seeding).
import { createHash } from 'node:crypto'
import { link, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { arr } from './arr'
import { bestEdition, editionOf, safeName, type Release } from './bookrules'
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

/** What Arrmy keeps per Edition id. `folder` (Author/Title (Edition), under AUDIOBOOKS_ROOT) is set once it's filed. */
type Edition = { title: string; author: string; folder?: string; searchedAt?: number }

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

/** A work's title, first author and cover from OpenLibrary, the same source as the search. */
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
  const work = await get<{ title: string; authors?: { author: { key: string } }[]; covers?: number[] }>(`/works/${bookId}`)
  const key = work.authors?.[0]?.author.key
  const author = key ? (await get<{ name: string }>(key).catch(() => undefined))?.name : undefined
  const cover = work.covers?.find((c) => c > 0)
  return { title: work.title, author: author ?? 'Unknown author', poster: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : undefined }
}

/** Remembers a new Edition and starts looking for it in the background. */
export async function addEdition(id: string) {
  const { bookId } = editionOf(id)!
  const work = await openLibraryWork(bookId)
  if (!editions()[id]) update(id, { title: work.title, author: work.author })
  void findEdition(id)
  return work
}

const searching = new Set<string>()

/** Searches Prowlarr for the Edition and sends the best release to qBittorrent. Nothing found: tried again later. */
async function findEdition(id: string) {
  const e = editions()[id]
  const edition = editionOf(id)?.edition
  if (!e || !edition || searching.has(id)) return
  searching.add(id)
  try {
    update(id, { searchedAt: Date.now() })
    // Indexers match words loosely: both the edition's own words and the title alone, with the edition checked here.
    // Audio/Audiobook, and Audio for the indexers that file audiobooks there.
    const search = (query: string) =>
      arr<Release[]>('prowlarr', `/search?${new URLSearchParams({ query, type: 'search' })}&categories=3030&categories=3000`)
    const releases = (await Promise.all([search(`${e.title} ${edition}`), search(e.title)])).flat()
    const pick = bestEdition(releases, e.title, edition)
    if (!pick) return console.log(`[editions] ${e.title} (${edition}): nothing found yet`)
    await grab(pick, tagOf(id))
    console.log(`[editions] ${e.title} (${edition}): grabbed ${pick.title}`)
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

/** Hard-links a finished torrent into Author/Title (Edition), without its own top folder, and has Audiobookshelf scan. */
async function file(id: string, e: Edition, t: Torrent) {
  const folder = `${safeName(e.author)}/${safeName(`${e.title} (${editionOf(id)!.edition})`)}`
  const dir = path.join(AUDIOBOOKS_ROOT, folder)
  for (const f of await torrentFiles(t.hash)) {
    const dest = path.join(dir, f.name.split('/').slice(1).join('/') || f.name)
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
    else if (!e.folder && !t && Date.now() - (e.searchedAt ?? 0) > SEARCH_EVERY) void findEdition(id)
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
