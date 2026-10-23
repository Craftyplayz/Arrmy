// Talks to Discord. With a bot token Arrmy posts embeds (see embeds.ts) to its own channels and forum threads (see
// botrules.ts) through Discord's API, with no live connection: slash commands arrive at /api/discord. Without one,
// Requests and Problems still go to DISCORD_WEBHOOK_URL if it's set, and everything else is skipped.
import { allCells } from './barart'
import { CHANNELS, FORUMS, forumPermissions, threadUrl, type Channel, type Forum, type ThreadRef } from './botrules'
import { forgetThread, getSetting, getThread, saveThread, setSetting } from './db'
import { compact, distinctLinks, type Embed } from './embeds'
import { drawLogo, LOGO_VERSION } from './logo'
import { byId, type Message } from './replyrules'

const API = 'https://discord.com/api/v10'

const token = () => process.env.DISCORD_BOT_TOKEN
const guild = () => process.env.DISCORD_GUILD_ID
export const botEnabled = () => !!(token() && guild() && process.env.DISCORD_PUBLIC_KEY)

/** A page of one of the apps at its public address, or undefined without PUBLIC_DOMAIN. */
export const publicUrl = (app: 'arrmy' | 'radarr' | 'sonarr' | 'prowlarr' | 'qbit' | 'plex' | 'books' | 'lazylibrarian', path = '') =>
  process.env.PUBLIC_DOMAIN ? `https://${app}.${process.env.PUBLIC_DOMAIN}${path}` : undefined

class DiscordError extends Error {
  status: number
  /** Discord's own error code, e.g. 50083 for an archived thread. */
  code?: number
  constructor(status: number, message: string, code?: number) {
    super(message)
    this.status = status
    this.code = code
  }
}

const gone = (e: unknown) => e instanceof DiscordError && e.status === 404

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

/** Calls Discord, waiting out its rate limits (429) a few times before giving up. */
/** `body` as FormData sends files too (multipart); anything else goes as JSON. */
async function discord<T>(url: string, method = 'GET', body?: unknown, auth = true): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const form = body instanceof FormData
    const res = await fetch(url.startsWith('http') ? url : `${API}${url}`, {
      method,
      headers: {
        ...(!form && { 'Content-Type': 'application/json' }),
        'User-Agent': 'DiscordBot (https://github.com/Craftyplayz/Arrmy, 1)',
        ...(auth && { Authorization: `Bot ${token()}` }),
      },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
    const text = await res.text()
    if (res.status === 429 && attempt < 4) {
      await sleep((JSON.parse(text).retry_after ?? 1) * 1000)
      continue
    }
    if (!res.ok) {
      const code = (() => {
        try {
          return JSON.parse(text).code as number
        } catch {}
      })()
      throw new DiscordError(res.status, `Discord ${method} ${url.split('?')[0].replace(/\/webhooks\/.*/, '/webhooks/…')} → ${res.status} ${text.slice(0, 200)}`, code)
    }
    return (text ? JSON.parse(text) : undefined) as T
  }
}

type DiscordChannel = { id: string; name: string; type: number; parent_id?: string | null; available_tags?: { id: string; name: string }[] }
type Ids = { channels: Record<Channel, string>; forums: Record<Forum, { id: string; tags: Record<string, string> }> }
let ids: Promise<Ids> | undefined

const TEXT = 0
const CATEGORY = 4
const FORUM = 15

/**
 * The Arrmy category with its channels and forums, created when missing (found again by name after a restart), and
 * each forum's tags. The old channels from before the forums (#requests, #system…) are left alone.
 */
