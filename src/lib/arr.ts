import { editionOf } from './bookrules'
import { audiobookStatuses, lookupBook, searchAudiobooks } from './books'
import { editionStatuses } from './editions'
import { seasonsOf, type MediaType, type RequestRow } from './db'
import { deleteTorrents, liveProgress } from './qbit'
import { titleInfo, type Credit, type Lookup, type TitleInfo } from './titlerules'
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

type Field = { name: string; value?: unknown }
type Condition = { implementation: string; name: string; negate?: boolean; values: Record<string, unknown> }

/**
 * Creates or updates the custom format `name` (a release must meet every condition) and gives it `score` in every
 * quality profile. No conditions deletes it. Conditions come from the Service's own schema, like ensureProvider.
 */
export async function setCustomFormat(svc: 'radarr' | 'sonarr', name: string, score: number, conditions: Condition[]) {
  const existing = (await arr<{ id: number; name: string }[]>(svc, '/customformat')).find((f) => f.name === name)
  if (!conditions.length) {
    if (existing) await arr(svc, `/customformat/${existing.id}`, 'DELETE')
    return
  }
  const schema = await arr<{ implementation: string; fields: Field[] }[]>(svc, '/customformat/schema')
  const specifications = conditions.map((c) => {
    const spec = schema.find((s) => s.implementation === c.implementation)
    if (!spec) throw new Error(`${svc}'s custom formats have no ${c.implementation} condition`)
    const fields = spec.fields.map((f) => (f.name in c.values ? { ...f, value: c.values[f.name] } : f))
    return { ...spec, name: c.name, negate: c.negate ?? false, required: true, fields }
  })
  const body = { name, includeCustomFormatWhenRenaming: false, specifications }
  const format = existing
    ? await arr<{ id: number }>(svc, `/customformat/${existing.id}`, 'PUT', { ...body, id: existing.id })
    : await arr<{ id: number }>(svc, '/customformat', 'POST', body)

  type Profile = { id: number; formatItems: { format: number; name: string; score: number }[] }
  for (const profile of await arr<Profile[]>(svc, '/qualityprofile')) {
    const formatItems = [...profile.formatItems.filter((i) => i.format !== format.id), { format: format.id, name, score }]
    await arr(svc, `/qualityprofile/${profile.id}`, 'PUT', { ...profile, formatItems })
  }
}

type Image = { coverType: string; remoteUrl?: string }
export type Media = { title: string; year?: number; overview?: string; images?: Image[] }
type LookupMovie = Media & { tmdbId: number }
type LookupSeries = Media & { tvdbId: number; seasons: Season[] }
type LibraryMovie = LookupMovie & Movie & { monitored: boolean }
type LibrarySeries = LookupSeries & Series

export type SearchResult = {
  /** TMDB id (movie), TVDB id (TV) or LazyLibrarian's BookID (audiobook). */
  id: number | string
  title: string
  year?: number
  overview?: string
  poster?: string
  seasons: number[]
  requestedSeasons: number[]
  status: Status | null
}

/** The title's own details (overview, ratings, cast…) from Radarr's, Sonarr's or OpenLibrary's records; undefined if it fails. */
export async function lookupTitle(type: MediaType, id: number | string): Promise<TitleInfo | undefined> {
  try {
    if (type === 'audiobook') {
      const e = editionOf(id)
      return await lookupBook(e?.bookId ?? String(id), e?.edition)
    }
    if (type === 'movie') {
      const movie = await arr<Lookup>('radarr', `/movie/lookup/tmdb?tmdbId=${id}`)
      // Radarr keeps the cast for movies in its library, which a Request puts it in; a movie removed since just has none.
      const library = await libraryMovie(Number(id)).catch(() => undefined)
      const credits = library && (await arr<Credit[]>('radarr', `/credit?movieId=${(library as { id?: number }).id}`).catch(() => undefined))
      return titleInfo('movie', movie, credits || undefined)
    }
    return titleInfo('tv', (await arr<Lookup[]>('sonarr', `/series/lookup?term=tvdb:${id}`))[0])
  } catch (e) {
    console.error(e)
  }
}

