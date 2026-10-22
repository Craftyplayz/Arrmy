import { DatabaseSync } from 'node:sqlite'
import type { LogEvent, LogKind } from './logrules'
import { DEAD_DEFAULTS, type DeadLimits } from './problems.ts'

export type MediaType = 'movie' | 'tv' | 'audiobook'
export type User = { id: number; username: string; is_admin: number }
export type RequestRow = {
  id: number
  user_id: number
  username: string
  media_type: MediaType
  /** TMDB id (movie), TVDB id (TV) or LazyLibrarian's BookID, e.g. OL21745884W (audiobook). */
  external_id: number | string
  title: string
  year: number | null
  poster: string | null
  seasons: string | null
  status: 'requested' | 'available'
  created_at: string
}

let conn: DatabaseSync | undefined

const REQUESTS = `
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv', 'audiobook')),
    external_id INTEGER NOT NULL,          -- TMDB id (movie), TVDB id (TV), or LazyLibrarian's text BookID (audiobook)
    title TEXT NOT NULL,
    year INTEGER,
    poster TEXT,
    seasons TEXT,                          -- JSON array of season numbers, TV only
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'available')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`

const DEAD_RELEASES = `
  CREATE TABLE IF NOT EXISTS dead_releases (
    hash TEXT NOT NULL,                    -- qBittorrent torrent hash, lowercase; a release grabbed again gets another row
    item TEXT NOT NULL,                    -- radarr:<movieId>, sonarr:<seriesId>:<season> or book:<BookID>
    title TEXT NOT NULL,
    kept INTEGER NOT NULL DEFAULT 0,       -- 1 = the strike that made it a Problem, so it was left in qBittorrent
    search_pending INTEGER NOT NULL DEFAULT 0, -- audiobooks: LazyLibrarian still has to search for another release
    at TEXT NOT NULL DEFAULT (datetime('now'))
  )`

const REQUEST_LOG = `
  CREATE TABLE IF NOT EXISTS request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item TEXT NOT NULL,                    -- <media_type>:<external_id>, as in requests: movie:603, tv:81189, audiobook:OL893414W
    kind TEXT NOT NULL,                    -- grabbed, dead, downloaded, imported or playable (see logrules.ts)
    detail TEXT NOT NULL,                  -- JSON
    at TEXT NOT NULL DEFAULT (datetime('now'))
  )`

