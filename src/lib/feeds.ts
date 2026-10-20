// What the Discord bot posts by itself: checks that run every so often and post what changed since the last one, as
// cards (embeds.ts). Each check remembers what it saw in the settings table, so a restart doesn't post everything again,
// and the first check after the bot is set up only records, so setting it up doesn't flood the channels.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { adminOverview } from './admin'
import { arr } from './arr'
import { abs, ABS_URL, ll } from './books'
import { CATEGORY_APPS, changes, compareVersions, flatten, linked, plexUsers, problemKey, size } from './botrules'
import { COMMANDS } from './commands'
import { getSetting, setSetting } from './db'
import { announce, barEmoji, botEnabled, edit, ownMessages, post, publicUrl, registerCommands, remove, syncBarEmoji } from './discord'
import { COLOUR, downloadEmbed, embed, ICONS, sentence, type DownloadMeta, type Embed } from './embeds'
import { bookArt, downloadMeta, plexArt } from './media'
import { plex, PLEX_URL } from './plex'
import { DEAD_DETAIL } from './problems'
import { qbit, torrents } from './qbit'

/** What a check saw last time (undefined the first time), remembering what it sees now. */
function since<T>(key: string, now: T): T | undefined {
  const before = getSetting<T>(`bot:${key}`)
  if (JSON.stringify(before) !== JSON.stringify(now)) setSetting(`bot:${key}`, now)
  return before
}

function every(minutes: number, name: string, check: () => Promise<void>, firstAfterMinutes = 1 / 3) {
  let running = false
  const run = async () => {
    if (running) return // a slow app can make a check outlast its interval
    running = true
    try {
      await check()
    } catch (e) {
      console.warn(`[bot] ${name}: ${(e as Error).message}`)
    } finally {
      running = false
    }
  }
  setTimeout(run, firstAfterMinutes * 60_000)
  setInterval(run, minutes * 60_000)
}

async function json<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`${url.split('?')[0]} → ${res.status}`)
  return (await res.json()) as T
}

/** Each app's page on this server, for the author line of its cards. */
const APP_URLS: Record<string, string | undefined> = {
  Radarr: publicUrl('radarr'),
  Sonarr: publicUrl('sonarr'),
  Prowlarr: publicUrl('prowlarr'),
  qBittorrent: publicUrl('qbit'),
  Plex: publicUrl('plex', '/web'),
  Audiobookshelf: publicUrl('books'),
}
const appCard = (name: string) => ({ app: name, appUrl: APP_URLS[name], art: ICONS[name] })

// #downloads: one card per torrent while it downloads, updated every 5 seconds. Discord allows about 5 edits per 5 seconds
// in a channel, so each round edits the 4 that waited longest; with more downloads each one updates a little less often.
// A finished download's card moves to #downloaded; a removed torrent's card just goes.
const EDITS_PER_ROUND = 4
type Tracked = Record<string, { id: string; sig: string; edited: number; started: number; name: string; meta?: DownloadMeta; tried?: number }>

/** A card as Discord returns it, cut back to what can be posted again (no proxy addresses, sizes or type). */
const repostable = (e: Embed): Embed => ({
  title: e.title,
  url: e.url,
  description: e.description,
  color: e.color,
  author: e.author && { name: e.author.name, url: e.author.url, icon_url: e.author.icon_url },
  thumbnail: e.thumbnail && { url: e.thumbnail.url },
  fields: e.fields,
  footer: e.footer && { text: e.footer.text },
  timestamp: e.timestamp,
})

/**
 * Once after a start: cards in #downloads that aren't live (from before #downloaded existed, or finished while Arrmy was
 * down) move to #downloaded if they're Done cards, and go either way.
 */
let tidied = false
const looked = new Set<string>() // torrents whose details were looked up since this start
async function tidyDownloads(tracked: Tracked) {
  tidied = true
  const live = new Set(Object.values(tracked).map((s) => s.id))
  for (const m of await ownMessages('downloads')) {
    if (live.has(m.id)) continue
    if (m.embeds[0]?.color === COLOUR.ok) await post('downloaded', repostable(m.embeds[0]))
    await remove('downloads', m.id)
  }
}

