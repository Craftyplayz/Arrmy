import type { MediaType, RequestRow } from './db'
import { movieStatus, seriesStatus, type Movie, type QueueItem, type Season, type Series, type Status } from './status'

export const MOVIES_ROOT = '/data/media/movies'
export const TV_ROOT = '/data/media/tv'

const services = {
  radarr: { url: process.env.RADARR_URL ?? 'http://radarr:7878', key: process.env.RADARR_API_KEY, api: 'v3' },
  sonarr: { url: process.env.SONARR_URL ?? 'http://sonarr:8989', key: process.env.SONARR_API_KEY, api: 'v3' },
  prowlarr: { url: process.env.PROWLARR_URL ?? 'http://prowlarr:9696', key: process.env.PROWLARR_API_KEY, api: 'v1' },
}
export type ServiceName = keyof typeof services
export const serviceUrl = (name: ServiceName) => services[name].url
export const serviceKey = (name: ServiceName) => services[name].key ?? ''

/** Calls a Service's API; throws with the Service's own error text on any non-2xx. */
export async function arr<T = unknown>(name: ServiceName, path: string, method = 'GET', body?: unknown): Promise<T> {
  const { url, key, api } = services[name]
  const res = await fetch(`${url}/api/${api}${path}`, {
    method,
    headers: { 'X-Api-Key': key ?? '', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${name} ${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : undefined) as T
}

type Image = { coverType: string; remoteUrl?: string }
export type Media = { title: string; year?: number; overview?: string; images?: Image[] }
type LookupMovie = Media & { tmdbId: number }
type LookupSeries = Media & { tvdbId: number; seasons: Season[] }
type LibraryMovie = LookupMovie & Movie & { monitored: boolean }
type LibrarySeries = LookupSeries & Series

export type SearchResult = {
  id: number
  title: string
  year?: number
  overview?: string
  poster?: string
  seasons: number[]
  requestedSeasons: number[]
  status: Status | null
}

export const posterOf = (media: Media) => media.images?.find((i) => i.coverType === 'poster')?.remoteUrl

const libraryMovie = async (tmdbId: number) => (await arr<LibraryMovie[]>('radarr', `/movie?tmdbId=${tmdbId}`))[0]
const librarySeries = async (tvdbId: number) => (await arr<LibrarySeries[]>('sonarr', `/series?tvdbId=${tvdbId}`))[0]
const queueOf = async (name: 'radarr' | 'sonarr') =>
  (await arr<{ records: QueueItem[] }>(name, '/queue?pageSize=1000')).records
const seasonNumbers = (seasons: Season[], only = (_: Season) => true) =>
  seasons.filter((s) => s.seasonNumber > 0 && only(s)).map((s) => s.seasonNumber)

async function qualityProfile(name: 'radarr' | 'sonarr') {
  const profiles = await arr<{ id: number; name: string }[]>(name, '/qualityprofile')
  return (profiles.find((p) => p.name === 'HD-1080p') ?? profiles[0]).id
}

// shortcut: one library lookup per result/Request; fine at family scale, batch it if Requests reach the hundreds.
export async function search(type: MediaType, term: string): Promise<SearchResult[]> {
  const q = encodeURIComponent(term)
  const card = (m: Media) => ({ title: m.title, year: m.year, overview: m.overview, poster: posterOf(m) })
  if (type === 'movie') {
    const [found, queue] = await Promise.all([arr<LookupMovie[]>('radarr', `/movie/lookup?term=${q}`), queueOf('radarr')])
    return Promise.all(
      found.slice(0, 12).map(async (m) => ({
        ...card(m),
        id: m.tmdbId,
        seasons: [],
        requestedSeasons: [],
        status: movieStatus(await libraryMovie(m.tmdbId), queue),
      })),
    )
  }
  const [found, queue] = await Promise.all([arr<LookupSeries[]>('sonarr', `/series/lookup?term=${q}`), queueOf('sonarr')])
  return Promise.all(
    found
      .filter((s) => s.tvdbId > 0)
      .slice(0, 12)
      .map(async (s) => {
        const existing = await librarySeries(s.tvdbId)
        return {
          ...card(s),
          id: s.tvdbId,
          seasons: seasonNumbers(s.seasons),
          requestedSeasons: existing ? seasonNumbers(existing.seasons, (x) => x.monitored) : [],
          status: seriesStatus(existing, queue),
        }
      }),
  )
}

/** Live status per Request, in the same order. null = no longer in Radarr/Sonarr. */
export async function requestStatuses(requests: RequestRow[]): Promise<(Status | null)[]> {
  if (!requests.length) return []
  const [movieQueue, tvQueue] = await Promise.all([queueOf('radarr'), queueOf('sonarr')])
  return Promise.all(
    requests.map(async (r) =>
      r.media_type === 'movie'
        ? movieStatus(await libraryMovie(r.external_id), movieQueue)
        : seriesStatus(await librarySeries(r.external_id), tvQueue, JSON.parse(r.seasons ?? '[]')),
    ),
  )
}

export async function addMovie(tmdbId: number): Promise<Media> {
  const existing = await libraryMovie(tmdbId)
  if (existing) {
    if (!existing.monitored) {
      await arr('radarr', `/movie/${existing.id}`, 'PUT', { ...existing, monitored: true })
      await arr('radarr', '/command', 'POST', { name: 'MoviesSearch', movieIds: [existing.id] })
    }
    return existing
  }
  const movie = await arr<LookupMovie>('radarr', `/movie/lookup/tmdb?tmdbId=${tmdbId}`)
  await arr('radarr', '/movie', 'POST', {
    ...movie,
    qualityProfileId: await qualityProfile('radarr'),
    rootFolderPath: MOVIES_ROOT,
    monitored: true,
    minimumAvailability: 'released',
    addOptions: { searchForMovie: true },
  })
  return movie
}

/** Adds the show if new, otherwise also monitors the extra seasons, then searches. */
export async function addSeries(tvdbId: number, seasons: number[]): Promise<Media> {
  const existing = await librarySeries(tvdbId)
  const series = existing ?? (await arr<LookupSeries[]>('sonarr', `/series/lookup?term=tvdb:${tvdbId}`))[0]
  if (!series) throw new Error(`No show with TVDB id ${tvdbId}`)
  const valid = seasonNumbers(series.seasons)
  if (seasons.some((n) => !valid.includes(n))) throw new Error(`Show ${tvdbId} has no season(s) ${seasons}`)
  const monitor = (s: Season) => ({ ...s, monitored: (!!existing && s.monitored) || seasons.includes(s.seasonNumber) })

  if (existing) {
    await arr('sonarr', `/series/${existing.id}`, 'PUT', { ...existing, monitored: true, seasons: existing.seasons.map(monitor) })
    await arr('sonarr', '/command', 'POST', { name: 'SeriesSearch', seriesId: existing.id })
  } else {
    await arr('sonarr', '/series', 'POST', {
      ...series,
      qualityProfileId: await qualityProfile('sonarr'),
      rootFolderPath: TV_ROOT,
      monitored: true,
      seasonFolder: true,
      seasons: series.seasons.map(monitor),
      addOptions: { ignoreEpisodesWithFiles: true, searchForMissingEpisodes: true },
    })
  }
  return series
}
