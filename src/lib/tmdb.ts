import { tmdbKey } from './keys'

// TMDB, for what Radarr's and Sonarr's lookups can't answer: people, companies, trending, upcoming and genres. Needs
// TMDB_API_KEY (free at themoviedb.org → Settings → API); without it those features stay hidden.
const TMDB_URL = process.env.TMDB_URL ?? 'https://api.themoviedb.org/3'

export const tmdbEnabled = () => !!tmdbKey()

/** GET a TMDB v3 path. The key can be the short v3 key or the long v4 read token. */
export async function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const key = tmdbKey()
  if (!key) throw new Error('TMDB_API_KEY is not set (Admin → Connected apps)')
  const bearer = key.length > 40 // the v4 read token is a long JWT; the v3 key is 32 characters
  const query = new URLSearchParams({ ...(bearer ? {} : { api_key: key }), ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  const res = await fetch(`${TMDB_URL}${path}?${query}`, {
    headers: { Accept: 'application/json', ...(bearer && { Authorization: `Bearer ${key}` }) },
    next: { revalidate: 3600 }, // trending and genres change slowly; an hour saves TMDB calls
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`)
  return (await res.json()) as T
}

/** A TMDB image path at a width TMDB serves (w92, w185, w342, w500, original). */
export const tmdbImage = (path: string | null | undefined, width = 'w342') => (path ? `https://image.tmdb.org/t/p/${width}${path}` : undefined)