export const posterOf = (media: Media) => media.images?.find((i) => i.coverType === 'poster')?.remoteUrl

const libraryMovie = async (tmdbId: number) => (await arr<LibraryMovie[]>('radarr', `/movie?tmdbId=${tmdbId}`))[0]
export const librarySeries = async (tvdbId: number) => (await arr<LibrarySeries[]>('sonarr', `/series?tvdbId=${tvdbId}`))[0]
export type QueueRecord = QueueItem & {
  id: number
  title: string
  status?: string
  trackedDownloadStatus?: string
  trackedDownloadState?: string
  statusMessages?: { title: string; messages: string[] }[]
  errorMessage?: string
  downloadId?: string
  episodeId?: number
  seasonNumber?: number
  movie?: { title: string; year?: number; tmdbId?: number; images?: Image[] }
  series?: { title: string; year?: number; tvdbId?: number; titleSlug?: string; images?: Image[] }
}

/** The Service's download queue, with progress replaced by qBittorrent's live numbers where it has them. */
export async function queueOf(name: 'radarr' | 'sonarr'): Promise<QueueRecord[]> {
  const [queue, live] = await Promise.all([
    arr<{ records: QueueRecord[] }>(name, `/queue?pageSize=1000${name === 'radarr' ? '&includeMovie=true' : '&includeSeries=true'}`),
    liveProgress().catch(() => new Map()), // qBittorrent unreachable: fall back to the Service's minute-old numbers
  ])
  return queue.records.map((r) => ({ ...r, ...live.get(r.downloadId?.toUpperCase() ?? '') }))
}

/** Blocklists a release so it's never grabbed again, removes it from qBittorrent, and has the Service look for another. */
export const retryRelease = (name: 'radarr' | 'sonarr', queueIds: number[]) =>
  arr(name, '/queue/bulk?removeFromClient=true&blocklist=true&skipRedownload=false', 'DELETE', { ids: queueIds })
const seasonNumbers = (seasons: Season[], only = (_: Season) => true) =>
  seasons.filter((s) => s.seasonNumber > 0 && only(s)).map((s) => s.seasonNumber)

async function qualityProfile(name: 'radarr' | 'sonarr') {
  const profiles = await arr<{ id: number; name: string }[]>(name, '/qualityprofile')
  return (profiles.find((p) => p.name === 'HD-1080p') ?? profiles[0]).id
}

// shortcut: one library lookup per result/Request; fine at family scale, batch it if Requests reach the hundreds.
export async function search(type: MediaType, term: string): Promise<SearchResult[]> {
  if (type === 'audiobook') return searchAudiobooks(term)
  const q = encodeURIComponent(term)
  if (type === 'movie') {
    const [found, queue] = await Promise.all([arr<LookupMovie[]>('radarr', `/movie/lookup?term=${q}`), queueOf('radarr')])
    return movieResults(found.slice(0, 12), queue)
  }
  const [found, queue] = await Promise.all([arr<LookupSeries[]>('sonarr', `/series/lookup?term=${q}`), queueOf('sonarr')])
  return seriesResults(found.filter((s) => s.tvdbId > 0).slice(0, 12), queue)
}

/**
 * Results for titles found elsewhere (TMDB ids for movies, TVDB ids for TV), in the order given. A title Radarr or
 * Sonarr can't look up is left out.
 */
