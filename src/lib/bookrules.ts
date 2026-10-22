// Audiobook rules. No I/O here, so they can be unit-tested.
import { duration } from './botrules.ts'
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
export type OpenLibraryDoc = { key: string; title: string; author_name?: string[]; cover_i?: number; first_publish_year?: number; isbn?: string[] }

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

/**
 * An Edition Request (one narrator's reading, or the Full Cast) has the id `<BookID>~<edition>`. Arrmy finds those
 * itself (editions.ts): LazyLibrarian knows no narrators and keeps one audiobook per book.
 */
export const editionId = (bookId: string, edition: string) => `${bookId}~${edition}`
export function editionOf(id: number | string) {
  const [bookId, edition] = String(id).split('~')
  return edition ? { bookId, edition } : undefined
}

/** A file or folder name: no path separators or characters Windows refuses, never "." or "..". */
export const safeName = (s: string) =>
  s
    .replace(/[\\/:*?"<>|~]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .trim() || 'Unknown'

/** What someone typed as the edition, safe in an id and a folder name. '' = no edition. */
export const cleanEdition = (s: string) => (s.trim() ? safeName(s).slice(0, 40) : '')

const padded = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `
const FULL_CAST = / (full cast|dramati[sz]ed|dramati[sz]ation) /

/**
 * Whether a release is this edition of this book: its name has every word of the title (bar "and", "the" and the like)
 * and of the edition. "Full Cast" also matches Dramatised. Packs of a whole series fail on purpose: they lack the title.
 * shortcut: a title inside a longer one matches too ("Dune" in "Dune Messiah"); check the year or author if that bites.
 */
export function isEdition(release: string, title: string | string[], edition: string) {
  const name = padded(release)
  const has = (w: string) => name.includes(` ${w} `)
  if (!matchesTitle(name, title)) return false
  const e = padded(edition)
  return FULL_CAST.test(e) ? FULL_CAST.test(name) : e.trim().split(' ').every(has)
}

const SKIP = ['and', 'the', 'of', 'an']
const titleWords = (title: string) => words(title).split(' ').filter((w) => w.length > 1 && !SKIP.includes(w))
/** The text (already padded) has every word of at least one of the titles. */
const matchesTitle = (padded: string, title: string | string[]) =>
  [title].flat().some((t) => titleWords(t).every((w) => padded.includes(` ${w} `)))

// Books retitled between countries: the narrator's release may use the other name. Add pairs as they turn up.
const RETITLED: [string, string][] = [
  ["philosopher's stone", "sorcerer's stone"],
  ['northern lights', 'the golden compass'],
]

/** The title and its regional retitles ("Philosopher's Stone" is "Sorcerer's Stone" in the US, which Jim Dale reads). */
export function titleVariants(title: string) {
  const plain = title.replace(/[’‘]/g, "'")
  const out = new Set([title])
  for (const [a, b] of RETITLED) {
    if (plain.toLowerCase().includes(a)) out.add(plain.replace(new RegExp(a, 'i'), b))
    if (plain.toLowerCase().includes(b)) out.add(plain.replace(new RegExp(b, 'i'), a))
  }
  return [...out]
}

/** A series name taken from a book's title: what comes before "and the", a colon, a dash or a bracket. */
export const seriesOf = (title: string) => title.split(/:| and the | - |\(/i)[0].trim()

const PACK = /\b\d+\s*-\s*\d+\b|\b(complete|collection|series|saga|box ?set|books|trilogy)\b/i
/**
 * A release of the whole series by this narrator: name has the series' words (`series`: its real name, or seriesOf the
 * title), the edition, and a sign of several books or the series' name up front ("The Lord of the Rings - Narrated by
 * Andy Serkis"). A single book that starts with the series name passes too; packFiles then finds none of its files.
 */
export function isPack(release: string, series: string, edition: string) {
  const name = padded(release)
  const e = padded(edition)
  const narrated = FULL_CAST.test(e) ? FULL_CAST.test(name) : e.trim().split(' ').every((w) => name.includes(` ${w} `))
  return (PACK.test(release) || name.startsWith(padded(series))) && narrated && matchesTitle(name, series)
}

/** The files of a pack that belong to this book: their path (folders included) has every word of one of its titles. */
export const packFiles = <T extends { name: string }>(files: T[], titles: string[]) => files.filter((f) => matchesTitle(padded(f.name), titles))

/** The folder all of these paths share ('' when they don't share one), with its trailing slash. */
export function commonDir(names: string[]) {
  const dirs = names.map((n) => n.split('/').slice(0, -1))
  const first = dirs[0] ?? []
  let n = 0
  while (n < first.length && dirs.every((d) => d[n] === first[n])) n++
  return first.slice(0, n).map((d) => d + '/').join('')
}

/** A search result from Prowlarr. */
export type Release = { title: string; size: number; seeders?: number; protocol: string; downloadUrl?: string; magnetUrl?: string }

/** The edition's best release: the most seeders, at least 50 MB like LazyLibrarian's (smaller ones are ebooks). */
export const bestEdition = (releases: Release[], title: string, edition: string) =>
  releases
    .filter((r) => r.protocol === 'torrent' && r.size >= 50e6 && (r.seeders ?? 0) > 0 && (r.magnetUrl || r.downloadUrl) && isEdition(r.title, title, edition))
    .sort((a, b) => (b.seeders ?? 0) - (a.seeders ?? 0))[0]

/**
 * What to try for an edition, best first: a seeded release of the book itself, then a seeded series pack by the narrator
 * (only the book's files are downloaded), and only if neither exists, a release of the book nobody is seeding.
 * AudioBook Bay shows no seeders and sometimes no size: unknown counts as worth a try, after the known-seeded ones.
 */
export type Candidate = { release: Release; kind: 'single' | 'pack' | 'seedless' }
export function editionCandidates(releases: Release[], titles: string[], edition: string, series: string): Candidate[] {
  const ok = releases.filter((r) => r.protocol === 'torrent' && (r.size >= 50e6 || r.size === 0) && (r.magnetUrl || r.downloadUrl))
  const seeders = (r: Release) => r.seeders ?? 0
  const alive = (r: Release) => r.seeders === undefined || r.seeders > 0
  const bySeeders = (a: Release, b: Release) => seeders(b) - seeders(a)
  const single = ok.filter((r) => isEdition(r.title, titles, edition))
  return [
    ...single.filter(alive).sort(bySeeders).map((release) => ({ release, kind: 'single' as const })),
    ...ok.filter((r) => alive(r) && !single.includes(r) && isPack(r.title, series, edition)).sort(bySeeders).map((release) => ({ release, kind: 'pack' as const })),
    ...single.filter((r) => seeders(r) === 0).sort((a, b) => b.size - a.size).map((release) => ({ release, kind: 'seedless' as const })),
  ]
}

/** What the last search for an edition found, kept so the Request Log and Stuck can say why nothing is downloading. */
export type EditionSearch = { at: number; found: number; singles: number; seeded: number; packs: number; grabbed?: string }
export function searchText(s: EditionSearch, edition: string, now = Date.now()) {
  const ago = duration(Math.max(0, now - s.at) / 1000)
  const parts = [`${s.found} releases found`]
  if (s.singles) parts.push(`${s.singles} of this book with ${edition}${s.seeded ? '' : ', none with seeders'}`)
  else parts.push(`none of this book with ${edition}`)
  if (s.packs) parts.push(`${s.packs} series pack${s.packs === 1 ? '' : 's'} with seeders`)
  return `Searched ${ago} ago: ${parts.join('; ')}.${s.grabbed ? ` ${s.grabbed}` : ''}`
}

/** Books whose Request was removed, by BookID, with when (ms). Kept for a day: see unwantAgain. */
export type Removed = Record<string, number>
const DAY = 86_400_000

/**
 * Removed books LazyLibrarian wants again. Its search can still be running when a Request is removed, and grabbing a
 * release afterwards sets the book back to Snatched (then Wanted when that release fails). Not if someone requested it
 * again. Also returns the entries still worth keeping.
 */
export function unwantAgain(removed: Removed, books: LLBook[], requested: Set<string>, now = Date.now()) {
  const keep: Removed = {}
  const unwant: string[] = []
  for (const [id, at] of Object.entries(removed)) {
    if (requested.has(id) || now - at > DAY) continue
    keep[id] = at
    const status = books.find((b) => b.BookID === id)
    if (['Wanted', 'Snatched'].includes(status?.AudioStatus ?? status?.audiostatus ?? '')) unwant.push(id)
  }
  return { unwant, keep }
}

/** The ISBN-10 of a 978- ISBN-13 (Amazon's cover addresses use it), else undefined. */
export function isbn10(isbn13: string) {
  if (!/^978\d{10}$/.test(isbn13)) return undefined
  const body = isbn13.slice(3, 12)
  const sum = [...body].reduce((n, d, i) => n + Number(d) * (10 - i), 0)
  const check = (11 - (sum % 11)) % 11
  return body + (check === 10 ? 'X' : check)
}

/** An OpenLibrary work id, which is what a book's BookID is (OL21385222W). */
export const isWorkId = (id: string) => /^OL\d+W$/.test(id)
