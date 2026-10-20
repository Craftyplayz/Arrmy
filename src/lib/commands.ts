// The bot's slash commands. Answers only, as cards (embeds.ts): none of them changes anything.
import { adminOverview } from './admin'
import { arr, posterOf, type Media } from './arr'
import { owned } from './books'
import { CATEGORY_APPS, size } from './botrules'
import { getSetting, listRequests } from './db'
import { barEmoji, publicUrl } from './discord'
import { downloadEmbed, embed, mediaUrl, sentence, type Embed } from './embeds'
import type { AppState } from './feeds'
import { bookArt, downloadMeta } from './media'
import { qbit, torrents } from './qbit'

const STRING = 3 // Discord's option type for text

export const COMMANDS = [
  { name: 'status', description: 'Apps, VPN and disks right now' },
  { name: 'queue', description: "What's downloading" },
  { name: 'requests', description: 'Recent Requests', options: [{ type: STRING, name: 'person', description: "Only this person's Requests" }] },
  { name: 'problems', description: 'What needs fixing' },
  { name: 'search', description: 'Is it in the library?', options: [{ type: STRING, name: 'title', description: 'Movie, show or audiobook', required: true }] },
]

/** "20 Oct 2026", as DESIGN.md writes dates. */
const day = (sqliteUtc: string) => new Date(`${sqliteUtc.replace(' ', 'T')}Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** A one-line answer when there's nothing to show. */
const nothing = (title: string, description?: string): Embed[] => [embed({ colour: 'neutral', app: 'Arrmy', title, description, at: false })]

async function status(): Promise<Embed[]> {
  const apps = Object.entries(getSetting<Record<string, AppState>>('bot:apps') ?? {})
  const [info, prefs, disks] = await Promise.all([
    qbit('/transfer/info').then((r) => r.json() as Promise<{ connection_status: string }>).catch(() => undefined),
    qbit('/app/preferences').then((r) => r.json() as Promise<{ listen_port: number }>).catch(() => undefined),
    arr<{ path: string; freeSpace: number; totalSpace: number }[]>('radarr', '/diskspace').catch(() => []),
  ])
  const disk = (path: string) => {
    const d = disks.find((x) => x.path === path)
    return d && `${size(d.freeSpace)} free of ${size(d.totalSpace)}`
  }
  const down = apps.filter(([, s]) => s.down).length + (info?.connection_status === 'disconnected' || !info ? 1 : 0)
  return [
    embed({
      colour: down ? 'danger' : 'ok',
      app: 'Arrmy',
      title: down ? `${down} ${down === 1 ? 'thing needs' : 'things need'} you` : 'Everything is running',
      description: apps.length ? undefined : 'The apps are checked a minute after Arrmy starts. Try again shortly.',
      fields: [
        ...apps.map(([name, s]): [string, string] => [name, s.down ? '**Down**' : `Up · ${s.version?.replace(/^v/, '') ?? ''}`]),
        ['VPN', info ? `${info.connection_status === 'disconnected' ? '**Down**' : 'Up'} · port ${prefs?.listen_port ?? '?'}` : '**Unreachable**'],
        ['Media disk', disk('/data')],
        ['Config disk', disk('/config')],
      ],
    }),
  ]
}

async function queue(): Promise<Embed[]> {
  const downloading = (await torrents()).filter((t) => t.category in CATEGORY_APPS && t.progress < 1)
  if (!downloading.length) return nothing('Nothing is downloading')
  const shown = downloading.sort((a, b) => b.progress - a.progress).slice(0, 10)
  const metas = await downloadMeta(shown).catch(() => new Map())
  const emoji = barEmoji()
  return shown.map((t) => downloadEmbed(t, metas.get(t.hash.toLowerCase()), emoji))
}

function requests(person?: string): Embed[] {
  const rows = listRequests().filter((r) => !person || r.username.toLowerCase().includes(person.toLowerCase()))
  if (!rows.length) return nothing(person ? `No Requests from anyone called ${person}` : 'No Requests yet')
  const lines = rows
    .slice(0, 20)
    .map((r) => `**${r.title}**${r.year ? ` (${r.year})` : ''} · ${r.username} · ${day(r.created_at)} · ${r.status === 'available' ? 'Available' : 'Waiting'}`)
  return [
    embed({
      colour: 'info',
      app: 'Arrmy',
      appUrl: publicUrl('arrmy', '/requests'),
      title: person ? `Requests from ${person}` : 'Recent Requests',
      url: publicUrl('arrmy', '/requests'),
      art: rows[0].poster,
      description: lines.join('\n') + (rows.length > 20 ? `\n…and ${rows.length - 20} more` : ''),
      at: false,
    }),
  ]
}

async function problems(): Promise<Embed[]> {
  const { problems } = await adminOverview()
  if (!problems.length) return [embed({ colour: 'ok', app: 'Arrmy', title: 'Nothing needs fixing', at: false })]
  const admin = publicUrl('arrmy', '/admin#problems')
  return problems.slice(0, 10).map((p) =>
    embed({ colour: 'danger', app: 'Arrmy', title: p.title, url: admin, art: p.poster, description: sentence(p.detail), fields: [['Problem', p.kind]], at: false }),
  )
}

async function search(title: string): Promise<Embed[]> {
  const q = title.toLowerCase()
  const [movies, series, books] = await Promise.all([
    arr<(Media & { hasFile: boolean; tmdbId: number })[]>('radarr', '/movie').catch(() => []),
    arr<(Media & { titleSlug: string; tvdbId: number; statistics?: { episodeFileCount: number; episodeCount: number } })[]>('sonarr', '/series').catch(() => []),
    owned(title),
  ])
  // Cards are made only for the first 10 matches, since a book card looks up its cover.
  const found: (() => Promise<Embed>)[] = [
    ...movies
      .filter((m) => m.title.toLowerCase().includes(q))
      .map((m) => async () =>
        embed({
          colour: m.hasFile ? 'ok' : 'info',
          app: 'Radarr',
          appUrl: publicUrl('radarr', `/movie/${m.tmdbId}`),
          title: `${m.title}${m.year ? ` (${m.year})` : ''}`,
          url: mediaUrl('movie', m.tmdbId),
          art: posterOf(m),
          description: m.hasFile ? 'In the library.' : 'Requested, not downloaded yet.',
          at: false,
        }),
      ),
    ...series
      .filter((s) => s.title.toLowerCase().includes(q))
      .map((s) => async () => {
        const have = s.statistics?.episodeFileCount ?? 0
        const all = s.statistics?.episodeCount ?? 0
        return embed({
          colour: all && have >= all ? 'ok' : 'info',
          app: 'Sonarr',
          appUrl: publicUrl('sonarr', `/series/${s.titleSlug}`),
          title: `${s.title}${s.year ? ` (${s.year})` : ''}`,
          url: mediaUrl('tv', s.tvdbId),
          art: posterOf(s),
          description: `${have.toLocaleString('en-GB')} of ${all.toLocaleString('en-GB')} episodes in the library.`,
          at: false,
        })
      }),
    ...books.map((b) => async () =>
      embed({
        colour: 'ok',
        app: 'Audiobookshelf',
        appUrl: publicUrl('books'),
        title: b.title,
        ...(await bookArt(b.title, b.author)),
        description: 'In Audiobookshelf.',
        fields: [['Author', b.author]],
        at: false,
      }),
    ),
  ].slice(0, 10)
  if (!found.length) return nothing(`Nothing called "${title}" in the library`, publicUrl('arrmy') && `[Request it in Arrmy](${publicUrl('arrmy')}).`)
  return Promise.all(found.map((card) => card()))
}

/** The answer to a slash command, as up to 10 cards. */
export async function answer(name: string, options: Record<string, string>): Promise<Embed[]> {
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
      return nothing(`Unknown command: ${name}`)
  }
}