export async function searchIds(type: 'movie' | 'tv', ids: number[]): Promise<SearchResult[]> {
  const queue = await queueOf(type === 'movie' ? 'radarr' : 'sonarr')
  const found = await Promise.all(
    ids.map((id) =>
      (type === 'movie'
        ? arr<LookupMovie>('radarr', `/movie/lookup/tmdb?tmdbId=${id}`)
        : arr<LookupSeries[]>('sonarr', `/series/lookup?term=tvdb:${id}`).then((s) => s[0])
      ).catch(() => undefined),
    ),
  )
  return type === 'movie'
    ? movieResults(found.filter((m) => m !== undefined) as LookupMovie[], queue)
    : seriesResults((found as (LookupSeries | undefined)[]).filter((s) => s && s.tvdbId > 0) as LookupSeries[], queue)
}

const card = (m: Media) => ({ title: m.title, year: m.year, overview: m.overview, poster: posterOf(m) })

function movieResults(found: LookupMovie[], queue: QueueRecord[]): Promise<SearchResult[]> {
  return Promise.all(
    found.map(async (m) => ({
      ...card(m),
      id: m.tmdbId,
      seasons: [],
      requestedSeasons: [],
      status: movieStatus(await libraryMovie(m.tmdbId), queue),
    })),
  )
}

