// What the Discord bot posts by itself: checks that run every so often and post what changed since the last one.
// Each remembers what it saw in the settings table, so a restart doesn't post everything again, and the first check
// after the bot is set up only records, so setting it up doesn't flood the channels.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { adminOverview } from './admin'
import { arr } from './arr'
import { abs, ABS_URL, ll } from './books'
import { CATEGORY_NAMES, changes, compareVersions, downloadMessage, flatten, linked, problemKey, size } from './botrules'
import { COMMANDS } from './commands'
import { getSetting, setSetting } from './db'
import { announce, botEnabled, edit, post, publicUrl, registerCommands } from './discord'
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

// #downloads: one message per torrent, edited as it goes. id '' = its message was deleted by hand, so leave it be.
type Tracked = Record<string, { id: string; text: string }>

async function downloads() {
  const list = (await torrents()).filter((t) => t.category in CATEGORY_NAMES)
  const tracked = getSetting<Tracked>('bot:downloads') ?? {}
  for (const t of list) {
    const hash = t.hash.toLowerCase()
    const text = downloadMessage(t)
    const was = tracked[hash]
    if (!was) {
      if (t.progress < 1) tracked[hash] = { id: await post('downloads', text), text } // finished before the bot saw it: no message
    } else if (was.id && was.text !== text) {
      if (await edit('downloads', was.id, text)) was.text = text
      else was.id = ''
    }
    if (t.progress >= 1) delete tracked[hash]
  }
  for (const [hash, was] of Object.entries(tracked)) {
    if (list.some((t) => t.hash.toLowerCase() === hash)) continue
    if (was.id) await edit('downloads', was.id, `🗑️ ${was.text.split('\n')[0].replace(/^\S+ /, '')}\nRemoved from qBittorrent`)
    delete tracked[hash]
  }
  setSetting('bot:downloads', tracked)
}

