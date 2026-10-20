// Talks to Discord. With a bot token Arrmy posts embeds (see embeds.ts) to its own channels (see botrules.ts) through
// Discord's API, with no live connection: slash commands arrive at /api/discord. Without one, Requests and Problems still
// go to DISCORD_WEBHOOK_URL if it's set, and everything else is skipped.
import { allCells } from './barart'
import { CHANNELS, type Channel } from './botrules'
import { getSetting, setSetting } from './db'
import { distinctLinks, type Embed } from './embeds'
import { drawLogo, LOGO_VERSION } from './logo'

const API = 'https://discord.com/api/v10'

const token = () => process.env.DISCORD_BOT_TOKEN
const guild = () => process.env.DISCORD_GUILD_ID
export const botEnabled = () => !!(token() && guild() && process.env.DISCORD_PUBLIC_KEY)

/** A page of one of the apps at its public address, or undefined without PUBLIC_DOMAIN. */
export const publicUrl = (app: 'arrmy' | 'radarr' | 'sonarr' | 'prowlarr' | 'qbit' | 'plex' | 'books', path = '') =>
  process.env.PUBLIC_DOMAIN ? `https://${app}.${process.env.PUBLIC_DOMAIN}${path}` : undefined

class DiscordError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

/** Calls Discord, waiting out its rate limits (429) a few times before giving up. */
async function discord<T>(url: string, method = 'GET', body?: unknown, auth = true): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url.startsWith('http') ? url : `${API}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/Craftyplayz/Arrmy, 1)',
        ...(auth && { Authorization: `Bot ${token()}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
    const text = await res.text()
    if (res.status === 429 && attempt < 4) {
      await sleep((JSON.parse(text).retry_after ?? 1) * 1000)
      continue
    }
    if (!res.ok) throw new DiscordError(res.status, `Discord ${method} ${url.split('?')[0].replace(/\/webhooks\/.*/, '/webhooks/…')} → ${res.status} ${text.slice(0, 200)}`)
    return (text ? JSON.parse(text) : undefined) as T
  }
}

type DiscordChannel = { id: string; name: string; type: number; parent_id?: string | null }
let channels: Promise<Record<Channel, string>> | undefined

/** The Arrmy category and its channels, created when missing (found again by name after a restart). */
async function setupChannels() {
  const all = await discord<DiscordChannel[]>(`/guilds/${guild()}/channels`)
  const category =
    all.find((c) => c.type === 4 && c.name.toLowerCase() === 'arrmy') ??
    (await discord<DiscordChannel>(`/guilds/${guild()}/channels`, 'POST', { name: 'Arrmy', type: 4 }))
  const ids = {} as Record<Channel, string>
  let created = false
  for (const [name, topic] of Object.entries(CHANNELS) as [Channel, string][]) {
    const found = all.find((c) => c.type === 0 && c.name === name && c.parent_id === category.id)
    created ||= !found
    ids[name] = (found ?? (await discord<DiscordChannel>(`/guilds/${guild()}/channels`, 'POST', { name, type: 0, parent_id: category.id, topic }))).id
  }
  // A channel made later (#downloaded) would sit at the bottom; put them all back in CHANNELS' order.
  if (created) await discord(`/guilds/${guild()}/channels`, 'PATCH', (Object.keys(CHANNELS) as Channel[]).map((name, position) => ({ id: ids[name], position })))
  return ids
}

const channelId = async (channel: Channel) => {
  channels ??= setupChannels().catch((e) => {
    channels = undefined
    throw e
  })
  return (await channels)[channel]
}

// Everything sent to Discord waits its turn in one queue, which keeps well inside Discord's rate limits.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job)
  queue = run.catch(() => {})
  return run
}

/** Message body. `ping` @mentions the Admin (DISCORD_ADMIN_ID): mentions only notify from the text, never an embed. */
function message(embeds: Embed | Embed[], ping = false) {
  const admin = ping ? process.env.DISCORD_ADMIN_ID : undefined
  return {
    ...(admin && { content: `<@${admin}>` }),
    embeds: distinctLinks([embeds].flat().slice(0, 10)),
    allowed_mentions: { parse: [], users: admin ? [admin] : [] },
  }
}

