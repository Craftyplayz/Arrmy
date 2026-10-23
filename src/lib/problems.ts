// Problem rules for the Admin view. No I/O here, so they can be unit-tested.
import type { QueueRecord } from './arr'
import type { EditionSearch } from './bookrules'

export type Service = 'radarr' | 'sonarr'
export type Problem = {
  kind: 'Missing' | 'Failed Download' | 'Failed Import'
  /** editions: an Audiobook Edition, which Arrmy searches for itself. */
  service: Service | 'lazylibrarian' | 'editions'
  title: string
  detail: string
  /** retry = blocklist this release and grab another; search = look for a release again. */
  fix: 'retry' | 'search'
  /** Queue ids for retry; movie or episode ids for search. */
  ids: number[]
  /** The audiobook's BookID, or its Edition id, for its search. */
  book?: string
  /** The torrent, for an audiobook's retry. */
  hash?: string
  /** The poster or cover, for Discord. */
  poster?: string | null
  /** What Radarr or Sonarr search for it: the movie, or one season of a show (the doctor's numbered list of releases). */
  media?: { movieId: number } | { seriesId: number; season: number }
}

/** A torrent as qBittorrent's /torrents/info lists it. */
export type Torrent = {
  hash: string
  name: string
  category: string
  /** "a, b" */
  tags: string
  /** Where its files are: each file's name (with the torrent's own folder) goes after this. */
  save_path: string
  state: string
  added_on: number
  downloaded: number
  /** 0 to 1. */
  progress: number
  size: number
  /** Bytes per second. */
  dlspeed: number
  num_seeds: number
  /** Peers that are still downloading. */
  num_leechs: number
  /** Seconds left; 8640000 means never. */
  eta: number
  /** When it finished (Unix seconds), or -1. Kept across restarts, unlike progress while qBittorrent rechecks. */
  completion_on: number
  /** When it last sent or received anything (Unix seconds). */
  last_activity: number
}

/** The Admin's Dead releases settings. strikes = dead releases in a row for one title before Arrmy stops swapping and makes it a Problem. */
export type DeadLimits = { metaMinutes: number; idleMinutes: number; strikes: number }
export const DEAD_DEFAULTS: DeadLimits = { metaMinutes: 5, idleMinutes: 15, strikes: 3 }
export const deadDetail = (strikes: number) => `${strikes} releases in a row never started: nobody is sharing them.`

/**
 * Why a torrent counts as dead, or undefined if it doesn't: no file list (metadata) after metaMinutes, or nothing
 * downloaded idleMinutes after it was added. Stopped, queued and checking torrents never count.
 */
export function deadReason(t: Torrent, now = Date.now(), limits = DEAD_DEFAULTS) {
  const minutes = (now - t.added_on * 1000) / 60_000
  if (t.state === 'metaDL' || t.state === 'forcedMetaDL')
    return minutes > limits.metaMinutes ? `No file list after ${limits.metaMinutes} minutes` : undefined
  if (['stalledDL', 'downloading', 'forcedDL'].includes(t.state) && t.downloaded === 0 && minutes > limits.idleMinutes)
    return `Nothing downloaded after ${limits.idleMinutes} minutes`
}
/** A torrent's state in a word or two, for the Admin view's Downloading list. */
export function stateLabel(state: string) {
  if (state === 'metaDL' || state === 'forcedMetaDL') return 'Fetching file list'
  if (state === 'stalledDL') return 'Stalled'
  if (state === 'queuedDL') return 'Queued'
  if (state === 'stoppedDL' || state === 'pausedDL') return 'Paused'
  if (state.startsWith('checking') || state === 'moving') return 'Checking'
  if (state === 'error' || state === 'missingFiles') return 'Error'
  return 'Downloading'
}

type Images = { coverType: string; remoteUrl?: string }[]
export const posterIn = (images?: Images) => images?.find((i) => i.coverType === 'poster')?.remoteUrl

