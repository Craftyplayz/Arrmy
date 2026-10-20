// Problem rules for the Admin view. No I/O here, so they can be unit-tested.
import type { QueueRecord } from './arr'

export type Service = 'radarr' | 'sonarr'
export type Problem = {
  kind: 'Missing' | 'Failed Download' | 'Failed Import'
  service: Service | 'lazylibrarian'
  title: string
  detail: string
  /** retry = blocklist this release and grab another; search = look for a release again. */
  fix: 'retry' | 'search'
  /** Queue ids for retry; movie or episode ids for search. */
  ids: number[]
  /** The torrent, for an audiobook's retry. */
  hash?: string
}

/** A torrent as qBittorrent's /torrents/info lists it. */
export type Torrent = {
  hash: string
  name: string
  category: string
  state: string
  added_on: number
  downloaded: number
  /** 0 to 1. */
  progress: number
  size: number
  /** Bytes per second. */
  dlspeed: number
  num_seeds: number
  /** Seconds left; 8640000 means never. */
  eta: number
}

/** Dead releases in a row for one title before Arrmy stops swapping them and makes it a Problem. */
export const STRIKES = 3
export const DEAD_DETAIL = `${STRIKES} releases in a row never started: nobody is sharing them.`

/**
 * Why a torrent counts as dead, or undefined if it doesn't: no file list (metadata) after 5 minutes, or nothing
 * downloaded 15 minutes after it was added. Stopped, queued and checking torrents never count.
 */
export function deadReason(t: Torrent, now = Date.now()) {
  const minutes = (now - t.added_on * 1000) / 60_000
  if (t.state === 'metaDL' || t.state === 'forcedMetaDL') return minutes > 5 ? 'No file list after 5 minutes' : undefined
  if (['stalledDL', 'downloading', 'forcedDL'].includes(t.state) && t.downloaded === 0 && minutes > 15)
    return 'Nothing downloaded after 15 minutes'
}
export type Download = { title: string; size: number; sizeleft: number }

export type MissingMovie = { id: number; title: string; year?: number; isAvailable: boolean; added: string }
export type MissingEpisode = {
  id: number
  seriesId: number
  seasonNumber: number
  airDateUtc?: string
  series?: { title: string; added: string }
}

const HOUR = 3_600_000
const age = (iso?: string) => (iso ? Date.now() - Date.parse(iso) : 0)

export function nameOf(r: QueueRecord) {
  if (r.movie) return `${r.movie.title}${r.movie.year ? ` (${r.movie.year})` : ''}`
  if (r.series) return `${r.series.title}${r.seasonNumber !== undefined ? ` · Season ${r.seasonNumber}` : ''}`
  return r.title
}

/** Sonarr lists a season pack once per episode; this gives one entry per download. */
export function byDownload(records: QueueRecord[]) {
  const groups = new Map<string, QueueRecord[]>()
  for (const r of records) {
    const key = r.downloadId ?? `queue-${r.id}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return [...groups.values()]
}

export function queueProblem(service: Service, group: QueueRecord[]): Problem | undefined {
  const r = group[0]
  const state = r.trackedDownloadState ?? ''
  const troubled = r.trackedDownloadStatus === 'warning' || r.trackedDownloadStatus === 'error'
  const kind =
    state === 'importBlocked' || state === 'importFailed' || (state === 'importPending' && troubled)
      ? 'Failed Import'
      : state === 'failed' || state === 'failedPending' || r.status === 'failed' || troubled
        ? 'Failed Download'
        : undefined
  if (!kind) return
  const detail = r.statusMessages?.flatMap((m) => m.messages).find(Boolean) ?? r.errorMessage ?? r.title
  return { kind, service, title: nameOf(r), detail, fix: 'retry', ids: group.map((g) => g.id) }
}

/** Missing = nothing found for over an hour (a fresh Request's first search gets that long), and not downloading. */
export function missingProblems(movies: MissingMovie[], episodes: MissingEpisode[], movieQueue: QueueRecord[], tvQueue: QueueRecord[]) {
  const downloadingMovies = new Set(movieQueue.map((q) => q.movieId))
  const downloadingEpisodes = new Set(tvQueue.map((q) => q.episodeId))
  const problems: Problem[] = movies
    .filter((m) => m.isAvailable && !downloadingMovies.has(m.id) && age(m.added) > HOUR)
    .map((m) => ({
      kind: 'Missing',
      service: 'radarr',
      title: `${m.title}${m.year ? ` (${m.year})` : ''}`,
      detail: 'No release found yet.',
      fix: 'search',
      ids: [m.id],
    }))

  const seasons = new Map<string, MissingEpisode[]>()
  for (const e of episodes) {
    // A day's grace after airing: new episodes usually take hours to be released.
    if (downloadingEpisodes.has(e.id) || age(e.airDateUtc) < 24 * HOUR || age(e.series?.added) < HOUR) continue
    const key = `${e.seriesId}:${e.seasonNumber}`
    seasons.set(key, [...(seasons.get(key) ?? []), e])
  }
  for (const eps of seasons.values()) {
    problems.push({
      kind: 'Missing',
      service: 'sonarr',
      title: `${eps[0].series?.title ?? 'Show'} · Season ${eps[0].seasonNumber}`,
      detail: `${eps.length} episode${eps.length > 1 ? 's' : ''} with no release found yet.`,
      fix: 'search',
      ids: eps.map((e) => e.id),
    })
  }
  return problems
}
