// What a Search looks for besides a title: a person's or company's movies and shows (from TMDB), or a series' or
// author's books (from OpenLibrary).
import type { MediaType } from './db'

export type SearchBy = 'title' | 'actor' | 'director' | 'company' | 'series' | 'author'

/** The choices each tab offers, with their labels. Title comes first and is the default. */
export const SEARCH_BY: Record<MediaType, [SearchBy, string][]> = {
  movie: [['title', 'Title'], ['actor', 'Actor'], ['director', 'Director'], ['company', 'Studio']],
  tv: [['title', 'Title'], ['actor', 'Actor'], ['director', 'Director'], ['company', 'Studio']],
  audiobook: [['title', 'Book'], ['series', 'Series'], ['author', 'Author']],
}

/** The `by` a tab offers, or 'title'. Movies and TV need TMDB for anything else. */
export function searchByOf(type: MediaType | 'all', by: string | null | undefined, tmdbOn: boolean): SearchBy {
  if (type === 'all' || ((type === 'movie' || type === 'tv') && !tmdbOn)) return 'title'
  return SEARCH_BY[type].find(([b]) => b === by)?.[0] ?? 'title'
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

type Person = { id: number; name: string; known_for_department?: string }

/** TMDB ranks people by popularity; an actor search skips a more popular namesake who only directs, and the reverse. */
export function pickPerson<T extends Person>(people: T[], by: SearchBy): T | undefined {
  const department = by === 'director' ? 'Directing' : 'Acting'
  return people.find((p) => p.known_for_department === department) ?? people[0]
}

/**
 * Every company whose name has all the words searched for, so "Marvel" takes in Marvel Studios and Marvel
 * Entertainment but not Marvelous. Up to 10, since TMDB's discover joins them with OR.
 */
export function pickCompanies<T extends { id: number; name: string }>(companies: T[], q: string): T[] {
  const want = words(q)
  const matching = companies.filter((c) => {
    const name = words(c.name)
    return want.every((w) => name.includes(w))
  })
  return (matching.length ? matching : companies.slice(0, 1)).slice(0, 10)
}

type Credit = { id: number; popularity?: number; job?: string; genre_ids?: number[] }
const TALK_OR_NEWS = [10767, 10763] // TMDB genre ids: an actor's guest spots on talk and news shows aren't their shows

/** A person's titles as an actor (cast) or director (crew), each once, most popular first, at most `max`. */
export function creditsOf<T extends Credit>(credits: { cast?: T[]; crew?: T[] }, by: SearchBy, max = 20): T[] {
  const list = by === 'director' ? (credits.crew ?? []).filter((c) => c.job === 'Director') : (credits.cast ?? [])
  const seen = new Set<number>()
  return list
    .filter((c) => !c.genre_ids?.some((g) => TALK_OR_NEWS.includes(g)) && !seen.has(c.id) && seen.add(c.id))
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, max)
}

/** One series as Hardcover lists it: one book per position, without duplicates or compilations (books.ts's query filters those). */
export type HardcoverSeries = { name: string; author?: { name: string } | null; book_series: { position: number | null; book: { title: string } }[] }

/** The series' main books in reading order, to look up in OpenLibrary. Whole positions only: 1.5 is a novella between books. */
export function seriesTitles(s: HardcoverSeries) {
  return {
    author: s.author?.name,
    titles: s.book_series.filter((b) => b.position !== null && Number.isInteger(b.position)).map((b) => b.book.title),
  }
}

/**
 * OpenLibrary's series field also catches books about a series and box sets by nobody. Keeps the books by the
 * series' most frequent author, oldest first, which is usually reading order.
 */
export function seriesBooks<T extends { author_name?: string[]; first_publish_year?: number }>(docs: T[]): T[] {
  const counts = new Map<string, number>()
  for (const d of docs) if (d.author_name?.[0]) counts.set(d.author_name[0], (counts.get(d.author_name[0]) ?? 0) + 1)
  const author = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
  return docs
    .filter((d) => d.author_name?.[0] === author)
    .sort((a, b) => (a.first_publish_year ?? 9999) - (b.first_publish_year ?? 9999))
}
