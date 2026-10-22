// Watch history from Tautulli, matched to Requests through Plex: Tautulli knows Plex's own ids (rating keys), Arrmy
// knows TMDB and TVDB ids, and Plex lists both. The rules live in watchrules.ts.
import { getSetting, logItem, recentLog, seasonsOf, type RequestRow } from './db'
import { utc } from './logrules'
import { plexLibrary } from './plex'
import { tautulliKey, sessionSecret } from './token'
import { isUnwatched, playsOf, topPlays, type Play } from './watchrules'

export const TAUTULLI_URL = process.env.TAUTULLI_URL ?? 'http://tautulli:8181'

export async function tautulli<T>(cmd: string, params: Record<string, string | number> = {}): Promise<T> {
  const query = new URLSearchParams({ apikey: tautulliKey(sessionSecret()), cmd, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  const res = await fetch(`${TAUTULLI_URL}/api/v2?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  const body = (await res.json().catch(() => undefined)) as { response?: { result: string; message?: string | null; data: T } } | undefined
  if (!res.ok || body?.response?.result !== 'success') throw new Error(`Tautulli ${cmd} → ${res.status} ${body?.response?.message ?? ''}`.trim())
  return body.response.data
}

/** Kept a few minutes, so a page of Requests asks Tautulli and Plex once. A failure isn't kept. */
function cached<T>(minutes: number, load: () => Promise<T>) {
  let at = 0
  let value: Promise<T> | undefined
  return () => {
    if (!value || Date.now() - at > minutes * 60_000) {
      at = Date.now()
      value = load()
      value.catch(() => (value = undefined))
    }
    return value
  }
}

// shortcut: the newest 10,000 plays only; page through get_history (start=) if a server ever has more.
export const history = cached(5, async () => (await tautulli<{ data: Play[] }>('get_history', { length: 10_000, grouping: 1, order_column: 'date', order_dir: 'desc' })).data)

/** Plex's rating key for every movie (`movie:603`) and show (`tv:81189`) in Plex. Empty until the Admin has signed in. */
const plexKeys = cached(10, async () => {
  const keys = new Map<string, number>()
  const token = getSetting<string>('plexToken')
  if (!token) return keys
  const [movies, shows] = await Promise.all([plexLibrary(token, 'movie'), plexLibrary(token, 'show')])
  for (const [type, scheme, items] of [['movie', 'tmdb', movies], ['tv', 'tvdb', shows]] as const)
    for (const item of items)
      for (const g of item.Guid ?? []) if (g.id.startsWith(`${scheme}://`)) keys.set(logItem(type, g.id.slice(scheme.length + 3)), Number(item.ratingKey))
  return keys
})

/** Every play of each Request, newest first, in the same order. Audiobooks are in Audiobookshelf, so they have none. */
export async function requestPlays(requests: RequestRow[]): Promise<Play[][]> {
  const [plays, keys] = await Promise.all([history(), plexKeys()])
  return requests.map((r) => playsOf(r.media_type, seasonsOf(r), keys.get(logItem(r.media_type, r.external_id)), plays))
}

/** For the Admin view: the most played of the last 30 days, and Available Requests nobody has watched in 8 weeks. */
export async function watchOverview(requests: RequestRow[]) {
  const now = Date.now()
  const shown = requests.filter((r) => r.status === 'available' && r.media_type !== 'audiobook')
  // When it became Available: when Plex first listed it (the Request Log), else when it was requested.
  const playable = new Map(recentLog('playable', 3650).map((e) => [e.item, utc(e.at)]))
  const plays = await requestPlays(shown)
  return {
    top: topPlays(await history(), now - 30 * 24 * 60 * 60 * 1000),
    unwatched: shown
      .map((r, i) => ({ r, since: playable.get(logItem(r.media_type, r.external_id)) ?? utc(r.created_at), plays: plays[i] }))
      .filter((u) => isUnwatched(u.since, u.plays, now))
      .sort((a, b) => a.since - b.since),
  }
}
