// Audiobook Requests: LazyLibrarian finds and downloads them (as Radarr does movies) and files them where
// Audiobookshelf watches. Audiobookshelf, given an API key, says which books you already own and deletes removed ones.
import {
  audiobookStatus,
  coverUrl,
  isWorkId,
  editionOf,
  fromOpenLibrary,
  rankBooks,
  sameBook,
  unwantAgain,
  yearOf,
  type LLBook,
  type OpenLibraryDoc,
  type Removed,
} from './bookrules'
import { absKey } from './keys'
import { addLog, getSetting, setPoster, logItem, markAvailable, setSetting, waitingOfType, type RequestRow } from './db'
import { watchEditions } from './editions'
import { tellDiscord } from './notify'
import { deleteTorrents, liveProgress } from './qbit'
import type { Status } from './status'
import { findCover } from './covers'
import { seriesBooks, seriesTitles, type HardcoverSeries, type SearchBy } from './searchrules'
import { bookInfo, type OpenLibraryWork } from './titlerules'
import { lazyLibrarianKey, sessionSecret } from './token'

export const LAZYLIBRARIAN_URL = process.env.LAZYLIBRARIAN_URL ?? 'http://lazylibrarian:5299'
export const ABS_URL = process.env.ABS_URL ?? 'http://audiobookshelf:80'
const OPENLIBRARY_URL = process.env.OPENLIBRARY_URL ?? 'https://openlibrary.org'
const HARDCOVER_URL = process.env.HARDCOVER_URL ?? 'https://api.hardcover.app/v1/graphql'

/** A row of LazyLibrarian's wanted table (getSnatched, getHistory): one download of one book. */
type Download = { BookID: string; AuxInfo?: string; DownloadID?: string; Status?: string }

/**
 * Calls LazyLibrarian's API, giving up after `seconds` so a stuck call shows an error instead of hanging the page.
 * Some commands wrap their reply in {Success, Data}; failures can be a bare message.
 */
