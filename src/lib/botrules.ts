// Discord bot rules: its channels, how messages read, and how settings are compared. No I/O here, so they can be unit-tested.
import { createHash } from 'node:crypto'
import type { Problem } from './problems'

/** The bot's text channels and their topics, created first under an Arrmy category. */
export const CHANNELS = {
  downloading: "What's downloading now: one live card each, gone when it finishes.",
  'weekly-summary': 'Every Sunday evening: who watched what in Plex that week, from Tautulli.',
} as const
export type Channel = keyof typeof CHANNELS

/**
 * The bot's forums, created after the channels: one thread per thing, with everything about it inside. Private ones
 * only the Admin (and the bot) can see. Only the bot opens threads; whoever sees a forum can reply in its threads.
 */
export const FORUMS = {
  requests: { name: 'Requests', private: false, topic: 'One thread per Request: the search, the download and when it became Available.', tags: ['Movie', 'TV', 'Audiobook', 'Requested', 'Downloading', 'Available', 'Removed'] },
  activity: { name: 'Activity', private: false, topic: 'One thread per movie, show or book: who played it, on what, and for how long.', tags: ['Movie', 'TV', 'Audiobook'] },
  problems: { name: 'Problems', private: true, topic: 'One thread per Problem, with what the doctor checked and fixed.', tags: ['Open', 'Doctor working', 'Needs you', 'Resolved'] },
  admin: { name: 'Admin', private: true, topic: 'One thread per subject: the apps, the VPN, disks, backups, settings, access and updates.', tags: ['Admin log', 'System', 'Updates'] },
} as const
export type Forum = keyof typeof FORUMS
export type Tag<F extends Forum = Forum> = (typeof FORUMS)[F]['tags'][number]

/** A media type's tag in the Requests and Activity forums. */
export const TYPE_TAGS = { movie: 'Movie', tv: 'TV', audiobook: 'Audiobook' } as const

/** Discord's permission bits the forums need. */
export const PERMS = { view: 1n << 10n, send: 1n << 11n, embed: 1n << 14n, attach: 1n << 15n, history: 1n << 16n, manageThreads: 1n << 34n, sendInThreads: 1n << 38n }

/**
 * A forum's permission overwrites: nobody opens threads but the bot, everyone who sees it can reply in them, and a
 * private one is hidden from everyone but the bot and the Admin (DISCORD_ADMIN_ID).
 */
export function forumPermissions(forum: Forum, guildId: string, botId: string, adminId?: string) {
  const p = PERMS
  const everyoneDeny = p.send | (FORUMS[forum].private ? p.view : 0n)
  const bot = p.view | p.send | p.sendInThreads | p.embed | p.attach | p.history | p.manageThreads
  return [
    { id: guildId, type: 0, allow: String(FORUMS[forum].private ? 0n : p.sendInThreads), deny: String(everyoneDeny) },
    { id: botId, type: 1, allow: String(bot), deny: '0' },
    ...(adminId ? [{ id: adminId, type: 1, allow: String(p.view | p.sendInThreads | p.history), deny: '0' }] : []),
  ]
}

/** A thread's name: Discord allows 100 characters, so `title` is cut short with … and the rest is kept whole. */
export function threadName(title: string, before = '', after = '') {
  const room = 100 - before.length - after.length
  return `${before}${title.length > room ? `${title.slice(0, Math.max(1, room - 1)).trimEnd()}…` : title}${after}`
}

/** A Problem thread's name: "Audiobook - Harry Potter and the Chamber of Secrets - no valid release found". */
export const problemThreadName = (type: string, title: string, issue: string) => threadName(title, `${type} - `, ` - ${issue}`)

/**
 * A forum thread about one thing, found again by `key` (the threads table), opened by its first post with `name`.
 * `tags` replaces the thread's tags when given; `art` is the cover attached to the first post, which Discord shows as
 * the thread's preview.
 */
export type ThreadRef = { forum: Forum; key: string; name: string; tags?: readonly string[]; art?: string | null }

/** The Admin forum's thread for one subject: "Radarr", "VPN", "Size Limits", "Arrmy releases"… */
export const adminThread = (subject: string, tag: Tag<'admin'>): ThreadRef => ({ forum: 'admin', key: `admin:${subject}`, name: subject, tags: [tag] })

/** The Admin thread for a card of new versions after a redeploy: Arrmy's own, one app's, or several apps'. */
export const updatesSubject = (apps: string[]) => (apps.includes('Arrmy') ? 'Arrmy releases' : apps.length === 1 ? `${apps[0]} updates` : 'App updates')

export type RequestStatus = 'Requested' | 'Downloading' | 'Available' | 'Removed'

/** A Request's thread: one per title (`item` is the Request Log's, e.g. movie:603), whoever asked for it. */
export const requestThread = (item: string, name: string, type: keyof typeof TYPE_TAGS, status?: RequestStatus, art?: string | null): ThreadRef => ({
  forum: 'requests',
  key: `request:${item}`,
  name: threadName(name),
  tags: status && [TYPE_TAGS[type], status],
  art,
})

const PROBLEM_TYPES = { radarr: 'Movie', sonarr: 'TV', lazylibrarian: 'Audiobook', editions: 'Audiobook' } as const

/** A Problem's thread, the same one each time the same Problem comes back. */
export const problemThread = (p: Problem, tag?: Tag<'problems'>): ThreadRef => ({
  forum: 'problems',
  key: `problem:${problemKey(p)}`,
  name: problemThreadName(PROBLEM_TYPES[p.service], p.title, p.kind.toLowerCase()),
  tags: tag && [tag],
  art: p.poster,
})

