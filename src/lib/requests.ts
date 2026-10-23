// Making a Request, whoever asks: a person clicking Request (actions.ts), and later watchlists and lists. Approval,
// quotas and the title blocklist belong here too, so every way of asking follows the same rules.
import { addMovie, addSeries, arr, posterOf, type Media } from './arr'
import { cleanEdition, editionId } from './bookrules'
import { addAudiobook } from './books'
import { addRequest, hasRequest, requestsFor, seasonsOf, type User } from './db'
import { addEdition } from './editions'
import { showLimitProblem } from './limits'
import { tellRequest } from './notify'
import { searchMovie } from './requestlog'

/** A title's first Request starts its thread as Requested; a later one leaves it as it is (Downloading, Available). */
const firstFor = (type: 'movie' | 'audiobook', id: number | string) => (requestsFor(type, id).length === 1 ? ('Requested' as const) : undefined)

const union = (...lists: number[][]) => [...new Set(lists.flat())].sort((a, b) => a - b)

/** The Request Log is a record, not part of the job: failing to write it never stops the Request. */
const logged = (what: Promise<unknown>) => what.catch((e) => console.warn(`[log] ${(e as Error).message}`))

export async function createMovieRequest(user: User, tmdbId: number) {
  const { movie, search } = await addMovie(tmdbId)
  if (!hasRequest(user.id, 'movie', tmdbId)) {
    addRequest({ userId: user.id, type: 'movie', externalId: tmdbId, title: movie.title, year: movie.year, poster: posterOf(movie) })
    const item = { media_type: 'movie' as const, external_id: tmdbId, title: movie.title, year: movie.year ?? null, poster: posterOf(movie) ?? null }
    tellRequest(item, 'info', `Requested by **${user.username}**.`, [], firstFor('movie', tmdbId))
  }
  if (search) logged(searchMovie(search)) // in the background: it waits on every indexer
}

/** Chosen seasons of a show. Returns why it was refused (over the Size Limit), else undefined. */
export async function createTvRequest(user: User, tvdbId: number, seasons: number[]): Promise<string | undefined> {
  if (!seasons.length) return
  const problem = await showLimitProblem(tvdbId, union(requestsFor('tv', tvdbId).flatMap(seasonsOf), seasons))
  if (problem) {
    const [show] = await arr<Media[]>('sonarr', `/series/lookup?term=tvdb:${tvdbId}`).catch(() => [])
    tellRequest(
      { media_type: 'tv', external_id: tvdbId, title: show?.title ?? `TVDB ${tvdbId}`, year: show?.year ?? null, poster: (show && posterOf(show)) ?? null },
      'danger',
      `**${user.username}**'s Request was refused. ${problem}`,
      [['Seasons', seasons.join(', ')]],
    )
    return problem
  }
  const show = await addSeries(tvdbId, seasons)
  addRequest({ userId: user.id, type: 'tv', externalId: tvdbId, title: show.title, year: show.year, poster: posterOf(show), seasons })
  const slug = (show as { titleSlug?: string }).titleSlug
  const tmdbId = (show as { tmdbId?: number }).tmdbId
  const item = { media_type: 'tv' as const, external_id: tvdbId, title: show.title, year: show.year ?? null, poster: posterOf(show) ?? null, slug, tmdbId }
  tellRequest(item, 'info', `Requested by **${user.username}**.`, [['Seasons', seasons.join(', ')]], 'Requested')
}

/** The book, or with an Edition (a narrator, or Full Cast) that edition, which Arrmy finds itself (see editions.ts). */
export async function createAudiobookRequest(user: User, book: string, rawEdition = '') {
  const edition = cleanEdition(rawEdition)
  if (edition && !/^OL\d+W$/.test(book)) throw new Error('Editions need an OpenLibrary book')
  const id = edition ? editionId(book, edition) : book
  const found = edition ? { year: undefined, ...(await addEdition(id)) } : await addAudiobook(id)
  const title = edition ? `${found.title} (${edition})` : found.title
  if (!hasRequest(user.id, 'audiobook', id)) {
    addRequest({ userId: user.id, type: 'audiobook', externalId: id, title, year: found.year, poster: found.poster })
    const item = { media_type: 'audiobook' as const, external_id: id, title, year: found.year ?? null, poster: found.poster ?? null }
    tellRequest(item, 'info', `Requested by **${user.username}**.`, [['Author', found.author]], firstFor('audiobook', id))
  }
}
