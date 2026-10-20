// The bot's slash commands. Answers only: none of them changes anything.
import { adminOverview } from './admin'
import { arr } from './arr'
import { owned } from './books'
import { CATEGORY_NAMES, downloadMessage, linked, size } from './botrules'
import { getSetting, listRequests } from './db'
import { publicUrl } from './discord'
import type { AppState } from './feeds'
import { qbit, torrents } from './qbit'

const STRING = 3 // Discord's option type for text

export const COMMANDS = [
  { name: 'status', description: 'Apps, VPN and disks right now' },
  { name: 'queue', description: "What's downloading" },
  { name: 'requests', description: 'Recent Requests', options: [{ type: STRING, name: 'person', description: "Only this person's Requests" }] },
  { name: 'problems', description: 'What needs fixing' },
  { name: 'search', description: 'Is it in the library?', options: [{ type: STRING, name: 'title', description: 'Movie, show or audiobook', required: true }] },
]

const list = (lines: string[], none: string, max = 15) =>
  lines.length ? [...lines.slice(0, max), ...(lines.length > max ? [`…and ${lines.length - max} more`] : [])].join('\n') : none

async function status() {
  const apps = Object.entries(getSetting<Record<string, AppState>>('bot:apps') ?? {}).map(
    ([name, s]) => `${s.down ? '🔴' : '🟢'} ${name}${s.version ? ` ${s.version}` : ''}${s.down ? ' **down**' : ''}`,
  )
  const [info, prefs, disks] = await Promise.all([
    qbit('/transfer/info').then((r) => r.json() as Promise<{ connection_status: string }>).catch(() => undefined),
    qbit('/app/preferences').then((r) => r.json() as Promise<{ listen_port: number }>).catch(() => undefined),
    arr<{ path: string; freeSpace: number; totalSpace: number }[]>('radarr', '/diskspace').catch(() => []),
  ])
  const vpn = info ? `${info.connection_status === 'disconnected' ? '🔴' : '🟢'} VPN ${info.connection_status}, forwarded port ${prefs?.listen_port}` : '🔴 VPN: qBittorrent unreachable'
  const disk = (name: string, path: string) => {
    const d = disks.find((x) => x.path === path)
    return d ? `💽 ${name} disk: ${size(d.freeSpace)} free of ${size(d.totalSpace)} (${Math.round((d.freeSpace / d.totalSpace) * 100)}%)` : []
  }
  return [...(apps.length ? apps : ['Apps: not checked yet, try again in a minute']), vpn, disk('Media', '/data'), disk('Config', '/config')].flat().join('\n')
}

async function queue() {
  const downloading = (await torrents()).filter((t) => t.category in CATEGORY_NAMES && t.progress < 1)
  return list(downloading.map((t) => downloadMessage(t).replace('\n', ' · ')), 'Nothing is downloading.', 10)
}

function requests(person?: string) {
  const rows = listRequests().filter((r) => !person || r.username.toLowerCase().includes(person.toLowerCase()))
  return list(
    rows.map((r) => `• **${r.title}**${r.year ? ` (${r.year})` : ''} · ${r.username} · ${r.created_at.slice(0, 10)} · ${r.status === 'available' ? 'Available' : 'Waiting'}`),
    person ? `No Requests from anyone called ${person}.` : 'No Requests yet.',
  )
}

async function problems() {
  const { problems } = await adminOverview()
  return list(problems.map((p) => `• **${p.kind}**: ${p.title} · ${p.detail}`), 'Nothing needs fixing.')
}

async function search(title: string) {
  const q = title.toLowerCase()
  const [movies, series, books] = await Promise.all([
    arr<{ title: string; year: number; hasFile: boolean; tmdbId: number }[]>('radarr', '/movie').catch(() => []),
    arr<{ title: string; year: number; titleSlug: string; statistics?: { episodeFileCount: number; episodeCount: number } }[]>('sonarr', '/series').catch(() => []),
    owned(title),
  ])
  const lines = [
    ...movies
      .filter((m) => m.title.toLowerCase().includes(q))
      .map((m) => `🎬 ${linked(`**${m.title}** (${m.year})`, publicUrl('radarr', `/movie/${m.tmdbId}`))}: ${m.hasFile ? 'in the library' : 'requested, not downloaded yet'}`),
    ...series
      .filter((s) => s.title.toLowerCase().includes(q))
      .map((s) => `📺 ${linked(`**${s.title}** (${s.year})`, publicUrl('sonarr', `/series/${s.titleSlug}`))}: ${s.statistics?.episodeFileCount ?? 0} of ${s.statistics?.episodeCount ?? 0} episodes`),
    ...books.map((b) => `🎧 **${b.title}**${b.author ? ` by ${b.author}` : ''}: in Audiobookshelf`),
  ]
  return list(lines, `Nothing called "${title}" in the library. ${linked('Request it in Arrmy', publicUrl('arrmy'))}.`)
}

/** The answer to a slash command, as a Discord message. */
export async function answer(name: string, options: Record<string, string>) {
  switch (name) {
    case 'status':
      return status()
    case 'queue':
      return queue()
    case 'requests':
      return requests(options.person)
    case 'problems':
      return problems()
    case 'search':
      return search(options.title ?? '')
    default:
      return `Unknown command: ${name}`
  }
}