async function setup(): Promise<Ids> {
  const all = await discord<DiscordChannel[]>(`/guilds/${guild()}/channels`)
  const category =
    all.find((c) => c.type === CATEGORY && c.name.toLowerCase() === 'arrmy') ??
    (await discord<DiscordChannel>(`/guilds/${guild()}/channels`, 'POST', { name: 'Arrmy', type: CATEGORY }))
  const found = (type: number, name: string) => all.find((c) => c.type === type && c.name.toLowerCase() === name.toLowerCase() && c.parent_id === category.id)
  let created = false
  const channels = {} as Ids['channels']
  for (const [name, topic] of Object.entries(CHANNELS) as [Channel, string][]) {
    const c = found(TEXT, name)
    created ||= !c
    channels[name] = (c ?? (await discord<DiscordChannel>(`/guilds/${guild()}/channels`, 'POST', { name, type: TEXT, parent_id: category.id, topic }))).id
  }
  const me = await discord<{ id: string }>('/users/@me')
  const forums = {} as Ids['forums']
  for (const [key, f] of Object.entries(FORUMS) as [Forum, (typeof FORUMS)[Forum]][]) {
    let c = found(FORUM, f.name.toLowerCase())
    created ||= !c
    c ??= await discord<DiscordChannel>(`/guilds/${guild()}/channels`, 'POST', {
      name: f.name,
      type: FORUM,
      parent_id: category.id,
      topic: f.topic,
      available_tags: f.tags.map((name) => ({ name })),
      default_sort_order: 0, // latest activity: a new post moves its thread to the top
      permission_overwrites: forumPermissions(key, guild()!, me.id, process.env.DISCORD_ADMIN_ID),
    })
    const missing = f.tags.filter((t) => !c!.available_tags?.some((x) => x.name === t))
    if (missing.length)
      c = await discord<DiscordChannel>(`/channels/${c.id}`, 'PATCH', { available_tags: [...(c.available_tags ?? []), ...missing.map((name) => ({ name }))] })
    forums[key] = { id: c.id, tags: Object.fromEntries((c.available_tags ?? []).map((t) => [t.name, t.id])) }
  }
  // Something made later would sit at the bottom: put them back in order, the channels first.
  if (created)
    await discord(`/guilds/${guild()}/channels`, 'PATCH', [...Object.values(channels), ...Object.values(forums).map((f) => f.id)].map((id, position) => ({ id, position })))
  return { channels, forums }
}

const getIds = () => {
  ids ??= setup().catch((e) => {
    ids = undefined
    throw e
  })
  return ids
}

const channelId = async (channel: Channel) => (await getIds()).channels[channel]

// Everything sent to Discord waits its turn in one queue, which keeps well inside Discord's rate limits.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job)
  queue = run.catch(() => {})
  return run
}

/** Message body. `ping` @mentions the Admin (DISCORD_ADMIN_ID): mentions only notify from the text, never an embed. */
function message(embeds: Embed | Embed[], ping = false, components?: object[]) {
  const admin = ping ? process.env.DISCORD_ADMIN_ID : undefined
  return {
    ...(admin && { content: `<@${admin}>` }),
    embeds: distinctLinks([embeds].flat().slice(0, 10)),
    allowed_mentions: { parse: [], users: admin ? [admin] : [] },
    ...(components && { components }),
  }
}

/** What else a post can carry: a text file attached (The Doctarr's list of releases), and buttons. */
export type Extra = { file?: { name: string; text: string }; components?: object[] }

type Upload = { blob: Blob; name: string }

/** The body as JSON, or with files as multipart: Discord wants the JSON in payload_json and each file as files[n]. */
function withFiles(body: Record<string, unknown>, files: Upload[], attach: (attachments: object[]) => Record<string, unknown>) {
  if (!files.length) return body
  const form = new FormData()
  form.append('payload_json', JSON.stringify(attach(files.map((f, id) => ({ id, filename: f.name })))))
  files.forEach((f, i) => form.append(`files[${i}]`, f.blob, f.name))
  return form
}

const textFile = (extra?: Extra): Upload[] => (extra?.file ? [{ blob: new Blob([extra.file.text], { type: 'text/plain' }), name: extra.file.name }] : [])

/** Where a post goes: one of the bot's channels, or a forum thread. */
export type Target = Channel | ThreadRef

const WEEK = 10080 // minutes: Discord archives a thread after a week without posts, and a new post brings it back
const ARCHIVED = 50083 // Discord's error for posting in an archived thread