export type MissingMovie = {
  id: number
  tmdbId?: number
  title: string
  year?: number
  isAvailable: boolean
  added: string
  images?: Images
  lastSearchTime?: string
  inCinemas?: string
  digitalRelease?: string
  physicalRelease?: string
}
export type MissingEpisode = {
  id: number
  seriesId: number
  seasonNumber: number
  airDateUtc?: string
  lastSearchTime?: string
  series?: { title: string; tvdbId?: number; added: string; images?: Images }
}

const HOUR = 3_600_000
/** How long a fresh Request's first search gets before nothing found is a Problem. */
const FIRST_SEARCH = 10 * 60_000
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
  const media = r.movieId ? { movieId: r.movieId } : r.seriesId && r.seasonNumber !== undefined ? { seriesId: r.seriesId, season: r.seasonNumber } : undefined
  return { kind, service, title: nameOf(r), detail, fix: 'retry', ids: group.map((g) => g.id), poster: posterIn(r.movie?.images ?? r.series?.images), ...(media && { media }) }
}

/** Missing = nothing found for over FIRST_SEARCH (a fresh Request's first search gets that long), and not downloading. */
export function missingProblems(movies: MissingMovie[], episodes: MissingEpisode[], movieQueue: QueueRecord[], tvQueue: QueueRecord[]) {
  const downloadingMovies = new Set(movieQueue.map((q) => q.movieId))
  const downloadingEpisodes = new Set(tvQueue.map((q) => q.episodeId))
  const problems: Problem[] = movies
    .filter((m) => m.isAvailable && !downloadingMovies.has(m.id) && age(m.added) > FIRST_SEARCH)
    .map((m) => ({
      kind: 'Missing',
      service: 'radarr',
      title: `${m.title}${m.year ? ` (${m.year})` : ''}`,
      detail: 'No release found yet.',
      fix: 'search',
      ids: [m.id],
      poster: posterIn(m.images),
      media: { movieId: m.id },
    }))

  const seasons = new Map<string, MissingEpisode[]>()
  for (const e of episodes) {
    // A day's grace after airing: new episodes usually take hours to be released.
    if (downloadingEpisodes.has(e.id) || age(e.airDateUtc) < 24 * HOUR || age(e.series?.added) < FIRST_SEARCH) continue
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
      poster: posterIn(eps[0].series?.images),
      media: { seriesId: eps[0].seriesId, season: eps[0].seasonNumber },
    })
  }
  return problems
}

/** An audiobook Request still waiting with nothing downloading. An Edition has its narrator and last search. */
export type WaitingBook = { book: string; title: string; poster?: string | null; requestedAt: number; narrator?: string; search?: EditionSearch }

/** Missing = still nothing FIRST_SEARCH after the Request: an Edition whose last search grabbed nothing, or a book LazyLibrarian still wants. */
export function bookProblem(b: WaitingBook, now = Date.now()): Problem | undefined {
  if (now - b.requestedAt < FIRST_SEARCH) return
  const base = { kind: 'Missing' as const, title: b.title, fix: 'search' as const, ids: [], book: b.book, poster: b.poster }
  if (!b.narrator) return { ...base, service: 'lazylibrarian', detail: 'LazyLibrarian has found no release yet.' }
  const s = b.search
  if (!s || s.grabbed) return // not searched yet, or found
  const n = `${s.found} release${s.found === 1 ? '' : 's'}`
  const found =
    s.abb === 'failed'
      ? `AudioBook Bay didn't answer (${s.abbError}); Prowlarr found ${n}`
      : s.abbError
        ? `AudioBook Bay answered only partly (${s.abbError}); found ${n} in all`
        : `AudioBook Bay and Prowlarr found ${n}`
  const which = b.narrator.toLowerCase() === 'full cast' ? 'the Full Cast edition of this book' : `this book read by ${b.narrator}`
  const why = s.singles || s.packs ? `${s.singles + s.packs} looked like ${which}, but none could be sent to qBittorrent` : `none of ${which}`
  return { ...base, service: 'editions', detail: `${found}${s.abb === 'failed' ? ',' : ';'} ${why}.` }
}

/** A Request that hasn't started downloading or has stopped, and why, for the Admin view's Stuck list. */
export type Stuck = Omit<Problem, 'kind' | 'fix'> & { reason: string; fix?: Problem['fix']; by: string[] }