/** Where a thread opens in Discord. */
export const threadUrl = (guildId: string, threadId: string) => `https://discord.com/channels/${guildId}/${threadId}`

/** The qBittorrent categories Radarr, Sonarr and LazyLibrarian file their torrents under, and which app each is. */
export const CATEGORY_APPS: Record<string, string> = { movies: 'Radarr', tv: 'Sonarr', books: 'LazyLibrarian', editions: 'Arrmy' }

export function duration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 8_640_000) return 'unknown'
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
}

export const size = (bytes: number) =>
  bytes >= 1e12 ? `${(bytes / 1e12).toFixed(2)} TB` : bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1e6 ? `${Math.round(bytes / 1e6)} MB` : `${Math.ceil(bytes / 1e3)} KB`

/** Who a Plex server is shared with, from plex.tv's /api/users. It only answers in XML: one <User …/> per person. */
export function plexUsers(xml: string) {
  const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }
  const attr = (tag: string, name: string) =>
    tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1].replace(/&(amp|quot|apos|lt|gt|#39);/g, (_, e: string) => entities[e] ?? "'")
  return [...xml.matchAll(/<User\b[^>]*>/g)].map(([tag]) => ({ name: attr(tag, 'title') || attr(tag, 'username') || 'Someone', avatar: attr(tag, 'thumb') || undefined }))
}

/** Identifies a Problem across checks; the title rather than ids, which change as episodes are found. */
export const problemKey = (p: Problem) => `${p.service}:${p.kind}:${p.title}`

// Keys that change by themselves (free space, timestamps) or say nothing about settings. qBittorrent's port and network
// interface are set by gluetun's port-forwarding hooks (docker-compose.yml) every time the VPN goes down or up.
const NOISE =
  /^(freeSpace|totalSpace|unmappedFolders|accessible|added|capabilities|listen_port|random_port|upnp|current_network_interface|current_interface_name|lastExecution|message|infoLink)$/
const SECRET = /password|apikey|api_key|token|secret|passkey|cookie/i

const label = (item: unknown, i: number) => {
  const o = item as { name?: unknown; id?: unknown }
  return item && typeof item === 'object' ? String(o.name ?? o.id ?? i) : String(i)
}

/**
 * An app's settings as path → value, so two snapshots can be compared. A `fields` list ({name, value} pairs, how the
 * *arr apps store provider settings) becomes name → value; other lists are keyed by each item's name or id. Secrets
 * become a fingerprint, so a change shows without the value.
 */
export function flatten(value: unknown, path = '', out: Record<string, string> = {}): Record<string, string> {
  const key = path.split(' › ').pop() ?? ''
  if (NOISE.test(key)) return out
  if (Array.isArray(value)) {
    if (key === 'fields') for (const f of value as { name: string; value?: unknown }[]) flatten(f.value, `${path} › ${f.name}`, out)
    else if (value.every((v) => v === null || typeof v !== 'object')) out[path] = value.join(', ')
    else value.forEach((v, i) => flatten(v, `${path} › ${label(v, i)}`, out))
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, path ? `${path} › ${k}` : k, out)
  } else if (SECRET.test(key) && value) {
    out[path] = `(hidden ${createHash('sha256').update(String(value)).digest('hex').slice(0, 6)})`
  } else out[path] = String(value)
  return out
}

/** What changed between two flattened snapshots, one line each, at most `max` lines. */
export function changes(before: Record<string, string>, after: Record<string, string>, max = 15) {
  const lines: string[] = []
  for (const [k, v] of Object.entries(after)) {
    if (!(k in before)) lines.push(`${k}: added (${v})`)
    else if (before[k] !== v) lines.push(`${k}: ${before[k]} → ${v}`)
  }
  for (const k of Object.keys(before)) if (!(k in after)) lines.push(`${k}: removed`)
  return lines.length > max ? [...lines.slice(0, max), `…and ${lines.length - max} more`] : lines
}

/** -1, 0 or 1. Compares the numbers in two versions, ignoring prefixes like v or release-: 6.4.4.10685, release-5.2.4. */
export function compareVersions(a: string, b: string) {
  // Plex adds a build hash after a dash (1.43.4.10903-e5521bd8c), whose digits aren't part of the version.
  const parts = (v: string) => (v.replace(/^\D+/, '').split('-')[0].match(/\d+/g) ?? []).map(Number)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return Math.sign(d)
  }
  return 0
}

/**
 * A release's notes cut to their first few changes, one "• " line each: list items (- or *) and commit lines
 * (sha message) lose their marker and sha. Notes without a list give their first line of plain text.
 */
export function releaseNotes(text: string, max = 3) {
  const clean = (l: string, n: number) => {
    const t = l.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').trim()
    return t.length > n ? `${t.slice(0, n - 1)}…` : t
  }
  const noise = (l: string) => /translat|weblate|^bump\b|^merge\b|^see merge request/i.test(l)
  const lines = text.split('\n').map((l) => l.trim())
  const items = lines
    .filter((l) => /^([-*]|[0-9a-f]{7,40})\s/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, '').replace(/^[0-9a-f]{7,40}\s+/, ''))
    .filter((l) => l && !noise(l))
  if (items.length) return items.slice(0, max).map((l) => `• ${clean(l, 120)}`).join('\n')
  const first = lines.find((l) => l && !l.startsWith('#') && !noise(l))
  return first && clean(first, 300)
}

/** Markdown link that doesn't unfurl into a preview, or plain text when there's no address. */
export const linked = (text: string, url?: string) => (url ? `[${text}](<${url}>)` : text)
