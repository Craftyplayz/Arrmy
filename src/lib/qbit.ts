// Talks to qBittorrent directly: live progress (Radarr and Sonarr only refresh theirs once a minute) and deleting torrents.
import type { Torrent } from './problems'

const QBIT_URL = process.env.QBIT_URL ?? 'http://gluetun:8080'
let sid: string | undefined

async function login() {
  const res = await fetch(`${QBIT_URL}/api/v2/auth/login`, {
    method: 'POST',
    body: new URLSearchParams({ username: 'admin', password: process.env.QBIT_PASSWORD ?? '' }),
    cache: 'no-store',
  })
  // qBittorrent 5 names the cookie after its port (QBT_SID_8080); older versions call it SID.
  sid = res.headers.getSetCookie().find((c) => /^(QBT_)?SID(_\d+)?=/.test(c))?.split(';')[0]
  if (!sid) throw new Error(`qBittorrent login → ${res.status}`)
}

export async function qbit(path: string, body?: URLSearchParams, retry = true): Promise<Response> {
  if (!sid) await login()
  const res = await fetch(`${QBIT_URL}/api/v2${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Cookie: sid! },
    body,
    cache: 'no-store',
  })
  if (res.status === 403 && retry) {
    sid = undefined // session expired or qBittorrent restarted
    return qbit(path, body, false)
  }
  if (!res.ok) throw new Error(`qBittorrent ${path} → ${res.status}`)
  return res
}

export const torrents = async (): Promise<Torrent[]> => (await qbit('/torrents/info')).json()

/** Size and bytes left per torrent hash (uppercase, as Radarr/Sonarr store it in downloadId). */
export async function liveProgress(): Promise<Map<string, { size: number; sizeleft: number }>> {
  const torrents: { hash: string; size: number; amount_left: number }[] = await (await qbit('/torrents/info')).json()
  return new Map(torrents.map((t) => [t.hash.toUpperCase(), { size: t.size, sizeleft: t.amount_left }]))
}

/** A file in a torrent, with progress from 0 to 1. `name` includes the torrent's folder. */
export type TorrentFile = { name: string; size: number; progress: number }
export const torrentFiles = async (hash: string): Promise<TorrentFile[]> =>
  (await qbit(`/torrents/files?hash=${hash.toLowerCase()}`)).json()

/** Total download and upload speed right now, in bytes per second. */
export async function transferSpeeds() {
  const t: { dl_info_speed: number; up_info_speed: number } = await (await qbit('/transfer/info')).json()
  return { down: t.dl_info_speed, up: t.up_info_speed }
}

/** Deletes torrents and their downloaded data. The library copy is a separate hardlink that Radarr/Sonarr delete. */
export async function deleteTorrents(hashes: string[]) {
  if (!hashes.length) return
  await qbit('/torrents/delete', new URLSearchParams({ hashes: hashes.join('|').toLowerCase(), deleteFiles: 'true' }))
}