async function downloads() {
  const list = (await torrents()).filter((t) => t.category in CATEGORY_APPS)
  if (!tidied) await tidyDownloads(getSetting<Tracked>('bot:downloads') ?? {})
  const tracked = getSetting<Tracked>('bot:downloads') ?? {}
  const saved = JSON.stringify(tracked)
  const now = Date.now()
  // What each torrent is for (poster, title, who asked), looked up at most every 30 seconds until it's known, and once
  // more after each start, so cards made by an older Arrmy get what this one knows.
  const unknown = list.filter((t) => t.progress < 1 && !looked.has(t.hash.toLowerCase()) && now - (tracked[t.hash.toLowerCase()]?.tried ?? 0) > 30_000)
  const metas = unknown.length ? await downloadMeta(unknown).catch(() => new Map<string, DownloadMeta>()) : new Map<string, DownloadMeta>()
  const emoji = barEmoji()

  const due: { hash: string; card: Embed; sig: string; done: boolean }[] = []
  for (const t of list) {
    const hash = t.hash.toLowerCase()
    if (!tracked[hash] && t.progress >= 1) continue // finished before the bot saw it: no card
    const s = (tracked[hash] ??= { id: '', sig: '', edited: 0, started: now, name: t.name })
    s.name ??= t.name // tracked by 1.1.0-rc.10, before cards
    s.started ??= now
    s.edited ??= 0
    if (metas.has(hash)) {
      s.meta = metas.get(hash)
      looked.add(hash)
    } else if (unknown.includes(t)) s.tried = now
    const card = downloadEmbed(t, s.meta, emoji, s.started)
    const { timestamp: _, ...rest } = card
    const sig = JSON.stringify(rest)
    const done = t.progress >= 1
    if (done || (sig !== s.sig && s.id !== 'gone')) due.push({ hash, card, sig, done })
  }
  // Finished ones first (their move to #downloaded is news), then new cards, then whichever has waited longest.
  const rank = (d: (typeof due)[0]) => (d.done ? 0 : !tracked[d.hash].id ? 1 : 2)
  due.sort((a, b) => rank(a) - rank(b) || tracked[a.hash].edited - tracked[b.hash].edited)
  for (const d of due.slice(0, EDITS_PER_ROUND)) {
    const s = tracked[d.hash]
    if (d.done) {
      await post('downloaded', d.card)
      if (s.id && s.id !== 'gone') await remove('downloads', s.id)
      delete tracked[d.hash]
      continue
    }
    if (!s.id) s.id = await post('downloads', d.card)
    else if (!(await edit('downloads', s.id, d.card))) s.id = 'gone' // deleted by hand: leave it be
    Object.assign(s, { sig: d.sig, edited: now })
  }
  for (const [hash, s] of Object.entries(tracked)) {
    if (list.some((t) => t.hash.toLowerCase() === hash)) continue
    if (s.id && s.id !== 'gone') await remove('downloads', s.id) // removed from qBittorrent: its card goes
    delete tracked[hash]
  }
  if (JSON.stringify(tracked) !== saved) setSetting('bot:downloads', tracked)
}

// #problems. Arrmy fixes most stalled downloads by itself within 15 minutes (dead.ts), so a Problem is only announced
// once it has lasted 20; one Arrmy raised itself after its tries ran out is announced at once.
type Seen = Record<string, { first: number; told: boolean }>
const GRACE = 20 * 60_000
const SERVICE_APPS = { radarr: 'Radarr', sonarr: 'Sonarr', lazylibrarian: 'LazyLibrarian' }

async function problems() {
  const { problems: list } = await adminOverview()
  const before = getSetting<Seen>('bot:problems')
  const now = Date.now()
  const seen: Seen = {}
  for (const p of list) {
    const raisedByArrmy = p.detail === DEAD_DETAIL
    const key = problemKey(p) + (raisedByArrmy ? ':dead' : '')
    const s = (seen[key] = before?.[key] ?? { first: now, told: !before })
    if (s.told || (!raisedByArrmy && now - s.first < GRACE)) continue
    s.told = true
    const admin = publicUrl('arrmy', '/admin#problems')
    announce(
      'problems',
      embed({
        colour: 'danger',
        app: SERVICE_APPS[p.service],
        appUrl: APP_URLS[SERVICE_APPS[p.service]],
        title: p.title,
        url: admin,
        art: p.poster,
        description: sentence(p.detail),
        fields: [
          ['Problem', p.kind],
          ['Fix', admin && linked(p.fix === 'retry' ? 'Try another release' : 'Search again', admin)],
        ],
      }),
      true,
    )
  }
  setSetting('bot:problems', seen)
}

