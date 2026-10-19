// Status rules for Requests. No I/O here, so they can be unit-tested.

export type Movie = { id: number; hasFile: boolean }
export type Season = { seasonNumber: number; monitored: boolean; statistics?: { episodeFileCount: number; episodeCount: number } }
export type Series = { id: number; seasons: Season[] }
export type QueueItem = { movieId?: number; seriesId?: number; size: number; sizeleft: number }
export type Status = { label: 'Available' | 'Partially available' | 'Downloading' | 'Requested'; progress?: number }

export const seasonLabel = (seasons: number[]) => `Season${seasons.length > 1 ? 's' : ''} ${seasons.join(', ')}`

function downloading(items: QueueItem[]): Status | null {
  if (!items.length) return null
  const size = items.reduce((n, i) => n + i.size, 0)
  const left = items.reduce((n, i) => n + i.sizeleft, 0)
  return { label: 'Downloading', progress: size ? Math.round(((size - left) / size) * 100) : 0 }
}

/** null = not in Radarr. */
export function movieStatus(movie: Movie | undefined, queue: QueueItem[]): Status | null {
  if (!movie) return null
  if (movie.hasFile) return { label: 'Available' }
  return downloading(queue.filter((q) => q.movieId === movie.id)) ?? { label: 'Requested' }
}

/** null = not in Sonarr. `seasons` narrows the check to one Request; default is every monitored season. */
export function seriesStatus(series: Series | undefined, queue: QueueItem[], seasons?: number[]): Status | null {
  const target = (series?.seasons ?? []).filter(
    (s) => s.seasonNumber > 0 && (seasons ? seasons.includes(s.seasonNumber) : s.monitored),
  )
  if (!series || !target.length) return null
  const files = target.reduce((n, s) => n + (s.statistics?.episodeFileCount ?? 0), 0)
  const episodes = target.reduce((n, s) => n + (s.statistics?.episodeCount ?? 0), 0)
  if (episodes > 0 && files >= episodes) return { label: 'Available' }
  return (
    downloading(queue.filter((q) => q.seriesId === series.id)) ?? {
      label: files > 0 ? 'Partially available' : 'Requested',
    }
  )
}
