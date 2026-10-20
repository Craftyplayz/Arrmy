import { DatabaseSync } from 'node:sqlite'

export type MediaType = 'movie' | 'tv'
export type User = { id: number; username: string; is_admin: number }
export type RequestRow = {
  id: number
  user_id: number
  username: string
  media_type: MediaType
  external_id: number
  title: string
  year: number | null
  poster: string | null
  seasons: string | null
  status: 'requested' | 'available'
  created_at: string
}

let conn: DatabaseSync | undefined

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
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
        external_id INTEGER NOT NULL,          -- TMDB id for movies, TVDB id for TV
        title TEXT NOT NULL,
        year INTEGER,
        poster TEXT,
        seasons TEXT,                          -- JSON array of season numbers, TV only
        status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'available')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL                    -- JSON
      );
    `)
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
  externalId: number
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

export const hasRequest = (userId: number, type: MediaType, externalId: number) =>
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
export const requestsFor = (type: MediaType, externalId: number) =>
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
export const getLimits = (): Limits => ({ movieGb: 0, episodeGb: 0, showGb: 0, ...getSetting<Limits>('limits') })

export const waitingRequests = (type: MediaType, externalId: number) =>
  db()
    .prepare(`${SELECT} WHERE media_type = ? AND external_id = ? AND status = 'requested'`)
    .all(type, externalId) as RequestRow[]

export const markAvailable = (id: number) => db().prepare(`UPDATE requests SET status = 'available' WHERE id = ?`).run(id)
