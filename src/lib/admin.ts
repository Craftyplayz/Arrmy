// The Admin view: Problems with one-click fixes, what's downloading, and library and disk stats.
import { arr, queueOf } from './arr'
import { byDownload, missingProblems, nameOf, queueProblem, type Download, type MissingEpisode, type MissingMovie } from './problems'
import { transferSpeeds } from './qbit'

export type { Problem } from './problems'

// shortcut: reads whole libraries and queues each time; fine for a family server, page them past a few thousand titles.
export async function adminOverview() {
  const [movieQueue, tvQueue, missingMovies, missingEpisodes, movies, series, disks, speeds] = await Promise.all([
    queueOf('radarr'),
    queueOf('sonarr'),
    arr<{ records: MissingMovie[] }>('radarr', '/wanted/missing?pageSize=500&monitored=true'),
    arr<{ records: MissingEpisode[] }>('sonarr', '/wanted/missing?pageSize=1000&monitored=true&includeSeries=true'),
    arr<{ hasFile: boolean; sizeOnDisk?: number }[]>('radarr', '/movie'),
    arr<{ statistics?: { episodeFileCount: number; sizeOnDisk: number } }[]>('sonarr', '/series'),
    arr<{ path: string; freeSpace: number; totalSpace: number }[]>('radarr', '/diskspace'),
    transferSpeeds().catch(() => undefined), // qBittorrent down: no speeds, everything else still shows
  ])

  const groups = [
    ...byDownload(movieQueue).map((g) => ({ service: 'radarr' as const, g })),
    ...byDownload(tvQueue).map((g) => ({ service: 'sonarr' as const, g })),
  ].map((d) => ({ ...d, problem: queueProblem(d.service, d.g) }))
  const problems = [
    ...groups.flatMap((d) => (d.problem ? [d.problem] : [])),
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
