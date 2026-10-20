// Discord bot rules: its channels, how messages read, and how settings are compared. No I/O here, so they can be unit-tested.
import { createHash } from 'node:crypto'
import type { Problem } from './problems'

/** The bot's channels and their topics, created in this order under an Arrmy category. */
export const CHANNELS = {
  requests: 'New Requests, edits and removals, refused Requests, and what became Available.',
  downloads: 'One live message per download.',
  problems: 'New Problems and automatic fixes. @mentions the Admin.',
  'admin-log': "Arrmy's settings and Admin actions, settings changed inside the apps, and who has access to Plex and Audiobookshelf.",
  system: 'Apps and the VPN going down or coming back, health warnings, disk space and backups.',
  updates: 'Arrmy commits and releases, and new versions of every app. @mentions the Admin.',
  activity: 'Sign-ins to Arrmy, and who started watching or listening.',
} as const
export type Channel = keyof typeof CHANNELS

/** The qBittorrent categories Radarr, Sonarr and LazyLibrarian file their torrents under, and which app each is. */
export const CATEGORY_APPS: Record<string, string> = { movies: 'Radarr', tv: 'Sonarr', books: 'LazyLibrarian' }

export function duration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 8_640_000) return 'unknown'
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
}

export const size = (bytes: number) =>
  bytes >= 1e12 ? `${(bytes / 1e12).toFixed(2)} TB` : bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1e6 ? `${Math.round(bytes / 1e6)} MB` : `${Math.ceil(bytes / 1e3)} KB`

/** Identifies a Problem across checks; the title rather than ids, which change as episodes are found. */
export const problemKey = (p: Problem) => `${p.service}:${p.kind}:${p.title}`

// Keys that change by themselves (free space, timestamps) or say nothing about settings.
const NOISE = /^(freeSpace|totalSpace|unmappedFolders|accessible|added|capabilities|listen_port|lastExecution|message|infoLink)$/
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

/** Markdown link that doesn't unfurl into a preview, or plain text when there's no address. */
export const linked = (text: string, url?: string) => (url ? `[${text}](<${url}>)` : text)
