// Art and links for the Discord bot's cards: what a torrent is for, the poster of something playing in Plex, a book's
// cover. Posters come from Radarr and Sonarr (TMDB/TVDB images) and OpenLibrary, so Discord can show them.
import { arr, posterOf, queueOf, type Media } from './arr'
import { coverUrl, fromOpenLibrary, type LLBook } from './bookrules'
import { audiobookTorrents, ll, openLibrary } from './books'
import { requestsFor } from './db'
import { EDITIONS_CATEGORY, editionForTags } from './editions'
import { publicUrl } from './discord'
import { mediaUrl, type DownloadMeta } from './embeds'
import type { Torrent } from './problems'

/** What each torrent is for, by hash (lowercase): from Radarr's and Sonarr's queues and LazyLibrarian's history. */
export async function downloadMeta(list: Torrent[]) {
  const categories = new Set(list.map((t) => t.category))
  const [movies, shows, books] = await Promise.all([
    categories.has('movies') ? queueOf('radarr') : [],
    categories.has('tv') ? queueOf('sonarr') : [],
    categories.has('books') ? audiobookTorrents() : new Map<string, string>(),
  ])
  const metas = new Map<string, DownloadMeta>()
  for (const r of movies) {
    const m = r.movie
    if (!r.downloadId || !m) continue
    metas.set(r.downloadId.toLowerCase(), {
      app: 'Radarr',
      appUrl: m.tmdbId ? publicUrl('radarr', `/movie/${m.tmdbId}`) : undefined,
      title: `${m.title}${m.year ? ` (${m.year})` : ''}`,
      url: m.tmdbId ? mediaUrl('movie', m.tmdbId) : undefined,
      art: posterOf(m),
      by: m.tmdbId ? requestsFor('movie', m.tmdbId).map((x) => x.username) : [],
    })
  }
  for (const r of shows) {
    const s = r.series
    if (!r.downloadId || !s) continue
    metas.set(r.downloadId.toLowerCase(), {
      app: 'Sonarr',
      appUrl: s.titleSlug ? publicUrl('sonarr', `/series/${s.titleSlug}`) : undefined,
      title: `${s.title}${r.seasonNumber !== undefined ? ` · Season ${r.seasonNumber}` : ''}`,
      url: s.tvdbId ? mediaUrl('tv', s.tvdbId) : undefined,
      art: posterOf(s),
      by: s.tvdbId ? requestsFor('tv', s.tvdbId).map((x) => x.username) : [],
    })
  }
  // Books wanted in LazyLibrarian itself, not through Arrmy, have no Request: their title and cover come from it instead.
  const unrequested = [...books.values()].some((book) => !requestsFor('audiobook', book).length)
  const library = unrequested ? await ll<LLBook[]>('getAllBooks').catch(() => []) : []
  for (const [hash, book] of books) {
    const requests = requestsFor('audiobook', book)
    const known = library.find((b) => b.BookID === book)
    metas.set(hash, {
      app: 'LazyLibrarian',
      appUrl: publicUrl('lazylibrarian'),
      title: requests[0]?.title ?? known?.BookName ?? book,
      url: mediaUrl('audiobook', book),
      art: requests[0]?.poster ?? coverUrl(known?.BookImg, book),
      by: requests.map((x) => x.username),
    })
  }
  for (const t of list.filter((t) => t.category === EDITIONS_CATEGORY)) {
    const id = editionForTags(t.tags)
    const requests = id ? requestsFor('audiobook', id) : []
    metas.set(t.hash.toLowerCase(), {
      app: 'Arrmy',
      title: requests[0]?.title ?? t.name,
      url: id ? mediaUrl('audiobook', id) : undefined,
      art: requests[0]?.poster,
      by: requests.map((x) => x.username),
    })
  }
  return metas
}

// Radarr's and Sonarr's libraries, for the poster of whatever is playing in Plex. Read at most every 10 minutes.
type Movie = Media & { tmdbId: number }
type Show = Media & { tvdbId: number; titleSlug: string }
let library: { at: number; movies: Movie[]; shows: Show[] } | undefined

async function libraries() {
  if (!library || Date.now() - library.at > 10 * 60_000) {
    const [movies, shows] = await Promise.all([arr<Movie[]>('radarr', '/movie'), arr<Show[]>('sonarr', '/series')])
    library = { at: Date.now(), movies, shows }
  }
  return library
}

const same = (a: string, b?: string) => a.localeCompare(b ?? '', 'en', { sensitivity: 'base' }) === 0

/** Poster and page of a movie or show playing in Plex, found in Radarr or Sonarr by its title. */
export async function plexArt(s: { type: string; title: string; year?: number; grandparentTitle?: string }) {
  const { movies, shows } = await libraries().catch(() => ({ movies: [] as Movie[], shows: [] as Show[] }))
  if (s.type === 'episode') {
    const show = shows.find((x) => same(x.title, s.grandparentTitle))
    return show ? { art: posterOf(show), url: mediaUrl('tv', show.tvdbId) } : {}
  }
  const movie = movies.find((x) => same(x.title, s.title) && (!s.year || x.year === s.year))
  return movie ? { art: posterOf(movie), url: mediaUrl('movie', movie.tmdbId) } : {}
}

/** A book's cover and OpenLibrary page: OpenLibrary's best match for its title and author. */
export async function bookArt(title: string, author?: string) {
  const [doc] = await openLibrary(`${title}${author ? ` ${author}` : ''}`).catch(() => [])
  if (!doc) return {}
  const book = fromOpenLibrary(doc)
  return { art: coverUrl(book.bookimg, book.bookid), url: mediaUrl('audiobook', book.bookid) }
}