// #system: apps up, down or restarted. An app counts as down after two failed checks in a row (a minute apart).
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL ?? 'http://gluetun:8191'
const ARRS = { radarr: 'Radarr', sonarr: 'Sonarr', prowlarr: 'Prowlarr' } as const

const status = async (app: keyof typeof ARRS) => {
  const s = await arr<{ version: string; startTime: string }>(app, '/system/status')
  return { version: s.version, started: s.startTime }
}

/** Each app's running version, and for the *arr apps when they started, which shows a restart. Throws when it's down. */
const APPS: Record<string, () => Promise<{ version?: string; started?: string }>> = {
  Radarr: () => status('radarr'),
  Sonarr: () => status('sonarr'),
  Prowlarr: () => status('prowlarr'),
  qBittorrent: async () => ({ version: await (await qbit('/app/version')).text() }),
  LazyLibrarian: async () => ({ version: (await ll<{ current_version: string }>('getVersion')).current_version }),
  Audiobookshelf: async () => ({ version: (await json<{ serverVersion: string }>(`${ABS_URL}/status`)).serverVersion }),
  Plex: async () => ({ version: (await plex<{ MediaContainer: { version: string } }>(`${PLEX_URL}/identity`)).MediaContainer.version }),
  FlareSolverr: async () => ({ version: (await json<{ version: string }>(FLARESOLVERR_URL)).version }),
}
export type AppState = { fails: number; down: boolean; version?: string; started?: string }

async function apps() {
  const state = getSetting<Record<string, AppState>>('bot:apps') ?? {}
  await Promise.all(
    Object.entries(APPS).map(async ([name, check]) => {
      const s = (state[name] ??= { fails: 0, down: false })
      try {
        const now = await check()
        if (s.down) announce('system', embed({ colour: 'ok', ...appCard(name), title: `${name} is back`, description: 'It answers again.' }))
        else if (s.started && now.started && s.started !== now.started)
          announce('system', embed({ colour: 'info', ...appCard(name), title: `${name} restarted`, description: 'It started again by itself or after an update.' }))
        Object.assign(s, { fails: 0, down: false }, now)
      } catch (e) {
        if (++s.fails !== 2) return
        s.down = true
        const vpn = name === 'qBittorrent' ? ' It runs inside the VPN container, so the VPN may be down too.' : ' Check its container in Portainer.'
        const error = sentence((e as Error).message)
        announce('system', embed({ colour: 'danger', ...appCard(name), title: `${name} is down`, description: `Arrmy can't reach it.${vpn}`, footer: error }), true)
      }
    }),
  )
  setSetting('bot:apps', state) // /status reads it
}

async function vpn() {
  const [info, prefs] = await Promise.all([
    (await qbit('/transfer/info')).json() as Promise<{ connection_status: string }>,
    (await qbit('/app/preferences')).json() as Promise<{ listen_port: number }>,
  ])
  const vpnCard = { app: 'gluetun', art: ICONS.gluetun }
  const port = since('vpnPort', prefs.listen_port)
  if (port && port !== prefs.listen_port)
    announce(
      'system',
      embed({ colour: 'info', ...vpnCard, title: "The VPN's forwarded port changed", description: 'qBittorrent listens on the new one.', fields: [['Was', String(port)], ['Now', String(prefs.listen_port)]] }),
    )
  const down = info.connection_status === 'disconnected'
  const s = getSetting<{ fails: number; down: boolean }>('bot:vpn') ?? { fails: 0, down: false }
  if (down && ++s.fails === 2) {
    s.down = true
    announce('system', embed({ colour: 'danger', ...vpnCard, title: 'The VPN is down', description: 'qBittorrent has no connection, so downloads have stopped.' }), true)
  }
  if (!down) {
    if (s.down) announce('system', embed({ colour: 'ok', ...vpnCard, title: 'The VPN is back', description: 'qBittorrent is connected again.' }))
    Object.assign(s, { fails: 0, down: false })
  }
  setSetting('bot:vpn', s)
}