// Opened lazily so `next build` never touches /config.
function db() {
  if (!conn) {
    conn = new DatabaseSync(process.env.DB_PATH ?? '/config/arrmy.db')
    conn.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,                -- Plex account id
        username TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0
      );
      ${REQUESTS};
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL                    -- JSON
      );
      ${DEAD_RELEASES};
      ${REQUEST_LOG};
    `)
    // Before 1.1.0 media_type only allowed movie and tv. SQLite can't change a CHECK, so rebuild the table once.
    const sqlOf = (table: string) => (conn!.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(table) as { sql: string }).sql
    if (!sqlOf('requests').includes("'audiobook'"))
      conn.exec(`BEGIN; ALTER TABLE requests RENAME TO requests_old; ${REQUESTS};
        INSERT INTO requests SELECT * FROM requests_old; DROP TABLE requests_old; COMMIT;`)
    // 1.1.0-rc.7 and rc.8 keyed dead_releases by hash, so a release grabbed a second time couldn't count as another strike.
    if (sqlOf('dead_releases').includes('PRIMARY KEY'))
      conn.exec(`BEGIN; ALTER TABLE dead_releases RENAME TO dead_releases_old; ${DEAD_RELEASES};
        INSERT INTO dead_releases SELECT * FROM dead_releases_old; DROP TABLE dead_releases_old; COMMIT;`)
  }
  return conn
}

export function upsertUser(user: { id: number; username: string; isAdmin: boolean }) {
  db()
    .prepare(
      `INSERT INTO users (id, username, is_admin) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET username = excluded.username, is_admin = excluded.is_admin`,
    )
    .run(user.id, user.username, user.isAdmin ? 1 : 0)
}

export const getUser = (id: number) => db().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined

export function addRequest(r: {
  userId: number
  type: MediaType
  externalId: number | string
  title: string
  year?: number
  poster?: string
  seasons?: number[]
}) {
  db()
    .prepare(
      'INSERT INTO requests (user_id, media_type, external_id, title, year, poster, seasons) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(r.userId, r.type, r.externalId, r.title, r.year ?? null, r.poster ?? null, r.seasons ? JSON.stringify(r.seasons) : null)
}

export const setPoster = (type: MediaType, externalId: number | string, poster: string) =>
  db().prepare('UPDATE requests SET poster = ? WHERE media_type = ? AND external_id = ?').run(poster, type, externalId)

export const hasRequest = (userId: number, type: MediaType, externalId: number | string) =>
  !!db().prepare('SELECT 1 FROM requests WHERE user_id = ? AND media_type = ? AND external_id = ?').get(userId, type, externalId)

const SELECT = 'SELECT requests.*, users.username FROM requests JOIN users ON users.id = requests.user_id'

/** Every Request for the Admin (no userId), otherwise just that Requester's. */
export const listRequests = (userId?: number) =>
  (userId === undefined
    ? db().prepare(`${SELECT} ORDER BY requests.id DESC`).all()
    : db().prepare(`${SELECT} WHERE user_id = ? ORDER BY requests.id DESC`).all(userId)) as RequestRow[]

export const getRequest = (id: number) => db().prepare(`${SELECT} WHERE requests.id = ?`).get(id) as RequestRow | undefined

export const deleteRequest = (id: number) => db().prepare('DELETE FROM requests WHERE id = ?').run(id)

/** Everyone else's Requests for the same title; whatever they ask for must not be deleted. */
export const otherRequests = (r: RequestRow) =>
  db()
    .prepare(`${SELECT} WHERE media_type = ? AND external_id = ? AND requests.id != ?`)
    .all(r.media_type, r.external_id, r.id) as RequestRow[]

export const seasonsOf = (r: RequestRow): number[] => JSON.parse(r.seasons ?? '[]')

/** `reopen`: new seasons were added, so the Request isn't Available any more until they arrive. */
export function setSeasons(id: number, seasons: number[], reopen: boolean) {
  db()
    .prepare(`UPDATE requests SET seasons = ?${reopen ? ", status = 'requested'" : ''} WHERE id = ?`)
    .run(JSON.stringify(seasons), id)
}

/** Every Request for a title, from anyone. */
export const requestsFor = (type: MediaType, externalId: number | string) =>
  db().prepare(`${SELECT} WHERE media_type = ? AND external_id = ?`).all(type, externalId) as RequestRow[]

export function getSetting<T>(key: string): T | undefined {
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row && JSON.parse(row.value)
}

/** undefined deletes the setting. */
export function setSetting(key: string, value: unknown) {
  if (value === undefined) db().prepare('DELETE FROM settings WHERE key = ?').run(key)
  else
    db()
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value))
}

/** The Admin's Size Limits in GB; 0 = no limit. episodeGb is per hour of episode. */
export type Limits = { movieGb: number; episodeGb: number; showGb: number }
export const getDeadLimits = (): DeadLimits => ({ ...DEAD_DEFAULTS, ...getSetting<DeadLimits>('dead') })

export const getLimits = (): Limits => ({ movieGb: 0, episodeGb: 0, showGb: 0, ...getSetting<Limits>('limits') })

export const waitingRequests = (type: MediaType, externalId: number | string) =>
  db()
    .prepare(`${SELECT} WHERE media_type = ? AND external_id = ? AND status = 'requested'`)
    .all(type, externalId) as RequestRow[]

export const markAvailable = (id: number) => db().prepare(`UPDATE requests SET status = 'available' WHERE id = ?`).run(id)

/** Every Request of one Media Type still waiting to become Available. */
export const waitingOfType = (type: MediaType) =>
  db().prepare(`${SELECT} WHERE media_type = ? AND status = 'requested'`).all(type) as RequestRow[]

/** A torrent that never started (see deadReason). */
export type DeadRelease = { hash: string; item: string; title: string; kept: number; search_pending: number; at: string }

export function addDeadRelease(d: { hash: string; item: string; title: string; kept: boolean; searchPending: boolean }) {
  db()
    .prepare('INSERT INTO dead_releases (hash, item, title, kept, search_pending) VALUES (?, ?, ?, ?, ?)')
    .run(d.hash, d.item, d.title, d.kept ? 1 : 0, d.searchPending ? 1 : 0)
}

/** Whether this grab of the torrent (added to qBittorrent at addedOn, Unix seconds) was already handled. */
export const isDeadRelease = (hash: string, addedOn: number) =>
  !!db().prepare("SELECT 1 FROM dead_releases WHERE hash = ? AND at >= datetime(?, 'unixepoch')").get(hash, addedOn)

/** Dead releases for one title in the last week, so a later Request for it starts with a clean slate. */
export const deadReleaseCount = (item: string) =>
  (db().prepare("SELECT count(*) AS n FROM dead_releases WHERE item = ? AND at > datetime('now', '-7 days')").get(item) as { n: number }).n

export const keptDeadReleases = () => db().prepare('SELECT * FROM dead_releases WHERE kept = 1').all() as DeadRelease[]

export const pendingBookSearches = () => db().prepare('SELECT * FROM dead_releases WHERE search_pending = 1').all() as DeadRelease[]

export const setSearchPending = (hash: string, pending: boolean) =>
  db().prepare('UPDATE dead_releases SET search_pending = ? WHERE hash = ?').run(pending ? 1 : 0, hash)

/** The Request Log's events for one title (see logrules.ts), oldest first. */
export const logItem = (type: MediaType, externalId: number | string) => `${type}:${externalId}`

export const addLog = (item: string, kind: LogKind, detail: object) =>
  db().prepare('INSERT INTO request_log (item, kind, detail) VALUES (?, ?, ?)').run(item, kind, JSON.stringify(detail))

export const logFor = (item: string) => db().prepare('SELECT kind, detail, at FROM request_log WHERE item = ? ORDER BY id').all(item) as LogEvent[]

/** Recent events of one kind, for the watch that follows them up (see requestlog.ts). */
export const recentLog = (kind: LogKind, days: number) =>
  db().prepare(`SELECT item, kind, detail, at FROM request_log WHERE kind = ? AND at > datetime('now', ?) ORDER BY id`).all(kind, `-${days} days`) as (LogEvent & { item: string })[]