/** The cover as a file to attach, or undefined if it can't be fetched (then the card keeps it as its thumbnail). */
async function cover(art?: string | null) {
  if (!art || !/^https:\/\//.test(art)) return
  try {
    const res = await fetch(art, { signal: AbortSignal.timeout(15_000) })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/')) return
    return { blob: new Blob([await res.arrayBuffer()], { type }), name: `cover.${type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}` }
  } catch {}
}

const tagIds = async (forum: Forum, tags: readonly string[] = []) => {
  const known = (await getIds()).forums[forum].tags
  return tags.map((t) => known[t]).filter(Boolean)
}

/** Opens the thread with `card` as its first post, the full card with the cover attached. Returns the post's id. */
async function openThread(ref: ThreadRef, card: Embed, ping: boolean, extra?: Extra) {
  const forum = (await getIds()).forums[ref.forum].id
  const image = await cover(ref.art ?? card.thumbnail?.url)
  const first = message(image ? { ...card, thumbnail: undefined } : card, ping, extra?.components)
  const body = { name: ref.name.slice(0, 100), auto_archive_duration: WEEK, applied_tags: await tagIds(ref.forum, ref.tags), message: first }
  const payload = withFiles(body, [...(image ? [image] : []), ...textFile(extra)], (attachments) => ({ ...body, message: { ...first, attachments } }))
  const thread = await discord<{ id: string }>(`/channels/${forum}/threads`, 'POST', payload)
  saveThread({ key: ref.key, forum: ref.forum, id: thread.id, tags: [...(ref.tags ?? [])] })
  return thread.id // a forum thread's first post has the thread's id
}

/** Posts a compact card in a thread that's open already, bringing it back if it was archived. */
async function threadPost(ref: ThreadRef, id: string, tags: string, card: Embed, ping: boolean, extra?: Extra) {
  if (ref.tags && JSON.stringify(ref.tags) !== tags) {
    await discord(`/channels/${id}`, 'PATCH', { archived: false, applied_tags: await tagIds(ref.forum, ref.tags) })
    saveThread({ key: ref.key, forum: ref.forum, id, tags: [...ref.tags] })
  }
  const body = message(compact(card), ping, extra?.components)
  const send = async () => (await discord<{ id: string }>(`/channels/${id}/messages`, 'POST', withFiles(body, textFile(extra), (attachments) => ({ ...body, attachments })))).id
  try {
    return await send()
  } catch (e) {
    if (!(e instanceof DiscordError && e.code === ARCHIVED)) throw e
    await discord(`/channels/${id}`, 'PATCH', { archived: false })
    return send()
  }
}

/**
 * Posts to a channel or a thread and returns the message id. A thread's first post opens it; a channel or thread
 * deleted by hand is made again.
 */
export function post(target: Target, embed: Embed, ping = false, extra?: Extra) {
  return serial(async () => {
    if (typeof target === 'string') {
      const body = message(embed, ping, extra?.components)
      const send = async () =>
        (await discord<{ id: string }>(`/channels/${await channelId(target)}/messages`, 'POST', withFiles(body, textFile(extra), (attachments) => ({ ...body, attachments })))).id
      try {
        return await send()
      } catch (e) {
        if (!gone(e)) throw e
        ids = undefined
        return send()
      }
    }
    const row = getThread(target.key)
    if (!row) return openThread(target, embed, ping, extra)
    try {
      return await threadPost(target, row.id, row.tags, embed, ping, extra)
    } catch (e) {
      if (!gone(e)) throw e
      forgetThread(target.key)
      return openThread(target, embed, ping, extra)
    }
  })
}

/** Where a channel's or thread's messages are; undefined for a thread that was never opened. */
async function messagesOf(target: Target) {
  if (typeof target === 'string') return `/channels/${await channelId(target)}`
  const row = getThread(target.key)
  return row && `/channels/${row.id}`
}

/** Rewrites a message the bot posted in a channel or thread. False if it's gone (deleted by hand). */
export function edit(target: Target, id: string, embed: Embed) {
  return serial(async () => {
    const at = await messagesOf(target)
    if (!at) return false
    try {
      // A message from before the cards (1.1.0-rc.10) had text and hid link previews, which hides cards too: clear both.
      await discord(`${at}/messages/${id}`, 'PATCH', { content: '', embeds: [embed], flags: 0 })
      return true
    } catch (e) {
      if (gone(e)) return false
      if (e instanceof DiscordError && e.code === ARCHIVED) {
        await discord(at, 'PATCH', { archived: false })
        await discord(`${at}/messages/${id}`, 'PATCH', { content: '', embeds: [embed], flags: 0 })
        return true
      }
      throw e
    }
  })
}

/** Deletes a message the bot posted in a channel or thread. Already gone is fine. */
export function remove(target: Target, id: string) {
  return serial(async () => {
    const at = await messagesOf(target)
    if (!at) return
    try {
      await discord(`${at}/messages/${id}`, 'DELETE')
    } catch (e) {
      if (!gone(e)) throw e
    }
  })
}

let me: Promise<string> | undefined
/** The bot's own user id. */
export const botUserId = () =>
  (me ??= discord<{ id: string }>('/users/@me').then(
    (u) => u.id,
    (e) => {
      me = undefined
      throw e
    },
  ))

/**
 * A thread's messages after `after` (oldest first, up to 100), or its latest 50 without it. Undefined for a thread that
 * was never opened or was deleted by hand. Reading isn't queued behind posts: it changes nothing.
 */
export async function threadMessages(key: string, after?: string) {
  const row = getThread(key)
  if (!row) return
  try {
    const list = await discord<Message[]>(`/channels/${row.id}/messages?${after ? `after=${after}&limit=100` : 'limit=50'}`)
    return list.sort(byId)
  } catch (e) {
    if (!gone(e)) throw e
  }
}

/** Shows "Arrmy is typing…" in a thread for about 10 seconds. */
export async function typing(key: string) {
  const row = getThread(key)
  if (row) await discord(`/channels/${row.id}/typing`, 'POST').catch(() => {})
}

/** The bot's own recent messages in a channel (the last 100), newest first. */
export function ownMessages(channel: Channel) {
  return serial(async () => {
    const me = await discord<{ id: string }>('/users/@me')
    const list = await discord<{ id: string; author: { id: string }; embeds: Embed[] }[]>(`/channels/${await channelId(channel)}/messages?limit=100`)
    return list.filter((m) => m.author.id === me.id)
  })
}

/**
 * Changes a thread (by its key) without posting: new tags, and archived or not. Nothing happens for a thread that was
 * never opened or was deleted by hand.
 */
export function updateThread(key: string, change: { tags?: readonly string[]; archived?: boolean }) {
  return serial(async () => {
    const row = getThread(key)
    if (!row) return
    try {
      await discord(`/channels/${row.id}`, 'PATCH', {
        ...(change.tags && { applied_tags: await tagIds(row.forum as Forum, change.tags) }),
        ...(change.archived !== undefined && { archived: change.archived }),
      })
      if (change.tags) saveThread({ ...row, tags: [...change.tags] })
    } catch (e) {
      if (!gone(e)) throw e
      forgetThread(key)
    }
  })
}

/** Where a thread opens in Discord, if it has been opened. */
export const threadLink = (key: string) => {
  const row = botEnabled() ? getThread(key) : undefined
  return row && threadUrl(guild()!, row.id)
}

const where = (target: Target) => (typeof target === 'string' ? `#${target}` : target.key)

/** Posts in the background: never slows down or fails whatever Arrmy was doing. */
export function announce(target: Target, embed: Embed, ping = false) {
  const warn = (e: Error) => console.warn(`[discord] ${where(target)}: ${e.message}`)
  if (botEnabled()) return void post(target, embed, ping).catch(warn)
  const webhook = process.env.DISCORD_WEBHOOK_URL
  if (webhook && typeof target !== 'string' && (target.forum === 'requests' || target.forum === 'problems'))
    serial(() => discord(webhook, 'POST', message(embed, ping), false)).catch(warn)
}

/** Changes a thread in the background, like announce. */
export function retag(key: string, change: { tags?: readonly string[]; archived?: boolean }) {
  if (botEnabled()) updateThread(key, change).catch((e: Error) => console.warn(`[discord] ${key}: ${e.message}`))
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

/** Replaces the "thinking…" placeholder of a slash command with its answer, or a clicked card with what came of it (no buttons). */
export const answerInteraction = (applicationId: string, interactionToken: string, embeds: Embed[], components?: object[]) =>
  discord(`/webhooks/${applicationId}/${interactionToken}/messages/@original`, 'PATCH', message(embeds, false, components), false)

/** Takes the buttons off a message the bot posted in a thread, rewriting its card. False if it's gone. */
export function closeButtons(key: string, id: string, embed: Embed) {
  return serial(async () => {
    const row = getThread(key)
    if (!row) return false
    try {
      await discord(`/channels/${row.id}/messages/${id}`, 'PATCH', { embeds: [embed], components: [] })
      return true
    } catch (e) {
      if (gone(e)) return false
      throw e
    }
  })
}