async function health() {
  const last = getSetting<string[]>('bot:health')
  const items = (
    await Promise.all(
      (Object.keys(ARRS) as (keyof typeof ARRS)[]).map((app) =>
        arr<{ message: string }[]>(app, '/health')
          .then((list) => list.map((h) => `${ARRS[app]}: ${h.message}`))
          // An app that's down keeps its last warnings rather than having them all "resolved".
          .catch(() => (last ?? []).filter((h) => h.startsWith(`${ARRS[app]}: `))),
      ),
    )
  ).flat()
  const before = since('health', items)
  if (!before) return
  const card = (item: string, resolved: boolean) => {
    const [app, ...message] = item.split(': ')
    return embed({ colour: resolved ? 'ok' : 'danger', ...appCard(app), title: resolved ? 'Health warning resolved' : 'Health warning', description: sentence(message.join(': ')) })
  }
  for (const h of items.filter((x) => !before.includes(x))) announce('system', card(h, false))
  for (const h of before.filter((x) => !items.includes(x))) announce('system', card(h, true))
}

const LOW = 0.1 // disks warn under 10% free

async function disks() {
  const all = await arr<{ path: string; freeSpace: number; totalSpace: number }[]>('radarr', '/diskspace')
  const found = [
    { name: 'media', disk: all.find((d) => d.path === '/data') },
    { name: 'config', disk: all.find((d) => d.path === '/config') },
  ].flatMap(({ name, disk }) => (disk ? [{ name, disk, low: disk.freeSpace / disk.totalSpace < LOW }] : []))
  const before = since('disks', Object.fromEntries(found.map((d) => [d.name, d.low])))
  for (const { name, disk, low } of found) {
    const fields: [string, string][] = [
      ['Free', size(disk.freeSpace)],
      ['Size', size(disk.totalSpace)],
      ['Used', `${Math.round((1 - disk.freeSpace / disk.totalSpace) * 100)}%`],
    ]
    if (low && !before?.[name])
      announce('system', embed({ colour: 'danger', app: 'Arrmy', title: `The ${name} disk is nearly full`, description: 'Under 10% is free. Remove something, or add space.', fields }), true)
    if (!low && before?.[name]) announce('system', embed({ colour: 'ok', app: 'Arrmy', title: `The ${name} disk has room again`, fields }))
  }
}

// The backup container's folder, mounted read-only.
const BACKUPS = process.env.BACKUPS_PATH ?? '/backups'

async function backups() {
  let files: { name: string; time: number; bytes: number }[]
  try {
    files = readdirSync(BACKUPS)
      .filter((f) => /^arrmy-.*\.tar\.gz$/.test(f))
      .map((f) => ({ name: f, time: statSync(join(BACKUPS, f)).mtimeMs, bytes: statSync(join(BACKUPS, f)).size }))
  } catch {
    return // not mounted
  }
  const newest = files.sort((a, b) => b.time - a.time)[0]
  const before = since('backup', newest?.name ?? '')
  if (newest && before !== undefined && before !== newest.name)
    announce('system', embed({ colour: 'ok', app: 'Arrmy', title: 'Config backup saved', description: "Every app's settings, kept for a week.", fields: [['File', newest.name], ['Size', size(newest.bytes)]] }))
  const late = !newest || Date.now() - newest.time > 26 * 3_600_000 // one a night at 04:00
  const wasLate = since('backupLate', late)
  if (late && !wasLate)
    announce(
      'system',
      embed({
        colour: 'danger',
        app: 'Arrmy',
        title: 'No config backup for over a day',
        description: `${newest ? `The last one is ${newest.name}.` : 'There are none.'} Check the backup container's log in Portainer.`,
      }),
      true,
    )
}

// #activity: who started watching or listening. Plex needs the Admin's Plex token, saved when they sign in.
const playing: Record<string, Set<string>> = {}

/** Posts sessions that weren't there last time; the first look after a restart only records. */
async function newSessions<T>(app: string, sessions: T[], id: (s: T) => string, card: (s: T) => Promise<Embed>) {
  const before = playing[app]
  playing[app] = new Set(sessions.map(id))
  if (before) for (const s of sessions.filter((x) => !before.has(id(x)))) announce('activity', await card(s))
}

