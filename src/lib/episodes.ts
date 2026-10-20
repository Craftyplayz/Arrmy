// A TV Request file by file: Sonarr says which episodes are imported and which torrent has the rest,
// qBittorrent says how far each file in that torrent has got.
import { arr, librarySeries, queueOf } from './arr'
import { seasonsOf, type RequestRow } from './db'
import { torrentFiles, type TorrentFile } from './qbit'

export type EpisodeRow = {
  season: number
  episode: number
  title: string
  /** The file's name once it's imported or in a torrent; the release name when the torrent's file can't be told apart. */
  file?: string
  /** 0 to 100 */
  progress: number
  state: string
}

type Episode = {
  id: number
  seasonNumber: number
  episodeNumber: number
  title: string
  hasFile: boolean
  episodeFileId: number
  airDateUtc?: string
}

/** Sonarr's queue status in words. Anything else is downloading. */
const STATES: Record<string, string> = {
  queued: 'Queued',
  delay: 'Queued',
  paused: 'Paused',
  warning: 'Stalled',
  failed: 'Failed',
  completed: 'Importing',
}

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path
/** "Show.S02E03.1080p.mkv" → "2x3" */
const episodeKey = (name: string) => name.match(/S(\d+)E(\d+)/i)?.slice(1).map(Number).join('x')

// shortcut: never cleared; a few hundred file names a year is nothing, cap it if that changes.
const parsed = new Map<string, number[]>()
/**
 * Episode ids in a file name, from Sonarr's own parser: it reads 1x03, anime's absolute numbers, daily shows and
 * double episodes. A name always means the same episodes, so each is asked once.
 */
async function parsedEpisodes(name: string): Promise<number[]> {
  if (!parsed.has(name)) {
    const res = await arr<{ episodes?: { id: number }[] }>('sonarr', `/parse?title=${encodeURIComponent(name)}`)
    parsed.set(name, res.episodes?.map((e) => e.id) ?? [])
  }
  return parsed.get(name)!
}

/** Every episode of the Request's seasons, in order, including ones not downloaded or not aired yet. */
export async function episodeRows(r: RequestRow): Promise<EpisodeRow[]> {
  const series = await librarySeries(Number(r.external_id))
  if (!series) return []
  const [episodes, files, queue] = await Promise.all([
    arr<Episode[]>('sonarr', `/episode?seriesId=${series.id}`),
    arr<{ id: number; relativePath: string }[]>('sonarr', `/episodefile?seriesId=${series.id}`),
    queueOf('sonarr'),
  ])
  const fileName = new Map(files.map((f) => [f.id, baseName(f.relativePath)]))
  const queued = new Map(queue.filter((q) => q.seriesId === series.id && q.episodeId).map((q) => [q.episodeId!, q]))
  const hashes = [...new Set([...queued.values()].map((q) => q.downloadId ?? ''))].filter(Boolean)
  // qBittorrent unreachable: fall back to each torrent's overall progress
  const inTorrent = new Map(await Promise.all(hashes.map(async (h) => [h, await torrentFiles(h).catch(() => [])] as const)))

  // Which file in each torrent is which episode: a quick S01E03 check, else Sonarr's parser. A subtitle or sample
  // can name the same episode, so the biggest file wins.
  const idOf = new Map(episodes.map((e) => [`${e.seasonNumber}x${e.episodeNumber}`, e.id]))
  const fileOf = new Map<string, TorrentFile>() // `${hash} ${episode id}`
  for (const [hash, all] of inTorrent) {
    const ids = await Promise.all(
      all.map((f) => {
        const id = idOf.get(episodeKey(baseName(f.name)) ?? '')
        return id ? [id] : parsedEpisodes(baseName(f.name)).catch(() => [])
      }),
    )
    all.forEach((f, i) => {
      for (const id of ids[i]) {
        const key = `${hash} ${id}`
        if ((fileOf.get(key)?.size ?? -1) < f.size) fileOf.set(key, f)
      }
    })
  }

  const seasons = seasonsOf(r)
  return episodes
    .filter((e) => seasons.includes(e.seasonNumber))
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)
    .map((e) => {
      const row = { season: e.seasonNumber, episode: e.episodeNumber, title: e.title }
      if (e.hasFile) return { ...row, file: fileName.get(e.episodeFileId), progress: 100, state: 'Available' }
      const q = queued.get(e.id)
      if (!q) {
        const aired = e.airDateUtc && Date.parse(e.airDateUtc) < Date.now()
        return { ...row, progress: 0, state: aired ? 'Waiting for a release' : 'Not aired yet' }
      }
      // The episode's own file in the torrent, or the only big file when the torrent is just this episode.
      const all = inTorrent.get(q.downloadId ?? '') ?? []
      const single = queue.filter((x) => x.downloadId === q.downloadId).length === 1
      const file =
        fileOf.get(`${q.downloadId} ${e.id}`) ?? (single ? all.reduce((a, b) => (b.size > a.size ? b : a), all[0]) : undefined)
      const progress = Math.floor(file ? file.progress * 100 : q.size ? ((q.size - q.sizeleft) / q.size) * 100 : 0)
      const state = progress === 100 && q.status !== 'completed' ? 'Downloaded' : (STATES[q.status ?? ''] ?? 'Downloading')
      return { ...row, file: file ? baseName(file.name) : q.title, progress, state }
    })
}