export async function ll<T>(cmd: string, params: Record<string, string> = {}, seconds = 20): Promise<T> {
  const query = new URLSearchParams({ apikey: lazyLibrarianKey(sessionSecret()), cmd, ...params })
  const res = await fetch(`${LAZYLIBRARIAN_URL}/api?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(seconds * 1000) })
  const text = await res.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {}
  if (body && typeof body === 'object' && 'Success' in body) {
    const reply = body as { Success: boolean; Data?: T; Error?: { Message?: string } }
    if (!reply.Success) throw new Error(`LazyLibrarian ${cmd}: ${reply.Error?.Message ?? res.status}`)
    return (reply.Data ?? body) as T // getVersion answers at the top level
  }
  if (!res.ok || (typeof body === 'string' && /^(Missing|Invalid|No search|Unable|Source)/.test(body)))
    throw new Error(`LazyLibrarian ${cmd}: ${String(body).slice(0, 200)}`)
  return body as T
}


export async function abs<T>(path: string, method = 'GET'): Promise<T> {
  const res = await fetch(`${ABS_URL}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${absKey()}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Audiobookshelf ${method} ${path.split('?')[0]} → ${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

let libraryId: string | undefined
/** `path` is as Audiobookshelf sees it: /audiobooks/Author/Title. */
type AbsItem = { id: string; addedAt: number; title: string; author?: string; path: string }
type AbsMatch = {
  libraryItem: {
    id: string
    addedAt: number
    path: string
    media?: { metadata?: { title?: string; authorName?: string; authors?: { name: string }[] } }
  }
}

/** The Audiobookshelf library that holds media/audiobooks. */
async function absLibrary() {
  if (!libraryId) {
    const { libraries } = await abs<{ libraries: { id: string; folders: { fullPath: string }[] }[] }>('/libraries')
    libraryId = libraries.find((l) => l.folders.some((f) => f.fullPath === '/audiobooks'))?.id
    if (!libraryId) throw new Error('no library uses /audiobooks')
  }
  return libraryId
}

/** Has Audiobookshelf look for new books now instead of at its next folder check. Without an API key it waits for that. */
export async function scanLibrary() {
  if (absKey()) await abs(`/libraries/${await absLibrary()}/scan`, 'POST').catch((e) => console.warn(`[books] ${(e as Error).message}`))
}

/** Audiobookshelf books matching a search. [] without an API key, or if Audiobookshelf can't be reached. */
export async function owned(q: string): Promise<AbsItem[]> {
  if (!absKey()) return []
  try {
    const found = await abs<{ book?: AbsMatch[] }>(`/libraries/${await absLibrary()}/search?${new URLSearchParams({ q, limit: '25' })}`)
    return (found.book ?? []).map(({ libraryItem: i }) => ({
      id: i.id,
      addedAt: i.addedAt,
      path: i.path,
      title: i.media?.metadata?.title ?? '',
      author: i.media?.metadata?.authorName ?? i.media?.metadata?.authors?.map((a) => a.name).join(', '),
    }))
  } catch (e) {
    console.warn(`[books] Audiobookshelf: ${(e as Error).message}`)
    return []
  }
}

/** Live status per LazyLibrarian BookID, with progress straight from qBittorrent. */
async function statusLookup() {
  const [books, snatched, live] = await Promise.all([
    ll<LLBook[]>('getAllBooks'),
    ll<Download[]>('getSnatched'),
    liveProgress().catch(() => new Map<string, { size: number; sizeleft: number }>()),
  ])
  const byId = new Map(books.map((b) => [b.BookID, b]))
  const downloads = new Map(
    snatched.filter((s) => s.AuxInfo === 'AudioBook' && s.DownloadID).map((s) => [s.BookID, live.get(s.DownloadID!.toUpperCase())]),
  )
  return (bookId: string) => audiobookStatus(byId.get(bookId), downloads.get(bookId))
}

export const audiobookStatuses = async (bookIds: string[]): Promise<(Status | null)[]> => {
  if (!bookIds.length) return []
  const status = await statusLookup()
  return bookIds.map(status)
}

/**
 * OpenLibrary's search, asked directly for its top 30: LazyLibrarian's findBook fetches every match (thousands for a
 * popular title) and can take minutes. Same source, same order, same BookIDs, so Request still goes through
 * LazyLibrarian. By series uses OpenLibrary's series field, which only some books have.
 */
export async function openLibrary(term: string, by: SearchBy = 'title'): Promise<OpenLibraryDoc[]> {
  const what: Record<string, string> = by === 'author' ? { author: term } : { q: by === 'series' ? `series:"${term.replace(/"/g, '')}"` : term }
  const query = new URLSearchParams({ ...what, limit: '30', fields: 'key,title,author_name,cover_i,first_publish_year,isbn' })
  const res = await fetch(`${OPENLIBRARY_URL}/search.json?${query}`, {
    headers: { 'User-Agent': 'Arrmy (https://github.com/Craftyplayz/Arrmy)' }, // OpenLibrary asks apps to identify themselves
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`OpenLibrary search → ${res.status}`)
  return (await res.json()).docs ?? []
}

async function hardcover<T>(query: string, variables: object): Promise<T> {
  const res = await fetch(HARDCOVER_URL, {
    method: 'POST',
    headers: {
      // Hardcover's page shows the token with "Bearer " in front; accept it pasted either way.
      Authorization: `Bearer ${process.env.HARDCOVER_TOKEN!.replace(/^Bearer\s+/i, '')}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Arrmy (https://github.com/Craftyplayz/Arrmy)',
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.errors) throw new Error(`Hardcover → ${res.status} ${JSON.stringify(body.errors ?? body.error ?? '').slice(0, 200)}`)
  return body.data as T
}

/** The best-matching series on Hardcover, its books found in OpenLibrary (for their BookIDs), in reading order. */
async function hardcoverSeries(term: string): Promise<OpenLibraryDoc[]> {
  const { search } = await hardcover<{ search: { ids: (string | number)[] } }>(
    'query ($q: String!) { search(query: $q, query_type: "Series", per_page: 1) { ids } }',
    { q: term },
  )
  const id = Number(search.ids[0])
  if (!id) return []
  // From Hardcover's guide to a series' books: one per position, most popular first, no duplicates or compilations.
  const { series } = await hardcover<{ series: HardcoverSeries[] }>(
    `query ($id: Int!) { series(where: {id: {_eq: $id}}) { name author { name } book_series(
      distinct_on: position, order_by: [{position: asc}, {book: {users_count: desc}}],
      where: {position: {_is_null: false}, compilation: {_eq: false}, book: {canonical_id: {_is_null: true}, is_partial_book: {_eq: false}}}
    ) { position book { title } } } }`,
    { id },
  )
  if (!series[0]) return []
  const { author, titles } = seriesTitles(series[0])
  const quote = (s: string) => s.replace(/"/g, '')
  // The first 12: all the page shows (searchAudiobooks), and OpenLibrary limits how fast it's asked.
  const docs = await Promise.all(titles.slice(0, 12).map((t) => openLibrary(`title:"${quote(t)}"${author ? ` author:"${quote(author)}"` : ''}`).then((d) => d[0])))
  const seen = new Set<string>()
  return docs.filter((d): d is OpenLibraryDoc => !!d && !seen.has(d.key) && !!seen.add(d.key))
}

/** By series: Hardcover's list when HARDCOVER_TOKEN is set (OpenLibrary leaves many books untagged), else OpenLibrary's series field. */
async function seriesDocs(term: string) {
  if (process.env.HARDCOVER_TOKEN)
    try {
      const docs = await hardcoverSeries(term)
      if (docs.length) return docs
    } catch (e) {
      console.warn(`[books] ${(e as Error).message}`)
    }
  return seriesBooks(await openLibrary(term, 'series'))
}

/** A book's description, author and rating from OpenLibrary (BookIDs are its work ids); undefined if it can't be reached. */
const olGet = async <T>(path: string) => {
  const res = await fetch(`${OPENLIBRARY_URL}${path}`, {
    headers: { 'User-Agent': 'Arrmy (https://github.com/Craftyplayz/Arrmy)' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`OpenLibrary ${path} → ${res.status}`)
  return (await res.json()) as T
}
/** Authors whose names match, for the suggestions when searching by author. */
export const findAuthors = async (q: string) =>
  (await olGet<{ docs: { key: string; name: string; top_work?: string }[] }>(`/search/authors.json?${new URLSearchParams({ q, limit: '8' })}`)).docs
type OpenLibraryWorkRecord =OpenLibraryWork & { authors?: { author?: { key?: string } }[] }
const authorOf = async (work: OpenLibraryWorkRecord) => {
  const key = work.authors?.[0]?.author?.key
  return key ? (await olGet<{ name?: string }>(`${key}.json`).catch(() => undefined))?.name : undefined
}

export async function lookupBook(bookId: string, edition?: string) {
  if (!isWorkId(bookId)) return
  const [work, ratings] = await Promise.all([
    olGet<OpenLibraryWorkRecord>(`/works/${bookId}.json`),
    olGet<{ summary?: { average?: number } }>(`/works/${bookId}/ratings.json`).catch(() => undefined),
  ])
  return bookInfo(bookId, work, await authorOf(work), ratings?.summary?.average, edition)
}

const triedCovers = new Set<string>() // shortcut: forgotten on restart, which is when a book without a cover gets another go

/**
 * A Request saved with OpenLibrary's cover link (its cover server often fails, and Requests made before Arrmy looked
 * elsewhere only have that) gets a cover from findCover instead, kept for good. A book with none is tried once per start.
 */
export async function betterPoster(r: RequestRow) {
  const bookId = editionOf(r.external_id)?.bookId ?? String(r.external_id)
  if (r.media_type !== 'audiobook' || (r.poster && !r.poster.includes('covers.openlibrary.org')) || triedCovers.has(bookId)) return r.poster
  triedCovers.add(bookId)
  try {
    const [work, editions] = await Promise.all([
      olGet<OpenLibraryWorkRecord>(`/works/${bookId}.json`),
      olGet<{ entries?: { isbn_13?: string[] }[] }>(`/works/${bookId}/editions.json?limit=10`).catch(() => undefined),
    ])
    const isbns = editions?.entries?.flatMap((e) => e.isbn_13 ?? []) ?? []
    const cover = await findCover({ title: r.title, author: (await authorOf(work)) ?? '' }, isbns)
    if (!cover) return r.poster
    setPoster(r.media_type, r.external_id, cover)
    return cover
  } catch (e) {
    console.warn(`[books] cover for ${bookId}: ${(e as Error).message}`)
    return r.poster
  }
}

/**
 * Best match first (see rankBooks); by author, their most popular first; by series, in order. Books already in
 * Audiobookshelf show as Available.
 */
// shortcut: by series or author, Audiobookshelf's search (by title) rarely finds the books, so only LazyLibrarian's
// statuses show; ask Audiobookshelf per book if owned audiobooks show as not Available.
export async function searchAudiobooks(term: string, by: SearchBy = 'title') {
  const [docs, status, library] = await Promise.all([
    by === 'series' ? seriesDocs(term) : openLibrary(term, by),
    // LazyLibrarian down: still show what OpenLibrary found, just without statuses.
    statusLookup().catch((e) => {
      console.warn(`[books] LazyLibrarian: ${(e as Error).message}`)
      return () => null
    }),
    owned(term),
  ])
  const isbns = new Map(docs.map((d) => [d.key.replace('/works/', ''), d.isbn?.slice(0, 30)]))
  const top = rankBooks(docs.map(fromOpenLibrary), by === 'title' ? term : '').slice(0, 12)
  const covers = await Promise.all(top.map((b) => findCover({ title: b.bookname, author: b.authorname }, isbns.get(b.bookid))))
  return top.map((b, i) => {
    const inLibrary = library.some((item) => sameBook(item, { title: b.bookname, author: b.authorname }))
    return {
      id: b.bookid,
      title: b.bookname,
      year: b.year,
      overview: `by ${b.authorname}`,
      poster: covers[i] ?? coverUrl(b.bookimg, b.bookid),
      seasons: [],
      requestedSeasons: [],
      status: inLibrary ? ({ label: 'Available' } as const) : status(b.bookid),
    }
  })
}

/** Adds the book to LazyLibrarian if it's new, wants its audiobook, and starts a search in the background. */
export async function addAudiobook(bookId: string) {
  const find = async () => (await ll<LLBook[]>('getAllBooks')).find((b) => b.BookID === bookId)
  let book = await find()
  if (!book) {
    await ll('addBook', { id: bookId, wait: '1' }, 60) // waits while LazyLibrarian looks the book up
    book = await find()
    if (!book) throw new Error(`LazyLibrarian couldn't add book ${bookId}`)
  }
  await ll('queueBook', { id: bookId, type: 'AudioBook' })
  await ll('searchBook', { id: bookId, type: 'AudioBook' })
  return { title: book.BookName, author: book.AuthorName, year: yearOf(book.BookDate), poster: coverUrl(book.BookImg, book.BookID) }
}

/**
 * Stops LazyLibrarian wanting the audiobook and deletes its torrents. If it was already filed, Audiobookshelf deletes
 * it too, but only a book that appeared after the Request was made, so nothing already in the library can match.
 * Returns a note for the person when files had to stay.
 */
export async function removeAudiobook(r: RequestRow): Promise<string | undefined> {
  const bookId = String(r.external_id)
  const [books, history] = await Promise.all([ll<LLBook[]>('getAllBooks'), ll<Download[]>('getHistory')])
  const book = books.find((b) => b.BookID === bookId)
  await ll('unqueueBook', { id: bookId, type: 'AudioBook' })
  setSetting('removedBooks', { ...getSetting<Removed>('removedBooks'), [bookId]: Date.now() }) // see unwantAgain
  await deleteTorrents(torrentsOf(history, bookId))

  if (audiobookStatus(book)?.label !== 'Available') return // nothing was filed: just cancelled
  if (!absKey()) return `${r.title} is still in Audiobookshelf. Delete it there, or set ABS_API_KEY so Arrmy can.`
  const since = Date.parse(`${r.created_at.replace(' ', 'T')}Z`)
  const item = (await owned(r.title)).find((i) => i.addedAt >= since && sameBook(i, { title: r.title, author: book!.AuthorName }))
  if (!item) return `Couldn't find the copy of ${r.title} that Arrmy downloaded in Audiobookshelf, so nothing was deleted there.`
  await abs(`/items/${item.id}?hard=1`, 'DELETE')
}

const torrentsOf = (history: Download[], bookId: string) => [
  ...new Set(history.filter((h) => h.BookID === bookId && h.AuxInfo === 'AudioBook' && h.DownloadID).map((h) => h.DownloadID!)),
]

/** Audiobook releases LazyLibrarian sent to qBittorrent: BookID per torrent hash (lowercase). getSnatched = still downloading. */
async function audiobookReleases(cmd: 'getSnatched' | 'getHistory') {
  const rows = await ll<Download[]>(cmd)
  return new Map(rows.filter((s) => s.AuxInfo === 'AudioBook' && s.DownloadID).map((s) => [s.DownloadID!.toLowerCase(), s.BookID]))
}

/**
 * Every audiobook release LazyLibrarian sent to qBittorrent, including ones it has given up on: it can mark a release
 * Failed and still leave the torrent there.
 */
export const audiobookTorrents = () => audiobookReleases('getHistory')

// Runs LazyLibrarian's postprocessor now instead of at its next scheduled run. It can take a while when a finished
// download is being copied, and the scheduled run does the same job anyway, so a timeout is fine.
const processNow = () => ll('forceProcess', {}, 120).catch((e) => console.warn(`[books] ${(e as Error).message}`))

/**
 * Drops an audiobook release that never started. LazyLibrarian has no command for "this release failed", so the
 * torrent is deleted and its postprocessor run: the first run marks the release Aborted, the next marks it Failed
 * (never grabbed again) and wants the book again. searchDroppedBooks then searches for another release.
 */
export async function dropAudiobookRelease(hash: string) {
  await deleteTorrents([hash])
  await processNow()
}

/**
 * Searches for another release of each book whose dead one was dropped. LazyLibrarian only skips a release it has
 * marked Failed (an Aborted one gets grabbed again), so this waits for that, giving up after 15 minutes.
 * Returns the hashes that are done waiting: searched, grabbed something else already, or no longer wanted.
 */
export async function searchDroppedBooks(dropped: { hash: string; bookId: string; at: string }[]) {
  const [books, history, downloads] = await Promise.all([
    ll<LLBook[]>('getAllBooks'),
    ll<Download[]>('getHistory'),
    audiobookReleases('getSnatched'),
  ])
  const status = (id: string) => {
    const b = books.find((x) => x.BookID === id)
    return b?.AudioStatus ?? b?.audiostatus
  }
  const grabbedOther = (d: (typeof dropped)[0]) => [...downloads].some(([hash, id]) => id === d.bookId && hash !== d.hash)
  const notFailed = (d: (typeof dropped)[0]) =>
    history.some((h) => h.DownloadID?.toLowerCase() === d.hash && (h.Status === 'Snatched' || h.Status === 'Aborted'))
  const minutes = (d: (typeof dropped)[0]) => (Date.now() - Date.parse(`${d.at.replace(' ', 'T')}Z`)) / 60_000
  const waiting = dropped.filter((d) => !grabbedOther(d) && notFailed(d) && minutes(d) < 15)
  if (waiting.length) await processNow() // each run moves the release on: Snatched → Aborted → Failed
  for (const d of dropped.filter((d) => !waiting.includes(d) && !grabbedOther(d) && status(d.bookId) === 'Wanted'))
    await ll('searchBook', { id: d.bookId, type: 'AudioBook' })
  return dropped.filter((d) => !waiting.includes(d)).map((d) => d.hash)
}

/**
 * A requested book Audiobookshelf already has (a copy from before Arrmy) is Available as it is: LazyLibrarian stops
 * looking for it, so it isn't downloaded twice. Only while LazyLibrarian is still searching, not once it's downloading.
 */
async function alreadyOwned(r: RequestRow, book: LLBook | undefined) {
  if ((book?.AudioStatus ?? book?.audiostatus) !== 'Wanted') return false
  if (!(await owned(r.title)).some((i) => sameBook(i, { title: r.title, author: book!.AuthorName }))) return false
  await ll('unqueueBook', { id: book!.BookID, type: 'AudioBook' })
  addLog(logItem('audiobook', book!.BookID), 'note', { text: 'Already in Audiobookshelf, so nothing to download' })
  addLog(logItem('audiobook', book!.BookID), 'playable', { app: 'Audiobookshelf' })
  return true
}

/** Stops LazyLibrarian wanting removed books it picked up again (see unwantAgain), and deletes what it grabbed. */
async function keepRemoved(books: LLBook[]) {
  const removed = getSetting<Removed>('removedBooks') ?? {}
  if (!Object.keys(removed).length) return
  const requested = new Set(waitingOfType('audiobook').map((r) => String(r.external_id)))
  const { unwant, keep } = unwantAgain(removed, books, requested)
  if (unwant.length) {
    const history = await ll<Download[]>('getHistory')
    for (const id of unwant) {
      await ll('unqueueBook', { id, type: 'AudioBook' })
      await deleteTorrents(torrentsOf(history, id))
      console.log(`[books] ${id} was removed but LazyLibrarian wanted it again: stopped`)
    }
  }
  if (Object.keys(keep).length !== Object.keys(removed).length) setSetting('removedBooks', keep)
}

/** LazyLibrarian has no webhook, so audiobook Requests are checked every 2 minutes for becoming Available. */
export function startAudiobookWatch() {
  setInterval(async () => {
    try {
      const all = waitingOfType('audiobook')
      await watchEditions(all.filter((r) => editionOf(r.external_id))).catch((e) => console.warn(`[editions] ${(e as Error).message}`))
      const waiting = all.filter((r) => !editionOf(r.external_id))
      const books = await ll<LLBook[]>('getAllBooks')
      const statuses = await audiobookStatuses(waiting.map((r) => String(r.external_id)))
      for (const [i, r] of waiting.entries()) {
        if (statuses[i]?.label !== 'Available' && !(await alreadyOwned(r, books.find((b) => b.BookID === String(r.external_id))))) continue
        markAvailable(r.id)
        tellDiscord(r)
      }
      await keepRemoved(books)
    } catch (e) {
      console.warn(`[books] ${(e as Error).message}`)
    }
  }, 2 * 60_000)
}
