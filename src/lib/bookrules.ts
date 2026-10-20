// Audiobook rules. No I/O here, so they can be unit-tested.
import type { Status } from './status'

/**
 * A book as LazyLibrarian's getAllBooks lists it. The real server returns AudioStatus/AudioLibrary even though its query
 * spells them in lowercase, so both spellings are read.
 */
export type LLBook = {
  BookID: string
  BookName: string
  AuthorName: string
  BookImg?: string | null
  BookDate?: string | null
  AudioStatus?: string | null
  AudioLibrary?: string | null
  audiostatus?: string | null
  audiolibrary?: string | null
}

/** The audiobook's status as Arrmy shows it. null = not wanted: never requested, or cancelled. */
export function audiobookStatus(book: LLBook | undefined, download?: { size: number; sizeleft: number }): Status | null {
  if (!book) return null
  const status = book.AudioStatus ?? book.audiostatus ?? ''
  // Open is LazyLibrarian's default FOUND_STATUS once it has filed the book; Have = found in its library scan.
  if (book.AudioLibrary || book.audiolibrary || status === 'Open' || status === 'Have') return { label: 'Available' }
  if (status === 'Snatched') {
    const progress = download?.size ? Math.round(((download.size - download.sizeleft) / download.size) * 100) : 0
    return { label: 'Downloading', progress }
  }
  if (status === 'Wanted') return { label: 'Requested' }
  return null
}

/**
 * OpenLibrary covers at a usable size over https. Once a book is in LazyLibrarian its image is a cached file the browser
 * can't reach, so OpenLibrary works (OL…W) fall back to OpenLibrary's own cover for that work.
 */
export function coverUrl(img?: string | null, bookId?: string) {
  if (img && /^https?:\/\//.test(img)) return img.replace(/^http:/, 'https:').replace(/-S\.jpg$/, '-M.jpg')
  if (bookId && /^OL\d+W$/.test(bookId)) return `https://covers.openlibrary.org/w/olid/${bookId}-M.jpg`
  return undefined
}

export const yearOf = (date?: string | null) => Number(date?.slice(0, 4)) || undefined

/** One result of OpenLibrary's search.json. */
export type OpenLibraryDoc = { key: string; title: string; author_name?: string[]; cover_i?: number; first_publish_year?: number }

/** An OpenLibrary search result in LazyLibrarian's terms: its BookID is the OpenLibrary work id (OL66554W). */
export const fromOpenLibrary = (doc: OpenLibraryDoc) => ({
  bookid: doc.key.replace('/works/', ''),
  bookname: doc.title,
  authorname: doc.author_name?.[0] ?? 'Unknown author',
  bookimg: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
  year: doc.first_publish_year,
})

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents
    .replace(/\(.*?\)|\[.*?\]/g, ' ') // (Unabridged), [Dramatized]
    .split(':')[0] // subtitle
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Study-guide spin-offs that OpenLibrary returns for popular titles; nobody wants them as audiobooks.
const SPINOFF = /\b(summary|summaries|review|analysis|study guide|workbook|sparknotes|cliffs ?notes|trivia|quiz)\b/i

/**
 * Search results worth showing, best first. OpenLibrary's own order is the best signal (it puts Jane Austen's Pride
 * and Prejudice above two thousand adaptations, which LazyLibrarian scores the same), so keep it: only drop spin-offs
 * and move exact-title matches up, in their original order.
 */
export function rankBooks<T extends { bookname: string }>(found: T[], query: string) {
  const q = words(query)
  const exact = (b: T) => words(b.bookname) === q
  const kept = found.filter((b) => !SPINOFF.test(b.bookname))
  return [...kept.filter(exact), ...kept.filter((b) => !exact(b))]
}

/**
 * Whether an Audiobookshelf item is this book: the same title (ignoring subtitles, brackets and punctuation) and,
 * when Audiobookshelf knows the author, the same surname. Exact on purpose: "Dune" must not match "Dune Messiah".
 */
export function sameBook(item: { title: string; author?: string }, book: { title: string; author: string }) {
  const title = words(item.title)
  if (!title || title !== words(book.title)) return false
  const surname = words(book.author).split(' ').pop()
  return !item.author || !surname || words(item.author).split(' ').includes(surname)
}