/** Posts to one of the bot's channels and returns the message id. A channel deleted by hand is created again. */
export function post(channel: Channel, embed: Embed, ping = false) {
  return serial(async () => {
    const send = async () => (await discord<{ id: string }>(`/channels/${await channelId(channel)}/messages`, 'POST', message(embed, ping))).id
    try {
      return await send()
    } catch (e) {
      if (!(e instanceof DiscordError && e.status === 404)) throw e
      channels = undefined
      return send()
    }
  })
}

/** Rewrites a message the bot posted. False if it's gone (deleted by hand). */
export function edit(channel: Channel, id: string, embed: Embed) {
  return serial(async () => {
    try {
      // A message from before the cards (1.1.0-rc.10) had text and hid link previews, which hides cards too: clear both.
      await discord(`/channels/${await channelId(channel)}/messages/${id}`, 'PATCH', { content: '', embeds: [embed], flags: 0 })
      return true
    } catch (e) {
      if (e instanceof DiscordError && e.status === 404) return false
      throw e
    }
  })
}

/** Deletes a message the bot posted. Already gone is fine. */
export function remove(channel: Channel, id: string) {
  return serial(async () => {
    try {
      await discord(`/channels/${await channelId(channel)}/messages/${id}`, 'DELETE')
    } catch (e) {
      if (!(e instanceof DiscordError && e.status === 404)) throw e
    }
  })
}

/** The bot's own recent messages in a channel (the last 100), newest first. */
export function ownMessages(channel: Channel) {
  return serial(async () => {
    const me = await discord<{ id: string }>('/users/@me')
    const list = await discord<{ id: string; author: { id: string }; embeds: Embed[] }[]>(`/channels/${await channelId(channel)}/messages?limit=100`)
    return list.filter((m) => m.author.id === me.id)
  })
}

/** Posts in the background: never slows down or fails whatever Arrmy was doing. */
export function announce(channel: Channel, embed: Embed, ping = false) {
  const warn = (e: Error) => console.warn(`[discord] #${channel}: ${e.message}`)
  if (botEnabled()) return void post(channel, embed, ping).catch(warn)
  const webhook = process.env.DISCORD_WEBHOOK_URL
  if (webhook && (channel === 'requests' || channel === 'problems'))
    serial(() => discord(webhook, 'POST', message(embed, ping), false)).catch(warn)
}

/** Discord's id for the bot's app, which slash commands and emoji belong to. */
const appId = async () => (await discord<{ id: string }>('/applications/@me')).id

/** Registers the slash commands in the server. Admin-only to start with: Server Settings → Integrations can open them up. */
export async function registerCommands(commands: object[]) {
  const id = await appId()
  await discord(`/applications/${id}/guilds/${guild()}/commands`, 'PUT', commands.map((c) => ({ ...c, default_member_permissions: '0' })))
}

/**
 * Uploads the progress bar's pieces as the app's own emoji (they work in any server, no permission needed), once, and
 * remembers their ids for barEmoji.
 */
export async function syncBarEmoji() {
  const id = await appId()
  const { items } = await discord<{ items: { id: string; name: string }[] }>(`/applications/${id}/emojis`)
  const have = Object.fromEntries(items.map((e) => [e.name, e.id]))
  for (const [name, image] of allCells())
    have[name] ??= (await serial(() => discord<{ id: string }>(`/applications/${id}/emojis`, 'POST', { name, image: `data:image/png;base64,${image.toString('base64')}` }))).id
  setSetting('bot:emoji', have)
}

/** Gives the bot Arrmy's logo as its avatar, once per version of the logo: Discord allows only a few changes an hour. */
export async function syncAvatar() {
  if (getSetting<number>('bot:avatar') === LOGO_VERSION) return
  await discord('/users/@me', 'PATCH', { avatar: `data:image/png;base64,${drawLogo().toString('base64')}` })
  setSetting('bot:avatar', LOGO_VERSION)
}

/** The bar's emoji ids by name; empty until syncBarEmoji has run, and the bar falls back to text. */
export const barEmoji = () => getSetting<Record<string, string>>('bot:emoji') ?? {}

/** Replaces the "thinking…" placeholder of a slash command with its answer. */
export const answerInteraction = (applicationId: string, interactionToken: string, embeds: Embed[]) =>
  discord(`/webhooks/${applicationId}/${interactionToken}/messages/@original`, 'PATCH', message(embeds), false)