function seriesResults(found: LookupSeries[], queue: QueueRecord[]): Promise<SearchResult[]> {
  return Promise.all(
    found.map(async (s) => {
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

/** A search result and which search found it. */
export type Found = { r: SearchResult; type: MediaType }

/** A title suggested under the search field as a person types. */
export type Suggestion = { type: MediaType; id: number | string; title: string; year?: number; poster?: string; status?: string }

/**
 * One Media Type, or 'all' of them at once, each search's best hit in turn so no Media Type is buried under another's.
 * A search that is down only drops its own results; `found` is undefined only when every one is down.
 */
export async function searchMany(mode: MediaType | 'all', term: string): Promise<{ found?: Found[]; down: MediaType[] }> {
  const types: MediaType[] = mode === 'all' ? ['movie', 'tv', 'audiobook'] : [mode]
  const settled = await Promise.allSettled(types.map((t) => search(t, term)))
  settled.forEach((r) => r.status === 'rejected' && console.error(r.reason))
  const down = types.filter((_, i) => settled[i].status === 'rejected')
  if (down.length === types.length) return { down }
  const lists = settled.map((r, i) => (r.status === 'fulfilled' ? r.value.map((result) => ({ r: result, type: types[i] })) : []))
  const longest = Math.max(...lists.map((l) => l.length))
  return { found: Array.from({ length: longest }, (_, i) => lists.flatMap((l) => l[i] ?? [])).flat(), down }
}

export type RequestDetails = { status: Status | null; seasons: number[]; bytes: number }

/**
 * Live status per Request (null = no longer in Radarr/Sonarr), for TV every season the show has, and the space its
 * files take. Same order as `requests`.
 */
export async function requestDetails(requests: RequestRow[]): Promise<RequestDetails[]> {
  if (!requests.length) return []
  const ids = (edition: boolean) =>
    requests.filter((r) => r.media_type === 'audiobook' && !!editionOf(r.external_id) === edition).map((r) => String(r.external_id))
  const [books, editions] = [ids(false), ids(true)]
  const [movieQueue, tvQueue, bookStatuses, editionStatus] = await Promise.all([
    queueOf('radarr'),
    queueOf('sonarr'),
    audiobookStatuses(books),
    editionStatuses(editions).catch(() => []), // qBittorrent down: no status, the rest still shows
  ])
  return Promise.all(
    requests.map(async (r) => {
      if (editionOf(r.external_id))
        return {
          status: r.status === 'available' ? { label: 'Available' } : (editionStatus[editions.indexOf(String(r.external_id))] ?? null),
          seasons: [],
          bytes: 0,
        }
      if (r.media_type === 'audiobook')
        // Available in Arrmy but not in LazyLibrarian: Audiobookshelf already had it (see alreadyOwned in books.ts).
        return {
          status: r.status === 'available' ? { label: 'Available' } : (bookStatuses[books.indexOf(String(r.external_id))] ?? null),
          seasons: [],
          bytes: 0,
        }
      if (r.media_type === 'movie') {
        const movie = await libraryMovie(Number(r.external_id))
        return { status: movieStatus(movie, movieQueue), seasons: [], bytes: movie?.sizeOnDisk ?? 0 }
      }
      const series = await librarySeries(Number(r.external_id))
      const requested = series?.seasons.filter((s) => seasonsOf(r).includes(s.seasonNumber)) ?? []
      return {
        status: seriesStatus(series, tvQueue, seasonsOf(r)),
        seasons: series ? seasonNumbers(series.seasons) : [],
        bytes: requested.reduce((n, s) => n + (s.statistics?.sizeOnDisk ?? 0), 0),
      }
    }),
  )
}

type History = { downloadId?: string; episode?: { seasonNumber: number } }
const torrentsIn = (history: History[], only = (_: History) => true) => [
  ...new Set(history.filter((h) => h.downloadId && only(h)).map((h) => h.downloadId!)),
]

/** Stops Radarr looking for the movie and deletes its file, torrent and downloaded data. Nothing downloaded = just cancelled. */
export async function removeMovie(tmdbId: number) {
  const movie = await libraryMovie(tmdbId)
  if (!movie) return
  const history = await arr<History[]>('radarr', `/history/movie?movieId=${movie.id}`) // read before the movie (and its history) is gone
  await arr('radarr', `/movie/${movie.id}?deleteFiles=true&addImportExclusion=false`, 'DELETE')
  await deleteTorrents(torrentsIn(history))
}

/** Same for some seasons of a show; when no monitored season is left, the whole show goes. */
export async function removeSeasons(tvdbId: number, seasons: number[]) {
  const series = await librarySeries(tvdbId)
  if (!series || !seasons.length) return
  const history = await arr<History[]>('sonarr', `/history/series?seriesId=${series.id}&includeEpisode=true`)
  const torrents = torrentsIn(history, (h) => seasons.includes(h.episode?.seasonNumber ?? -1))
  const left = seasonNumbers(series.seasons, (s) => s.monitored && !seasons.includes(s.seasonNumber))

  if (!left.length) {
    await arr('sonarr', `/series/${series.id}?deleteFiles=true&addImportListExclusion=false`, 'DELETE')
  } else {
    // Unmonitor before deleting, or Sonarr downloads the episodes again.
    const unmonitor = (s: Season) => (seasons.includes(s.seasonNumber) ? { ...s, monitored: false } : s)
    await arr('sonarr', `/series/${series.id}`, 'PUT', { ...series, seasons: series.seasons.map(unmonitor) })
    const files = await arr<{ id: number; seasonNumber: number }[]>('sonarr', `/episodefile?seriesId=${series.id}`)
    const ids = files.filter((f) => seasons.includes(f.seasonNumber)).map((f) => f.id)
    if (ids.length) await arr('sonarr', '/episodefile/bulk', 'DELETE', { episodeFileIds: ids })
  }
  await deleteTorrents(torrents)
}

/** Adds the movie, or monitors it again. `search`: Radarr's id of a movie that now needs searching (see searchMovie). */
export async function addMovie(tmdbId: number): Promise<{ movie: Media; search?: number }> {
  const existing = await libraryMovie(tmdbId)
  if (existing) {
    if (existing.monitored) return { movie: existing }
    await arr('radarr', `/movie/${existing.id}`, 'PUT', { ...existing, monitored: true })
    return { movie: existing, search: existing.id }
  }
  const movie = await arr<LookupMovie>('radarr', `/movie/lookup/tmdb?tmdbId=${tmdbId}`)
  const added = await arr<{ id: number }>('radarr', '/movie', 'POST', {
    ...movie,
    qualityProfileId: await qualityProfile('radarr'),
    rootFolderPath: MOVIES_ROOT,
    monitored: true,
    minimumAvailability: 'released',
    addOptions: { searchForMovie: false }, // Arrmy searches, so the Request Log sees every release
  })
  return { movie, search: added.id }
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
