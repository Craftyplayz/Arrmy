// autobrr (https://autobrr.com): grabs releases the moment a tracker announces them on IRC. Its API key can't be
// preset, so the first time Arrmy finds it with no account it makes one (admin / QBIT_PASSWORD, like LazyLibrarian)
// and an API key, kept in Arrmy's settings. IRC networks, indexers and filters stay the Admin's own.
import { getSetting, setSetting } from './db'
import { serviceKey, serviceUrl } from './arr'

export const AUTOBRR_URL = process.env.AUTOBRR_URL ?? 'http://autobrr:7474'
const KEY = 'autobrr:key'

const cookies = (res: Response) => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')

async function call<T>(path: string, headers: Record<string, string>, method = 'GET', body?: unknown) {
  const res = await fetch(`${AUTOBRR_URL}/api${path}`, {
    method,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`autobrr ${method} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`)
  return { res, body: (res.status === 204 ? undefined : await res.json().catch(() => undefined)) as T }
}

/** The API key Arrmy made, or undefined when the Admin made the account themselves (then clients are added by hand). */
async function apiKey() {
  const saved = getSetting<string>(KEY)
  if (saved) return saved
  const password = process.env.QBIT_PASSWORD
  // 204 only while autobrr has no user; any other answer, once it is up, means the account is already someone's.
  if ((await fetch(`${AUTOBRR_URL}/api/auth/onboard`, { cache: 'no-store' })).status !== 204) return undefined
  const login = { username: 'admin', password }
  await call('/auth/onboard', {}, 'POST', login)
  const session = cookies((await call('/auth/login', {}, 'POST', login)).res)
  const made = await call<{ key: string }>('/keys', { Cookie: session }, 'POST', { name: 'Arrmy', scopes: [] })
  setSetting(KEY, made.body.key)
  return made.body.key
}

/** Adds Radarr, Sonarr and qBittorrent (through gluetun) as autobrr's clients, so a filter's action can pick any of them. */
export async function wireAutobrr() {
  const key = await apiKey()
  if (!key) return console.warn('[wire] autobrr already has an account, so add Radarr, Sonarr and qBittorrent as its clients by hand')
  const headers = { 'X-API-Token': key }
  const have = (await call<{ name: string }[]>('/downloaders', headers)).body ?? []
  const clients = [
    { name: 'Radarr', type: 'RADARR', host: serviceUrl('radarr'), settings: { apikey: serviceKey('radarr') } },
    { name: 'Sonarr', type: 'SONARR', host: serviceUrl('sonarr'), settings: { apikey: serviceKey('sonarr') } },
    { name: 'qBittorrent', type: 'QBITTORRENT', host: 'http://gluetun:8080', username: 'admin', password: process.env.QBIT_PASSWORD },
  ]
  for (const c of clients) if (!have.some((h) => h.name === c.name)) await call('/downloaders', headers, 'POST', { enabled: true, port: 0, tls: false, ...c })
}

/** Version for the #system and #updates cards; without the key only whether it answers. */
export async function autobrrVersion() {
  const key = getSetting<string>(KEY)
  if (key) return (await call<{ version: string }>('/config', { 'X-API-Token': key })).body.version
  const res = await fetch(`${AUTOBRR_URL}/api/healthz/liveness`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`autobrr liveness → ${res.status}`)
  return undefined
}
