// The Admin view: Problems with one-click fixes, what's downloading, and library and disk stats.
import { arr, queueOf, type QueueRecord } from './arr'
import { keptDeadReleases } from './db'
import {
  byDownload,
  DEAD_DETAIL,
  missingProblems,
  nameOf,
  queueProblem,
  type Download,
  type MissingEpisode,
  type MissingMovie,
  type Problem,
  type Service,
} from './problems'
import { liveProgress, transferSpeeds } from './qbit'

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

  // The last of STRIKES dead releases in a row (see dead.ts), while it's still in qBittorrent.
  const dead = [...new Map(keptDeadReleases().map((d) => [d.hash, d])).values()].filter((d) => live.has(d.hash.toUpperCase()))
  const deadProblem = (service: Service, g: QueueRecord[]): Problem | undefined =>
    dead.some((d) => d.hash === g[0].downloadId?.toLowerCase())
      ? { kind: 'Failed Download', service, title: nameOf(g[0]), detail: DEAD_DETAIL, fix: 'retry', ids: g.map((r) => r.id) }
      : undefined
  const groups = [
    ...byDownload(movieQueue).map((g) => ({ service: 'radarr' as const, g })),
    ...byDownload(tvQueue).map((g) => ({ service: 'sonarr' as const, g })),
  ].map((d) => ({ ...d, problem: deadProblem(d.service, d.g) ?? queueProblem(d.service, d.g) }))
  const problems: Problem[] = [
    ...groups.flatMap((d) => (d.problem ? [d.problem] : [])),
    ...dead
      .filter((d) => d.item.startsWith('book:'))
      .map((d): Problem => ({ kind: 'Failed Download', service: 'lazylibrarian', title: d.title, detail: DEAD_DETAIL, fix: 'retry', ids: [], hash: d.hash })),
    ...missingProblems(missingMovies.records, missingEpisodes.records, movieQueue, tvQueue),
  ]
  const downloads: Download[] = groups
    .filter((d) => !d.problem)
    .map(({ g }) => ({ title: nameOf(g[0]), size: g[0].size, sizeleft: g[0].sizeleft }))

  const sum = <T>(list: T[], pick: (x: T) => number) => list.reduce((n, x) => n + pick(x), 0)
  const inLibrary = movies.filter((m) => m.hasFile)
  const shows = series.filter((s) => (s.statistics?.episodeFileCount ?? 0) > 0)
  return {
    problems,
    downloads,
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