// #problems. Arrmy fixes most stalled downloads by itself within 15 minutes (dead.ts), so a Problem is only announced
// once it has lasted 20; one Arrmy raised itself after its tries ran out is announced at once.
type Seen = Record<string, { first: number; told: boolean }>
const GRACE = 20 * 60_000

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
    announce('problems', `⚠️ **${p.kind}**: ${p.title}\n${p.detail}\n${linked('Fix it in the Admin view', publicUrl('arrmy', '/admin#problems'))}`, true)
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
        if (s.down) announce('system', `✅ **${name}** is back.`)
        else if (s.started && now.started && s.started !== now.started) announce('system', `🔄 **${name}** restarted.`)
        Object.assign(s, { fails: 0, down: false }, now)
      } catch (e) {
        if (++s.fails !== 2) return
        s.down = true
        const vpn = name === 'qBittorrent' ? ' It runs inside the VPN container, so the VPN may be down too.' : ''
        announce('system', `🔴 **${name}** is down: ${(e as Error).message}.${vpn}`, true)
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
  const port = since('vpnPort', prefs.listen_port)
  if (port && port !== prefs.listen_port) announce('system', `🔀 The VPN's forwarded port changed: ${port} → ${prefs.listen_port}. qBittorrent listens on the new one.`)
  const down = info.connection_status === 'disconnected'
  const s = getSetting<{ fails: number; down: boolean }>('bot:vpn') ?? { fails: 0, down: false }
  if (down && ++s.fails === 2) {
    s.down = true
    announce('system', '🔴 **The VPN is down**: qBittorrent has no connection, so downloads have stopped.', true)
  }
  if (!down) {
    if (s.down) announce('system', '✅ **The VPN** is back: qBittorrent is connected again.')
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
  for (const h of items.filter((x) => !before.includes(x))) announce('system', `⚠️ ${h}`)
  for (const h of before.filter((x) => !items.includes(x))) announce('system', `✅ Resolved: ${h}`)
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
    const free = `${size(disk.freeSpace)} free of ${size(disk.totalSpace)} (${Math.round((disk.freeSpace / disk.totalSpace) * 100)}%)`
    if (low && !before?.[name]) announce('system', `🟠 **The ${name} disk is nearly full**: ${free}.`, true)
    if (!low && before?.[name]) announce('system', `✅ The ${name} disk has room again: ${free}.`)
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
  if (newest && before !== undefined && before !== newest.name) announce('system', `💾 Config backup saved: ${newest.name} (${size(newest.bytes)}).`)
  const late = !newest || Date.now() - newest.time > 26 * 3_600_000 // one a night at 04:00
  const wasLate = since('backupLate', late)
  if (late && !wasLate)
    announce('system', `🔴 **No config backup for over a day.** ${newest ? `The last one is ${newest.name}.` : 'There are none.'} Check the backup container's log in Portainer.`, true)
}

// #activity: who started watching or listening. Plex needs the Admin's Plex token, saved when they sign in.
const playing: Record<string, Set<string>> = {}

/** Posts sessions that weren't there last time; the first look after a restart only records. */
function newSessions(app: string, sessions: { id: string; text: string }[]) {
  const before = playing[app]
  playing[app] = new Set(sessions.map((s) => s.id))
  if (before) for (const s of sessions.filter((x) => !before.has(x.id))) announce('activity', s.text)
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
    ? `**${s.grandparentTitle}** S${s.parentIndex}E${s.index} · ${s.title}`
    : s.type === 'track'
      ? `**${s.grandparentTitle}** – ${s.title}`
      : `**${s.title}**${s.year ? ` (${s.year})` : ''}`

async function plexSessions() {
  const token = getSetting<string>('plexToken')
  if (!token) return
  const list = (await plex<{ MediaContainer: { Metadata?: PlexSession[] } }>(`${PLEX_URL}/status/sessions`, token)).MediaContainer.Metadata ?? []
  newSessions(
    'plex',
    list.map((s) => ({
      id: s.sessionKey,
      text: `▶️ **${s.User?.title ?? 'Someone'}** started ${plexTitle(s)} on ${s.Player?.title ?? s.Player?.product ?? 'a device'} (Plex).`,
    })),
  )
}

type AbsSession = { id: string; userId: string; displayTitle: string; displayAuthor?: string; deviceInfo?: { deviceName?: string; clientName?: string; browserName?: string; model?: string } }

async function audiobookshelfSessions() {
  if (!process.env.ABS_API_KEY) return
  const [{ openSessions }, { users }] = await Promise.all([
    abs<{ openSessions: AbsSession[] }>('/users/online'),
    abs<{ users: { id: string; username: string }[] }>('/users'),
  ])
  newSessions(
    'abs',
    openSessions.map((s) => {
      const d = s.deviceInfo
      const device = d?.deviceName ?? d?.model ?? d?.clientName ?? d?.browserName ?? 'a device'
      const who = users.find((u) => u.id === s.userId)?.username ?? 'Someone'
      return { id: s.id, text: `🎧 **${who}** started listening to **${s.displayTitle}**${s.displayAuthor ? ` by ${s.displayAuthor}` : ''} on ${device}.` }
    }),
  )
}

// #admin-log: settings changed inside the apps, found by comparing them every few minutes, so without who did it.
// LazyLibrarian is missing: its API reads one setting at a time.
const SETTINGS = {
  radarr: ['/config/host', '/config/naming', '/config/mediamanagement', '/config/ui', '/config/downloadclient', '/config/indexer', '/downloadclient', '/indexer', '/notification', '/qualityprofile', '/qualitydefinition', '/customformat', '/rootfolder', '/delayprofile', '/tag', '/importlist'],
  sonarr: ['/config/host', '/config/naming', '/config/mediamanagement', '/config/ui', '/config/downloadclient', '/config/indexer', '/downloadclient', '/indexer', '/notification', '/qualityprofile', '/qualitydefinition', '/customformat', '/rootfolder', '/delayprofile', '/tag', '/importlist', '/releaseprofile'],
  prowlarr: ['/config/host', '/config/ui', '/indexer', '/applications', '/indexerproxy', '/downloadclient', '/notification', '/tag', '/appprofile'],
}

function reportChanges(app: string, url: string | undefined, now: Record<string, string>) {
  const before = since(`settings:${app}`, now)
  const lines = before ? changes(before, now) : []
  if (lines.length) announce('admin-log', `⚙️ Settings changed in ${linked(`**${app}**`, url)}:\n${lines.map((l) => `• ${l.slice(0, 160)}`).join('\n')}`)
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
  const people: Record<string, string[]> = {}
  const token = getSetting<string>('plexToken')
  if (token) people.Plex = (await plex<{ username?: string; title?: string }[]>('https://plex.tv/api/v2/friends', token)).map((f) => f.title || f.username || '?')
  if (process.env.ABS_API_KEY) people.Audiobookshelf = (await abs<{ users: { username: string }[] }>('/users')).users.map((u) => u.username)
  for (const [app, now] of Object.entries(people)) {
    const before = since(`access:${app}`, now.sort())
    if (!before) continue
    for (const p of now.filter((x) => !before.includes(x))) announce('admin-log', `👤 **${p}** got access to ${app}.`)
    for (const p of before.filter((x) => !now.includes(x))) announce('admin-log', `👤 **${p}** lost access to ${app}.`)
  }
}

// #updates
const REPO = 'Craftyplayz/Arrmy'
const github = <T>(path: string) => json<T>(`https://api.github.com${path}`, { Accept: 'application/vnd.github+json', 'User-Agent': 'Arrmy' })
const portainer = () => linked('Pull and redeploy in Portainer', process.env.PORTAINER_STACK_URL)

async function arrmyChanges() {
  type Commit = { sha: string; html_url: string; commit: { message: string; author: { name: string } } }
  const commits = await github<Commit[]>(`/repos/${REPO}/commits?sha=main&per_page=20`)
  const last = since('commit', commits[0]?.sha)
  if (last && last !== commits[0]?.sha) {
    const i = commits.findIndex((c) => c.sha === last)
    for (const c of (i < 0 ? commits.slice(0, 5) : commits.slice(0, i)).reverse())
      announce('updates', `📝 ${linked(`\`${c.sha.slice(0, 7)}\``, c.html_url)} ${c.commit.message.split('\n')[0]} · ${c.commit.author.name}`)
  }
  type Release = { tag_name: string; name: string; html_url: string; prerelease: boolean }
  const [release] = await github<Release[]>(`/repos/${REPO}/releases?per_page=1`)
  const lastRelease = since('arrmyRelease', release?.tag_name ?? '')
  if (release && lastRelease !== undefined && lastRelease !== release.tag_name)
    announce(
      'updates',
      `🚀 ${linked(`**${release.name || release.tag_name}**`, release.html_url)} is out${release.prerelease ? ' (a test release)' : ''}. To run it, set the stack's Repository reference to \`refs/tags/${release.tag_name}\` in Portainer.`,
      !release.prerelease,
    )
}

/** Tells #updates when the server starts running a new version of Arrmy (baked into the image at build). */
function arrmyRunning() {
  const version = process.env.ARRMY_VERSION
  const before = version && since('arrmyVersion', version)
  if (before && before !== version) announce('updates', `✅ The server now runs **Arrmy ${version}**.`)
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
      announce('updates', `⬆️ **${app} ${version.replace(/^(v|release-)/, '')}** is out${current ? ` (the server runs ${current})` : ''}. ${linked('Release notes', url)} · ${portainer()}`, true)
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
  arrmyRunning()
  every(0.5, 'downloads', downloads)
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
