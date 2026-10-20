// Audiobook rules. No I/O here, so they can be unit-tested.
import type { Status } from './status'

/** A book as LazyLibrarian's getAllBooks lists it (it lowercases a few column names). */
export type LLBook = {
  BookID: string
  BookName: string
  AuthorName: string
  BookImg?: string | null
  BookDate?: string | null
  audiostatus?: string | null
  audiolibrary?: string | null
}

/** The audiobook's status as Arrmy shows it. null = not wanted: never requested, or cancelled. */
export function audiobookStatus(book: LLBook | undefined, download?: { size: number; sizeleft: number }): Status | null {
  if (!book) return null
  const status = book.audiostatus ?? ''
  // Open is LazyLibrarian's default FOUND_STATUS once it has filed the book; Have = found in its library scan.
  if (book.audiolibrary || status === 'Open' || status === 'Have') return { label: 'Available' }
  if (status === 'Snatched') {
    const progress = download?.size ? Math.round(((download.size - download.sizeleft) / download.size) * 100) : 0
    return { label: 'Downloading', progress }
  }
  if (status === 'Wanted') return { label: 'Requested' }
  return null
}

/** OpenLibrary covers at a usable size over https. LazyLibrarian's own placeholders aren't reachable from a browser. */
export function coverUrl(img?: string | null) {
  if (!img || !/^https?:\/\//.test(img)) return undefined
  return img.replace(/^http:/, 'https:').replace(/-S\.jpg$/, '-M.jpg')
}

export const yearOf = (date?: string | null) => Number(date?.slice(0, 4)) || undefined

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
