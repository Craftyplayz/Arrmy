// Audiobook Requests: LazyLibrarian finds and downloads them (as Radarr does movies) and files them where
// Audiobookshelf watches. Audiobookshelf, given an API key, says which books you already own and deletes removed ones.
import { audiobookStatus, coverUrl, rankBooks, sameBook, yearOf, type LLBook } from './bookrules'
import { markAvailable, waitingOfType, type RequestRow } from './db'
import { tellDiscord } from './notify'
import { deleteTorrents, liveProgress } from './qbit'
import type { Status } from './status'
import { lazyLibrarianKey, sessionSecret } from './token'

export const LAZYLIBRARIAN_URL = process.env.LAZYLIBRARIAN_URL ?? 'http://lazylibrarian:5299'
const ABS_URL = process.env.ABS_URL ?? 'http://audiobookshelf:80'

/** A row of LazyLibrarian's wanted table (getSnatched, getHistory): one download of one book. */
type Download = { BookID: string; AuxInfo?: string; DownloadID?: string }
type Found = { bookid: string; bookname: string; authorname: string; bookimg?: string; bookdate?: string; highest_fuzz?: number }

/** Calls LazyLibrarian's API. Some commands wrap their reply in {Success, Data}; failures can be a bare message. */
async function ll<T>(cmd: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ apikey: lazyLibrarianKey(sessionSecret()), cmd, ...params })
  const res = await fetch(`${LAZYLIBRARIAN_URL}/api?${query}`, { cache: 'no-store' })
  const text = await res.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {}
  if (body && typeof body === 'object' && 'Success' in body) {
    const reply = body as { Success: boolean; Data?: T; Error?: { Message?: string } }
    if (!reply.Success) throw new Error(`LazyLibrarian ${cmd}: ${reply.Error?.Message ?? res.status}`)
    return reply.Data as T
  }
  if (!res.ok || (typeof body === 'string' && /^(Missing|Invalid|No search|Unable|Source)/.test(body)))
    throw new Error(`LazyLibrarian ${cmd}: ${String(body).slice(0, 200)}`)
  return body as T
}

const absKey = () => process.env.ABS_API_KEY

async function abs<T>(path: string, method = 'GET'): Promise<T> {
  const res = await fetch(`${ABS_URL}/api${path}`, { method, headers: { Authorization: `Bearer ${absKey()}` }, cache: 'no-store' })
  if (!res.ok) throw new Error(`Audiobookshelf ${method} ${path.split('?')[0]} → ${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

let libraryId: string | undefined
type AbsItem = { id: string; addedAt: number; title: string; author?: string }
type AbsMatch = {
  libraryItem: {
    id: string
    addedAt: number
    media?: { metadata?: { title?: string; authorName?: string; authors?: { name: string }[] } }
  }
}

/** Audiobookshelf books matching a search. [] without an API key, or if Audiobookshelf can't be reached. */
async function owned(q: string): Promise<AbsItem[]> {
  if (!absKey()) return []
  try {
    if (!libraryId) {
      const { libraries } = await abs<{ libraries: { id: string; folders: { fullPath: string }[] }[] }>('/libraries')
      libraryId = libraries.find((l) => l.folders.some((f) => f.fullPath === '/audiobooks'))?.id
      if (!libraryId) throw new Error('no library uses /audiobooks')
    }
    const found = await abs<{ book?: AbsMatch[] }>(`/libraries/${libraryId}/search?${new URLSearchParams({ q, limit: '25' })}`)
    return (found.book ?? []).map(({ libraryItem: i }) => ({
      id: i.id,
      addedAt: i.addedAt,
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

/** LazyLibrarian's search, best match first (see rankBooks). Books already in Audiobookshelf show as Available. */
export async function searchAudiobooks(term: string) {
  const [found, status, library] = await Promise.all([ll<Found[]>('findBook', { name: term }), statusLookup(), owned(term)])
  return rankBooks(found, term)
    .slice(0, 12)
    .map((b) => {
      const inLibrary = library.some((item) => sameBook(item, { title: b.bookname, author: b.authorname }))
      return {
        id: b.bookid,
        title: b.bookname,
        year: yearOf(b.bookdate),
        overview: `by ${b.authorname}`,
        poster: coverUrl(b.bookimg),
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
    await ll('addBook', { id: bookId, wait: '1' })
    book = await find()
    if (!book) throw new Error(`LazyLibrarian couldn't add book ${bookId}`)
  }
  await ll('queueBook', { id: bookId, type: 'AudioBook' })
  await ll('searchBook', { id: bookId, type: 'AudioBook' })
  return { title: book.BookName, author: book.AuthorName, year: yearOf(book.BookDate), poster: coverUrl(book.BookImg) }
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
  const torrents = history.filter((h) => h.BookID === bookId && h.AuxInfo === 'AudioBook' && h.DownloadID).map((h) => h.DownloadID!)
  await deleteTorrents([...new Set(torrents)])

  if (audiobookStatus(book)?.label !== 'Available') return // nothing was filed: just cancelled
  if (!absKey()) return `${r.title} is still in Audiobookshelf. Delete it there, or set ABS_API_KEY so Arrmy can.`
  const since = Date.parse(`${r.created_at.replace(' ', 'T')}Z`)
  const item = (await owned(r.title)).find((i) => i.addedAt >= since && sameBook(i, { title: r.title, author: book!.AuthorName }))
  if (!item) return `Couldn't find the copy of ${r.title} that Arrmy downloaded in Audiobookshelf, so nothing was deleted there.`
  await abs(`/items/${item.id}?hard=1`, 'DELETE')
}

/** LazyLibrarian has no webhook, so audiobook Requests are checked every 2 minutes for becoming Available. */
export function startAudiobookWatch() {
  setInterval(async () => {
    try {
      const waiting = waitingOfType('audiobook')
      const statuses = await audiobookStatuses(waiting.map((r) => String(r.external_id)))
      for (const [i, r] of waiting.entries()) {
        if (statuses[i]?.label !== 'Available') continue
        markAvailable(r.id)
        await tellDiscord(r).catch((e) => console.warn(`[discord] ${e.message}`))
      }
    } catch (e) {
      console.warn(`[books] ${(e as Error).message}`)
    }
  }, 2 * 60_000)
}