/** "25 min ago", "3 h ago", "2 days ago". */
export function ago(iso: string | number, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`
  return `${Math.round(minutes / 1440)} days ago`
}

/** "3 Dec", with the year when it isn't this one. */
export function day(iso: string, now = Date.now()) {
  const d = new Date(iso)
  const year = d.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year })
}

/** A movie Radarr wants and isn't downloading. */
export function movieStuck(m: MissingMovie, now = Date.now()): Stuck {
  const base = { service: 'radarr' as const, title: `${m.title}${m.year ? ` (${m.year})` : ''}`, ids: [m.id], poster: posterIn(m.images), by: [] }
  if (!m.isAvailable) {
    const future = (d?: string) => (d && Date.parse(d) > now ? d : undefined)
    const home = [future(m.digitalRelease), future(m.physicalRelease)].filter(Boolean).sort()[0]
    const detail = home
      ? `${home === m.digitalRelease ? 'Digital' : 'Disc'} release ${day(home, now)}`
      : future(m.inCinemas)
        ? `In cinemas ${day(m.inCinemas!, now)}`
        : m.inCinemas
          ? `In cinemas since ${day(m.inCinemas, now)}, no home release date yet`
          : 'No release date yet'
    return { ...base, reason: 'Not released yet', detail }
  }
  if (!m.lastSearchTime) return { ...base, reason: 'Searching', detail: `Not searched yet, added ${ago(m.added, now)}`, fix: 'search' }
  if (now - Date.parse(m.added) < FIRST_SEARCH) return { ...base, reason: 'Searching', detail: `Searched ${ago(m.lastSearchTime, now)}` }
  return { ...base, reason: 'Nothing found', detail: `No release found. Last searched ${ago(m.lastSearchTime, now)}`, fix: 'search' }
}

/** One season's aired episodes that Sonarr wants and isn't downloading. */
export function seasonStuck(eps: MissingEpisode[], now = Date.now()): Stuck {
  const e = eps[0]
  const base = {
    service: 'sonarr' as const,
    title: `${e.series?.title ?? 'Show'} · Season ${e.seasonNumber}`,
    ids: eps.map((x) => x.id),
    poster: posterIn(e.series?.images),
    by: [],
  }
  const count = `${eps.length} episode${eps.length > 1 ? 's' : ''}`
  const searched = eps
    .map((x) => x.lastSearchTime)
    .filter((t): t is string => !!t)
    .sort()
    .at(-1)
  // A day's grace after airing: new episodes usually take hours to be released.
  const fresh = eps.every((x) => now - Date.parse(x.airDateUtc ?? '') < 24 * HOUR) || now - Date.parse(e.series?.added ?? '') < FIRST_SEARCH
  if (fresh) return { ...base, reason: 'Searching', detail: `${count} aired recently; releases usually take a few hours` }
  return { ...base, reason: 'Nothing found', detail: `${count} with no release found${searched ? `. Last searched ${ago(searched, now)}` : ''}`, fix: 'search' }
}

/** Why a torrent isn't downloading, or undefined while it is (or it's checking its files, which ends by itself). */
export function torrentStuck(t: Torrent, now = Date.now()): { reason: string; detail: string } | undefined {
  const done = `${Math.floor(t.progress * 100)}%`
  const reason = stateLabel(t.state)
  if (t.state === 'metaDL' || t.state === 'forcedMetaDL') return { reason, detail: `No file list yet, added ${ago(t.added_on * 1000, now)}` }
  if (t.state === 'stalledDL')
    return { reason, detail: `${done} done, ${t.last_activity > 0 ? `last moved ${ago(t.last_activity * 1000, now)}` : 'never moved'}, ${t.num_seeds} seeders` }
  if (t.state === 'queuedDL') return { reason, detail: `Waiting behind other downloads at ${done}` }
  if (t.state === 'stoppedDL' || t.state === 'pausedDL') return { reason, detail: `Paused at ${done}` }
  if (t.state === 'error') return { reason, detail: 'qBittorrent reports an error. Its log (Tools → Execution Log) says why.' }
  if (t.state === 'missingFiles') return { reason, detail: 'Its files are missing from the disk.' }
}
