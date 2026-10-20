// The Request Log's follow-ups. Radarr and Sonarr report grabs and imports through the webhook (api/hooks/arr); this
// watch adds what happens in between and after: the download finishing (with its speeds), a copy of each .torrent so
// its link outlives the torrent, and the moment the title shows up in Plex.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { addLog, getSetting, recentLog } from './db'
import type { Grabbed, Imported } from './logrules'
import { plex, PLEX_URL } from './plex'
import { qbit, torrents } from './qbit'

/** Where .torrent copies live: next to Arrmy's database, in the config folder that's backed up. */
export const torrentFile = (hash: string) => join(dirname(process.env.DB_PATH ?? '/config/arrmy.db'), 'torrents', `${hash.toLowerCase()}.torrent`)

async function saveTorrent(hash: string) {
  const file = torrentFile(hash)
  if (existsSync(file)) return
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, Buffer.from(await (await qbit(`/torrents/export?hash=${hash}`)).arrayBuffer()))
}

const peaks = new Map<string, { seeds: number; peers: number }>() // most seeders and peers seen, per download

/** Grabs still downloading: keep their .torrent, note their peak seeders and peers, and log when they finish. */
async function followDownloads() {
  const ended = new Set([...recentLog('downloaded', 14), ...recentLog('dead', 14)].map((e) => JSON.parse(e.detail).downloadId))
  const open = recentLog('grabbed', 14).filter((e) => !ended.has(JSON.parse(e.detail).downloadId))
  if (!open.length) return
  const live = new Map((await torrents()).map((t) => [t.hash.toLowerCase(), t]))
  for (const e of open) {
    const g = JSON.parse(e.detail) as Grabbed
    const t = live.get(g.downloadId)
    if (!t) continue // not in qBittorrent yet, or removed
    await saveTorrent(g.downloadId).catch((err) => console.warn(`[log] .torrent of ${t.name}: ${(err as Error).message}`))
    const peak = peaks.get(g.downloadId) ?? { seeds: 0, peers: 0 }
    peaks.set(g.downloadId, { seeds: Math.max(peak.seeds, t.num_seeds), peers: Math.max(peak.peers, t.num_leechs) })
    // completion_on survives a restart's recheck, when progress can briefly read under 100%.
    if (t.progress < 1 && !(t.completion_on > 0)) continue
    const finished = t.completion_on > 0 ? t.completion_on : Date.now() / 1000
    addLog(e.item, 'downloaded', { downloadId: g.downloadId, seconds: Math.round(finished - t.added_on), size: t.size, ...peaks.get(g.downloadId), seasons: g.seasons })
    peaks.delete(g.downloadId)
  }
}

type PlexItem = { ratingKey: string; Guid?: { id: string }[] }
type Section = { key: string; type: string }

/** Imports not yet in Plex: logged as playable once Plex lists the movie, or every season of the show. */
async function followImports() {
  const token = getSetting<string>('plexToken') // kept when the Admin signs in
  if (!token) return
  const shown = new Set(recentLog('playable', 7).map((e) => `${e.item}:${JSON.parse(e.detail).seasons ?? ''}`))
  const pending = recentLog('imported', 7).filter((e) => !e.item.startsWith('audiobook:') && !shown.has(`${e.item}:${JSON.parse(e.detail).seasons ?? ''}`))
  if (!pending.length) return
  const sections = (await plex<{ MediaContainer: { Directory?: Section[] } }>(`${PLEX_URL}/library/sections`, token)).MediaContainer.Directory ?? []
  const all = async (type: string) =>
    (
      await Promise.all(
        sections
          .filter((s) => s.type === type)
          .map(async (s) => (await plex<{ MediaContainer: { Metadata?: PlexItem[] } }>(`${PLEX_URL}/library/sections/${s.key}/all?includeGuids=1`, token)).MediaContainer.Metadata ?? []),
      )
    ).flat()
  const [movies, shows] = await Promise.all([all('movie'), all('show')])
  const find = (items: PlexItem[], guid: string) => items.find((i) => i.Guid?.some((g) => g.id === guid))

  const logged = new Set<string>()
  for (const e of pending) {
    const d = JSON.parse(e.detail) as Imported
    const key = `${e.item}:${d.seasons ?? ''}`
    if (logged.has(key)) continue // one show can have several imports for the same season
    const [type, id] = e.item.split(':')
    let playable = false
    if (type === 'movie') playable = !!find(movies, `tmdb://${id}`)
    else {
      const show = find(shows, `tvdb://${id}`)
      if (show) {
        const seasons = await plex<{ MediaContainer: { Metadata?: { index: number }[] } }>(`${PLEX_URL}/library/metadata/${show.ratingKey}/children`, token)
        const have = new Set(seasons.MediaContainer.Metadata?.map((s) => s.index))
        playable = (d.seasons ?? []).every((s) => have.has(s))
      }
    }
    if (!playable) continue
    addLog(e.item, 'playable', { app: 'Plex', seasons: d.seasons })
    logged.add(key)
  }
}

export function startRequestLogWatch() {
  let running = false
  setInterval(async () => {
    if (running) return
    running = true
    for (const [name, step] of [['downloads', followDownloads], ['Plex', followImports]] as const)
      await step().catch((e) => console.warn(`[log] ${name}: ${(e as Error).message}`))
    running = false
  }, 30_000)
}