type PlexSession = {
  sessionKey: string
  type: string
  title: string
  year?: number
  grandparentTitle?: string
  parentIndex?: number
  index?: number
  User?: { title: string }
  Player?: { title?: string; product?: string }
}
const plexTitle = (s: PlexSession) =>
  s.type === 'episode'
    ? `${s.grandparentTitle} · S${s.parentIndex}E${s.index} · ${s.title}`
    : s.type === 'track'
      ? `${s.grandparentTitle} · ${s.title}`
      : `${s.title}${s.year ? ` (${s.year})` : ''}`

async function plexSessions() {
  const token = getSetting<string>('plexToken')
  if (!token) return
  const list = (await plex<{ MediaContainer: { Metadata?: PlexSession[] } }>(`${PLEX_URL}/status/sessions`, token)).MediaContainer.Metadata ?? []
  await newSessions('plex', list, (s) => s.sessionKey, async (s) => {
    const verb = s.type === 'track' ? 'listening' : 'watching'
    return embed({
      colour: 'info',
      app: 'Plex',
      appUrl: APP_URLS.Plex,
      title: plexTitle(s),
      ...(await plexArt(s)),
      description: `**${s.User?.title ?? 'Someone'}** started ${verb} on ${s.Player?.title ?? s.Player?.product ?? 'a device'}.`,
    })
  })
}

type AbsSession = { id: string; userId: string; displayTitle: string; displayAuthor?: string; deviceInfo?: { deviceName?: string; clientName?: string; browserName?: string; model?: string } }

async function audiobookshelfSessions() {
  if (!process.env.ABS_API_KEY) return
  const [{ openSessions }, { users }] = await Promise.all([
    abs<{ openSessions: AbsSession[] }>('/users/online'),
    abs<{ users: { id: string; username: string }[] }>('/users'),
  ])
  await newSessions('abs', openSessions, (s) => s.id, async (s) => {
    const d = s.deviceInfo
    const device = d?.deviceName ?? d?.model ?? d?.clientName ?? d?.browserName ?? 'a device'
    const who = users.find((u) => u.id === s.userId)?.username ?? 'Someone'
    return embed({
      colour: 'info',
      app: 'Audiobookshelf',
      appUrl: APP_URLS.Audiobookshelf,
      title: s.displayTitle,
      ...(await bookArt(s.displayTitle, s.displayAuthor)),
      description: `**${who}** started listening on ${device}.`,
      fields: [['Author', s.displayAuthor]],
    })
  })
}

// #admin-log: settings changed inside the apps, found by comparing them every few minutes, so without who did it.
// LazyLibrarian is missing: its API reads one setting at a time.
const SETTINGS = {
  radarr: ['/config/host', '/config/naming', '/config/mediamanagement', '/config/ui', '/config/downloadclient', '/config/indexer', '/downloadclient', '/indexer', '/notification', '/qualityprofile', '/qualitydefinition', '/customformat', '/rootfolder', '/delayprofile', '/tag', '/importlist'],
  sonarr: ['/config/host', '/config/naming', '/config/mediamanagement', '/config/ui', '/config/downloadclient', '/config/indexer', '/downloadclient', '/indexer', '/notification', '/qualityprofile', '/qualitydefinition', '/customformat', '/rootfolder', '/delayprofile', '/tag', '/importlist', '/releaseprofile'],
  prowlarr: ['/config/host', '/config/ui', '/indexer', '/applications', '/indexerproxy', '/downloadclient', '/notification', '/tag', '/appprofile'],
}

const code = (value: string) => `\`${value.replace(/`/g, "'").slice(0, 60) || ' '}\``

function reportChanges(app: string, url: string | undefined, now: Record<string, string>) {
  const before = since(`settings:${app}`, now)
  const lines = before ? changes(before, now) : []
  if (!lines.length) return
  const shown = lines.map((l) => {
    const m = l.match(/^(.*): (.*) → (.*)$/s) ?? l.match(/^(.*): (added|removed)(?: \((.*)\))?$/s)
    if (!m) return `• ${l}` // "…and 5 more"
    return m[2] === 'added' || m[2] === 'removed' ? `• ${m[1]}: ${m[2]}${m[3] ? ` ${code(m[3])}` : ''}` : `• ${m[1]}: ${code(m[2])} → ${code(m[3])}`
  })
  announce('admin-log', embed({ colour: 'info', ...appCard(app), appUrl: url, title: 'Settings changed', url, description: shown.join('\n') }))
}

