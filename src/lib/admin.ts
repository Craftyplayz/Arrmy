// The Admin view: Problems with one-click fixes, what's downloading, and library and disk stats.
import { arr, queueOf, type QueueRecord } from './arr'
import { coverUrl } from './bookrules'
import { CATEGORY_APPS, duration, size } from './botrules'
import { getDeadLimits, keptDeadReleases, requestsFor } from './db'
import { speed, type DownloadMeta } from './embeds'
import { downloadMeta } from './media'
import {
  byDownload,
  deadDetail,
  missingProblems,
  nameOf,
  posterIn,
  queueProblem,
  stateLabel,
  type MissingEpisode,
  type MissingMovie,
  type Problem,
  type Service,
  type Torrent,
} from './problems'
import { liveProgress, torrents, transferSpeeds } from './qbit'

export type { Problem } from './problems'

// shortcut: reads whole libraries and queues each time; fine for a family server, page them past a few thousand titles.
export async function adminOverview() {
  const [movieQueue, tvQueue, missingMovies, missingEpisodes, movies, series, disks, speeds, live] = await Promise.all([
    queueOf('radarr'),
    queueOf('sonarr'),
    arr<{ records: MissingMovie[] }>('radarr', '/wanted/missing?pageSize=500&monitored=true'),
    arr<{ records: MissingEpisode[] }>('sonarr', '/wanted/missing?pageSize=1000&monitored=true&includeSeries=true'),
    arr<{ hasFile: boolean; sizeOnDisk?: number }[]>('radarr', '/movie'),
    arr<{ statistics?: { episodeFileCount: number; sizeOnDisk: number } }[]>('sonarr', '/series'),
    arr<{ path: string; freeSpace: number; totalSpace: number }[]>('radarr', '/diskspace'),
    transferSpeeds().catch(() => undefined), // qBittorrent down: no speeds, everything else still shows
    liveProgress().catch(() => new Map<string, unknown>()),
  ])

  // The last of the Admin's allowed dead releases in a row (see dead.ts), while it's still in qBittorrent.
  const dead = [...new Map(keptDeadReleases().map((d) => [d.hash, d])).values()].filter((d) => live.has(d.hash.toUpperCase()))
  const strikes = getDeadLimits().strikes
  const deadProblem = (service: Service, g: QueueRecord[]): Problem | undefined =>
    dead.some((d) => d.hash === g[0].downloadId?.toLowerCase())
      ? { kind: 'Failed Download', service, title: nameOf(g[0]), detail: deadDetail(strikes), fix: 'retry', ids: g.map((r) => r.id), poster: posterIn(g[0].movie?.images ?? g[0].series?.images) }
      : undefined
  const groups = [
    ...byDownload(movieQueue).map((g) => ({ service: 'radarr' as const, g })),
    ...byDownload(tvQueue).map((g) => ({ service: 'sonarr' as const, g })),
  ].map((d) => ({ ...d, problem: deadProblem(d.service, d.g) ?? queueProblem(d.service, d.g) }))
  const problems: Problem[] = [
    ...groups.flatMap((d) => (d.problem ? [d.problem] : [])),
    ...dead
      .filter((d) => d.item.startsWith('book:'))
      .map((d): Problem => {
        const book = d.item.replace('book:', '')
        const poster = requestsFor('audiobook', book)[0]?.poster ?? coverUrl(undefined, book)
        return { kind: 'Failed Download', service: 'lazylibrarian', title: d.title, detail: deadDetail(strikes), fix: 'retry', ids: [], hash: d.hash, poster }
      }),
    ...missingProblems(missingMovies.records, missingEpisodes.records, movieQueue, tvQueue),
  ]

  const sum = <T>(list: T[], pick: (x: T) => number) => list.reduce((n, x) => n + pick(x), 0)
  const inLibrary = movies.filter((m) => m.hasFile)
  const shows = series.filter((s) => (s.statistics?.episodeFileCount ?? 0) > 0)
  return {
    problems,
    speeds,
    library: {
      movies: inLibrary.length,
      movieBytes: sum(inLibrary, (m) => m.sizeOnDisk ?? 0),
      shows: shows.length,
      episodes: sum(shows, (s) => s.statistics?.episodeFileCount ?? 0),
      showBytes: sum(shows, (s) => s.statistics?.sizeOnDisk ?? 0),
    },
    disks: {
      media: disks.find((d) => d.path === '/data'),
      settings: disks.find((d) => d.path === '/config'),
    },
  }
}

/** A download in the Admin view, read live from qBittorrent and ready to show. */
export type LiveDownload = {
  hash: string
  title: string
  /** The release name, when the title came from Radarr, Sonarr or LazyLibrarian. */
  release?: string
  poster?: string | null
  by: string[]
  percent: number
  /** "1.2 GB of 4.5 GB" */
  done: string
  state: string
  speed?: string
  eta?: string
  seeds: number
  peers: number
}

// What each torrent is for, kept for as long as Arrmy runs; one not known yet is asked about at most every 30 seconds,
// so polling every few seconds doesn't ask Radarr, Sonarr and LazyLibrarian each time.
const metas = new Map<string, DownloadMeta>()
const asked = new Map<string, number>()

/** What each torrent is for (by lowercase hash), from the cache, asking about new ones. */
export async function metaFor(list: Torrent[]) {
  const now = Date.now()
  const unknown = list.filter((t) => !metas.has(t.hash.toLowerCase()) && now - (asked.get(t.hash.toLowerCase()) ?? 0) > 30_000)
  if (unknown.length) {
    unknown.forEach((t) => asked.set(t.hash.toLowerCase(), now))
    for (const [hash, meta] of await downloadMeta(unknown).catch(() => new Map<string, DownloadMeta>())) metas.set(hash, meta)
  }
  return metas
}

/** Torrents Radarr, Sonarr and LazyLibrarian are downloading. */
export const unfinished = async () =>
  // completion_on: a finished torrent can read under 100% while qBittorrent rechecks it after a restart.
  (await torrents()).filter((t) => t.category in CATEGORY_APPS && t.progress < 1 && !(t.completion_on > 0))

/** Everything Radarr, Sonarr and LazyLibrarian are downloading, oldest first. */
export async function liveDownloads(): Promise<LiveDownload[]> {
  const list = await unfinished()
  await metaFor(list)
  return list
    .sort((a, b) => a.added_on - b.added_on)
    .map((t) => {
      const meta = metas.get(t.hash.toLowerCase())
      const moving = t.dlspeed > 0
      return {
        hash: t.hash.toLowerCase(),
        title: meta?.title ?? t.name,
        release: meta ? t.name : undefined,
        poster: meta?.art,
        by: meta?.by ?? [],
        percent: Math.floor(t.progress * 100),
        done: `${size(t.size * t.progress)} of ${size(t.size)}`,
        state: stateLabel(t.state),
        speed: moving ? speed(t.dlspeed) : undefined,
        eta: moving && t.eta < 8_640_000 ? duration(t.eta) : undefined, // 8640000 is qBittorrent's "never"
        seeds: t.num_seeds,
        peers: t.num_leechs,
      }
    })
}
