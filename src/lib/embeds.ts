// What the Discord bot's messages look like: embeds in DESIGN.md's colours, art first, plain British English, no emoji.
// No I/O here.
// .ts so plain node (the tests) can load this file too
import { progressBar } from './barart.ts'
import { CATEGORY_APPS, duration, size } from './botrules.ts'
import type { Torrent } from './problems'

export type Embed = {
  title?: string
  url?: string
  description?: string
  color?: number
  author?: { name: string; url?: string; icon_url?: string }
  thumbnail?: { url: string }
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string; icon_url?: string }
  timestamp?: string
}

/**
 * DESIGN.md's colour tokens as embed colours: green means success or Available only, red failures, --info Downloading
 * and notes, the accent something to act on, --line-strong anything neutral (removed, cancelled).
 */
export const COLOUR = { accent: 0x66c0f4, info: 0x3a628a, ok: 0x4f8a3a, danger: 0x8a3a3a, neutral: 0x555555 } as const

// selfh.st's icons, pinned to one commit so they can't change or vanish under the messages.
const ICON = (file: string) => `https://raw.githubusercontent.com/selfhst/icons/1d65d45a42e6323b54b8096967b1ea4b65321f97/png/${file}.png`

/** App icons, for the outside services only (DESIGN.md: icons where they help recognise something). Arrmy has none. */
export const ICONS: Record<string, string> = {
  Radarr: ICON('radarr'),
  Sonarr: ICON('sonarr'),
  Prowlarr: ICON('prowlarr'),
  qBittorrent: ICON('qbittorrent'),
  LazyLibrarian: ICON('lazylibrarian'),
  Audiobookshelf: ICON('audiobookshelf'),
  Plex: ICON('plex'),
  FlareSolverr: ICON('flaresolverr'),
  Tautulli: ICON('tautulli'),
  autobrr: ICON('autobrr'),
  Tdarr: ICON('tdarr'),
  Kometa: ICON('kometa'),
  gluetun: ICON('gluetun'),
  cloudflared: ICON('cloudflare'),
  GitHub: ICON('github'),
}

/** Where a title lives on the web: TMDB, TVDB or OpenLibrary. */
export function mediaUrl(type: 'movie' | 'tv' | 'audiobook', id: number | string) {
  if (type === 'movie') return `https://www.themoviedb.org/movie/${id}`
  if (type === 'tv') return `https://thetvdb.com/dereferrer/series/${id}`
  const book = String(id).split('~')[0] // an Edition's id is <BookID>~<edition>
  return /^OL\d+W$/.test(book) ? `https://openlibrary.org/works/${book}` : undefined
}

/** A capital first and a full stop last, as DESIGN.md wants for sentences. */
export function sentence(s: string) {
  const text = s.trim().replace(/^./, (c) => c.toUpperCase())
  return /[.!?]$/.test(text) ? text : `${text}.`
}

/** "Sam", "Sam and Mum", "Sam, Mum and Dad" */
export const people = (names: string[]) => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)

/**
 * An embed. `app` is the author line (the service it's about, with its icon and its page on this server); `art` the
 * poster or cover beside it; `fields` short facts, side by side.
 */
export function embed(e: {
  colour: keyof typeof COLOUR
  app?: string
  appUrl?: string
  title?: string
  url?: string
  description?: string
  art?: string | null
  fields?: [string, string | undefined | false][]
  footer?: string
  at?: Date | false
}): Embed {
  const fields = (e.fields ?? []).filter((f): f is [string, string] => !!f[1]).map(([name, value]) => ({ name, value, inline: true }))
  return {
    color: COLOUR[e.colour],
    ...(e.app && { author: { name: e.app, ...(e.appUrl && { url: e.appUrl }), ...(ICONS[e.app] && { icon_url: ICONS[e.app] }) } }),
    ...(e.title && { title: e.title.slice(0, 256) }),
    ...(e.url && { url: e.url }),
    ...(e.description && { description: e.description.slice(0, 4096) }),
    ...(e.art && /^https:\/\//.test(e.art) && { thumbnail: { url: e.art } }),
    ...(fields.length && { fields }),
    ...(e.footer && { footer: { text: e.footer.slice(0, 2048) } }),
    ...(e.at !== false && { timestamp: (e.at ?? new Date()).toISOString() }),
  }
}

/** What a download is for, worked out once from Radarr, Sonarr or LazyLibrarian and the Requests. */
export type DownloadMeta = { app: string; title: string; url?: string; appUrl?: string; art?: string | null; by: string[] }

const WAITING: Record<string, string> = {
  metaDL: 'Fetching its file list.',
  forcedMetaDL: 'Fetching its file list.',
  stalledDL: 'Nobody is sharing it right now.',
  queuedDL: 'Queued in qBittorrent.',
  stoppedDL: 'Paused in qBittorrent.',
  pausedDL: 'Paused in qBittorrent.',
  checkingDL: 'Checking its files.',
  error: 'qBittorrent reports an error.',
  missingFiles: 'Its files are missing.',
}

/** "3.2 MB/s", or "45 KB/s" under 1 MB/s rather than "0.0 MB/s". */
export const speed = (bytesPerSecond: number) =>
  bytesPerSecond >= 1_048_576 ? `${(bytesPerSecond / 1_048_576).toFixed(1)} MB/s` : `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`

/**
 * Discord merges cards in one message that link to the same page (it's how image galleries work), so a repeated link
 * gets #2, #3… added: the 8 seasons of a show in /queue stay 8 cards.
 */
export function distinctLinks(cards: Embed[]) {
  const seen = new Map<string, number>()
  return cards.map((card) => {
    if (!card.url) return card
    const n = (seen.get(card.url) ?? 0) + 1
    seen.set(card.url, n)
    return n === 1 ? card : { ...card, url: `${card.url}${card.url.includes('#') ? '-' : '#'}${n}` }
  })
}

const percent = (fraction: number) => `${(Math.floor(fraction * 1000) / 10).toFixed(1)}%`

/** A download's live card in #downloads: the bar, then speed, time left and seeders; Done when it finishes. */
export function downloadEmbed(t: Torrent, meta: DownloadMeta | undefined, emoji: Record<string, string>, startedAt?: number): Embed {
  const base = {
    app: meta?.app ?? CATEGORY_APPS[t.category],
    appUrl: meta?.appUrl,
    title: meta?.title ?? t.name,
    url: meta?.url,
    art: meta?.art,
    footer: meta ? t.name : undefined,
  }
  const by = meta?.by.length ? `Requested by ${people(meta.by)}` : undefined
  if (t.progress >= 1) {
    const took = startedAt ? ` in ${duration((Date.now() - startedAt) / 1000)}` : ''
    return embed({ ...base, colour: 'ok', description: `Downloaded ${size(t.size)}${took}.${by ? ` ${by}.` : ''}` })
  }
  const moving = t.dlspeed > 0
  return embed({
    ...base,
    colour: 'info',
    description: `${progressBar(t.progress, emoji)}  **${percent(t.progress)}**${moving ? '' : `\n${WAITING[t.state] ?? 'Waiting.'}`}`,
    fields: [
      ['Downloaded', `${size(t.size * t.progress)} of ${size(t.size)}`],
      ['Speed', moving && speed(t.dlspeed)],
      ['Time left', moving && duration(t.eta)],
      ['Seeders', t.num_seeds.toLocaleString('en-GB')],
      ['Requested by', meta?.by.length ? people(meta.by) : undefined],
    ],
  })
}