async function settingsChanges() {
  for (const app of Object.keys(SETTINGS) as (keyof typeof SETTINGS)[]) {
    try {
      const parts = await Promise.all(SETTINGS[app].map(async (path) => [path.slice(1), await arr(app, path)] as const))
      reportChanges(ARRS[app], publicUrl(app, '/settings'), flatten(Object.fromEntries(parts)))
    } catch (e) {
      console.warn(`[bot] ${ARRS[app]} settings: ${(e as Error).message}`) // down: compare next time
    }
  }
  reportChanges('qBittorrent', publicUrl('qbit'), flatten({ preferences: await (await qbit('/app/preferences')).json() }))
}

async function accessChanges() {
  const people: Record<string, { name: string; avatar?: string }[]> = {}
  const token = getSetting<string>('plexToken')
  if (token) {
    // plex.tv retired /api/v2/friends (410 Gone) in 2026; /api/users still lists who the server is shared with.
    const res = await fetch('https://plex.tv/api/users', { headers: { 'X-Plex-Token': token }, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`plex.tv /api/users → ${res.status}`)
    people.Plex = plexUsers(await res.text())
  }
  if (process.env.ABS_API_KEY) people.Audiobookshelf = (await abs<{ users: { username: string }[] }>('/users')).users.map((u) => ({ name: u.username }))
  for (const [app, list] of Object.entries(people)) {
    const now = list.map((p) => p.name).sort()
    const before = since(`access:${app}`, now)
    if (!before) continue
    for (const p of list.filter((x) => !before.includes(x.name)))
      announce('admin-log', embed({ colour: 'ok', app, appUrl: APP_URLS[app], title: `${p.name} got access to ${app}`, art: p.avatar ?? ICONS[app] }))
    for (const name of before.filter((x) => !now.includes(x)))
      announce('admin-log', embed({ colour: 'neutral', app, appUrl: APP_URLS[app], title: `${name} lost access to ${app}`, art: ICONS[app] }))
  }
}

// #updates
const REPO = 'Craftyplayz/Arrmy'
const github = <T>(path: string) => json<T>(`https://api.github.com${path}`, { Accept: 'application/vnd.github+json', 'User-Agent': 'Arrmy' })
const portainer = () => process.env.PORTAINER_STACK_URL && linked('Pull and redeploy', process.env.PORTAINER_STACK_URL)

async function arrmyChanges() {
  type Commit = { sha: string; html_url: string; author?: { avatar_url?: string } | null; commit: { message: string; author: { name: string } } }
  const commits = await github<Commit[]>(`/repos/${REPO}/commits?sha=main&per_page=20`)
  const last = since('commit', commits[0]?.sha)
  if (last && last !== commits[0]?.sha) {
    const i = commits.findIndex((c) => c.sha === last)
    for (const c of (i < 0 ? commits.slice(0, 5) : commits.slice(0, i)).reverse()) {
      const [subject, ...body] = c.commit.message.split('\n')
      const details = body.join('\n').replace(/^Co-Authored-By:.*$/gim, '').trim()
      announce(
        'updates',
        embed({
          colour: 'info',
          app: 'GitHub',
          appUrl: `https://github.com/${REPO}`,
          title: subject,
          url: c.html_url,
          description: details ? details.slice(0, 600) + (details.length > 600 ? '…' : '') : undefined,
          art: c.author?.avatar_url,
          footer: `Arrmy · main · ${c.sha.slice(0, 7)} · ${c.commit.author.name}`,
        }),
      )
    }
  }
  type Release = { tag_name: string; name: string; html_url: string; prerelease: boolean }
  const [release] = await github<Release[]>(`/repos/${REPO}/releases?per_page=1`)
  const lastRelease = since('arrmyRelease', release?.tag_name ?? '')
  if (release && lastRelease !== undefined && lastRelease !== release.tag_name)
    announce(
      'updates',
      embed({
        colour: 'accent',
        app: 'GitHub',
        appUrl: `https://github.com/${REPO}/releases`,
        title: `${release.name || release.tag_name} is out`,
        url: release.html_url,
        description: `${release.prerelease ? 'A test release. ' : ''}To run it, set the stack's Repository reference to \`refs/tags/${release.tag_name}\` in Portainer.`,
        fields: [['Portainer', portainer()]],
      }),
      !release.prerelease,
    )
}

/** Tells #updates when the server starts running a new version of Arrmy (baked into the image at build). */
function arrmyRunning() {
  const version = process.env.ARRMY_VERSION
  const before = version && since('arrmyVersion', version)
  if (before && before !== version)
    announce('updates', embed({ colour: 'ok', app: 'Arrmy', title: `The server now runs Arrmy ${version}`, fields: [['Was', before]] }))
}

const latest = async (repo: string) => {
  const r = await github<{ tag_name: string; html_url: string }>(`/repos/${repo}/releases/latest`)
  return { version: r.tag_name, url: r.html_url }
}

/** Each app's newest release. LazyLibrarian has no releases, only commits, so it isn't here. */
const RELEASES: Record<string, () => Promise<{ version: string; url: string }>> = {
  Radarr: () => latest('Radarr/Radarr'),
  Sonarr: () => latest('Sonarr/Sonarr'),
  Prowlarr: () => latest('Prowlarr/Prowlarr'),
  qBittorrent: async () => {
    // Tags only, no GitHub releases.
    const tags = (await github<{ name: string }[]>('/repos/qbittorrent/qBittorrent/tags?per_page=50')).map((t) => t.name).filter((t) => /^release-\d+\.\d+\.\d+$/.test(t))
    const version = tags.sort((a, b) => compareVersions(b, a))[0]
    return { version, url: 'https://www.qbittorrent.org/news' }
  },
  Audiobookshelf: () => latest('advplyr/audiobookshelf'),
  FlareSolverr: () => latest('FlareSolverr/FlareSolverr'),
  gluetun: () => latest('qdm12/gluetun'),
  cloudflared: () => latest('cloudflare/cloudflared'),
  Plex: async () => {
    const d = await json<{ computer: { Linux: { version: string } } }>('https://plex.tv/api/downloads/5.json')
    return { version: d.computer.Linux.version, url: 'https://forums.plex.tv/t/plex-media-server/30447' }
  },
}

async function appUpdates() {
  const running = getSetting<Record<string, AppState>>('bot:apps') ?? {}
  for (const [app, check] of Object.entries(RELEASES)) {
    try {
      const { version, url } = await check()
      const before = since(`release:${app}`, version)
      const current = running[app]?.version
      // Only news if the server runs something older; for apps that can't say, any release after the first look.
      const isNew = current ? compareVersions(version, current) > 0 : before !== undefined
      if (before === version || !isNew) continue
      announce(
        'updates',
        embed({
          colour: 'accent',
          ...appCard(app),
          title: `${app} ${version.replace(/^(v|release-)/, '')} is out`,
          url,
          description: "Update it in Portainer when you're ready.",
          fields: [
            ['The server runs', current?.replace(/^v/, '')],
            ['Release notes', linked('Read them', url)],
            ['Portainer', portainer()],
          ],
        }),
        true,
      )
    } catch (e) {
      console.warn(`[bot] ${app} releases: ${(e as Error).message}`)
    }
  }
}

/** Each check on its own, for tests. */
export const checks = {
  downloads,
  problems,
  apps,
  vpn,
  health,
  disks,
  backups,
  plexSessions,
  audiobookshelfSessions,
  settingsChanges,
  accessChanges,
  arrmyChanges,
  appUpdates,
}

export function startBot() {
  // Problems also reach a plain webhook; everything else needs the bot.
  if (botEnabled() || process.env.DISCORD_WEBHOOK_URL) every(2, 'problems', problems)
  if (!botEnabled()) return
  registerCommands(COMMANDS).catch((e) => console.warn(`[bot] slash commands: ${e.message}`))
  syncBarEmoji().catch((e) => console.warn(`[bot] progress bar emoji: ${e.message}`))
  arrmyRunning()
  every(5 / 60, 'downloads', downloads)
  every(1, 'apps', apps)
  every(1, 'VPN', vpn)
  every(5, 'health', health)
  every(10, 'disks', disks)
  every(30, 'backups', backups)
  every(0.5, 'Plex sessions', plexSessions)
  every(0.5, 'Audiobookshelf sessions', audiobookshelfSessions)
  every(5, 'settings', settingsChanges)
  every(10, 'access', accessChanges)
  every(15, 'Arrmy on GitHub', arrmyChanges)
  every(360, 'app releases', appUpdates, 3) // after `apps` has read what the server runs
}
