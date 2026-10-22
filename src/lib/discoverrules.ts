// Shaping TMDB's answers for Discover. No I/O here, so they can be unit-tested.

export type DiscoverType = 'movie' | 'tv'
export type Card = { type: DiscoverType; id: number; title: string; year?: string; poster?: string }
export type Raw = { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path?: string | null }

export const isDiscoverType = (t: string): t is DiscoverType => t === 'movie' || t === 'tv'

/** A poster in a row; `image` turns TMDB's path into a URL. */
export const cardOf = (type: DiscoverType, r: Raw, image: (path?: string | null) => string | undefined): Card => ({
  type,
  id: r.id,
  title: (type === 'movie' ? r.title : r.name) ?? '',
  year: (type === 'movie' ? r.release_date : r.first_air_date)?.slice(0, 4) || undefined,
  poster: image(r.poster_path),
})

/** The YouTube key of the best trailer: an official one first, then any. */
export function trailerOf(videos: { key: string; site: string; type: string; official?: boolean }[] = []): string | undefined {
  const trailers = videos.filter((v) => v.site === 'YouTube' && v.type === 'Trailer')
  return (trailers.find((v) => v.official) ?? trailers[0])?.key
}

/** 135 → "2 h 15 min" */
export const runtimeText = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`)

/** Key of a poster in the status map: `movie:<tmdbId>` or `tv:<tmdbId>`. */
export const cardKey = (type: DiscoverType, id: number) => `${type}:${id}`
