// Live download progress straight from qBittorrent: Radarr and Sonarr only refresh theirs once a minute.

const QBIT_URL = process.env.QBIT_URL ?? 'http://gluetun:8080'
let sid: string | undefined

async function login() {
  const res = await fetch(`${QBIT_URL}/api/v2/auth/login`, {
    method: 'POST',
    body: new URLSearchParams({ username: 'admin', password: process.env.QBIT_PASSWORD ?? '' }),
    cache: 'no-store',
  })
  sid = res.headers.getSetCookie().find((c) => c.startsWith('SID='))?.split(';')[0]
  if (!sid) throw new Error(`qBittorrent login → ${res.status}`)
}

/** Size and bytes left per torrent hash (uppercase, as Radarr/Sonarr store it in downloadId). */
export async function liveProgress(retry = true): Promise<Map<string, { size: number; sizeleft: number }>> {
  if (!sid) await login()
  const res = await fetch(`${QBIT_URL}/api/v2/torrents/info`, { headers: { Cookie: sid! }, cache: 'no-store' })
  if (res.status === 403 && retry) {
    sid = undefined // session expired or qBittorrent restarted
    return liveProgress(false)
  }
  if (!res.ok) throw new Error(`qBittorrent torrents → ${res.status}`)
  const torrents: { hash: string; size: number; amount_left: number }[] = await res.json()
  return new Map(torrents.map((t) => [t.hash.toUpperCase(), { size: t.size, sizeleft: t.amount_left }]))
}
