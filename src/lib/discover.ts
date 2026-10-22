import { arr, queueOf } from './arr'
import { cardKey, cardOf, type Card, type DiscoverType, type Raw } from './discoverrules'
import { movieStatus, seriesStatus, type Movie, type Series, type Status } from './status'
import { tmdb, tmdbImage } from './tmdb'

export type Genre = { id: number; name: string }

/** A row of posters from a TMDB list path. */
export async function cardsFrom(type: DiscoverType, path: string, params: Record<string, string | number> = {}): Promise<Card[]> {
  const list = await tmdb<{ results: Raw[] }>(path, params)
  return list.results
    .filter((r) => r.poster_path)
    .slice(0, 20)
    .map((r) => cardOf(type, r, (p) => tmdbImage(p, 'w342')))
}

export const genresOf = async (type: DiscoverType) => (await tmdb<{ genres: Genre[] }>(`/genre/${type}/list`)).genres

/**
 * Arrmy's status for each poster. shortcut: reads the whole Radarr and Sonarr libraries once per page and matches on
 * TMDB id (Sonarr v4 keeps it on each show); a library in the tens of thousands would want a lookup per id instead.
 * A Service that is down just leaves its posters without a status.
 */
export async function statusesFor(cards: Card[]): Promise<Map<string, Status>> {
  const out = new Map<string, Status>()
  const jobs: Promise<void>[] = []
  if (cards.some((c) => c.type === 'movie'))
    jobs.push(
      Promise.all([arr<(Movie & { tmdbId: number })[]>('radarr', '/movie'), queueOf('radarr')]).then(([lib, queue]) => {
        for (const m of lib) {
          const s = movieStatus(m, queue)
          if (s) out.set(cardKey('movie', m.tmdbId), s)
        }
      }),
    )
  if (cards.some((c) => c.type === 'tv'))
    jobs.push(
      Promise.all([arr<(Series & { tmdbId?: number })[]>('sonarr', '/series'), queueOf('sonarr')]).then(([lib, queue]) => {
        for (const s of lib) {
          const status = s.tmdbId ? seriesStatus(s, queue) : null
          if (status) out.set(cardKey('tv', s.tmdbId!), status)
        }
      }),
    )
  await Promise.all(jobs.map((j) => j.catch(console.error)))
  return out
}
