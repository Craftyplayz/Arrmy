// Rules for talking to The Doctarr in a Problem's thread: the numbered list of every release found, which of the
// Admin's messages count as a reply, and the buttons that confirm a fix that can't be undone. No I/O here, so they can
// be unit-tested.
// .ts so plain node (the tests) can load this file too
import type { Release } from './bookrules.ts'
import { size } from './botrules.ts'

/**
 * How a numbered release is downloaded: through Radarr or Sonarr, Arrmy's own Edition download, Arrmy's own download of
 * a book LazyLibrarian was looking for (`book`, filed into Audiobookshelf by Arrmy), or not at all.
 */
export type Grab =
  | { app: 'radarr' | 'sonarr'; guid: string; indexerId: number }
  | { app: 'edition'; id: string; release: Release; pack: boolean }
  | { app: 'book'; id: string; release: Release }
  | { app: 'none'; why: string }

/** One release a search found, whatever searched. `rejections` empty = acceptable. */
export type Found = {
  title: string
  size: number
  seeders?: number
  /** The indexer, or AudioBook Bay. */
  source: string
  quality?: string
  rejections: string[]
  /** Tried already, and it never started. */
  dead?: boolean
  /** Sonarr: the whole season in one release. */
  fullSeason?: boolean
  grab: Grab
}
export type Listed = Found & { n: number }
/** A Problem's latest list: what was searched for, when, and every release found. */
export type ReleaseList = { at: number; title: string; entries: Listed[] }

/** Numbers every release, the likeliest first: acceptable and not dead, then the most seeders (unknown last). */
export function numbered(found: Found[]): Listed[] {
  const rank = (f: Found) => (f.dead ? 2 : f.rejections.length ? 1 : 0)
  return [...found]
    .sort((a, b) => rank(a) - rank(b) || (b.seeders ?? -1) - (a.seeders ?? -1))
    .map((f, i) => ({ ...f, n: i + 1 }))
}

/**
 * The release to grab in another quality when nothing wanted can be had: none acceptable and alive, so the most seeded
 * one turned down only for its quality ("WEBRip-720p is not wanted in profile"). For a show only a whole season, so it
 * can't be the wrong episode. `list` is in numbered() order.
 */
export function otherQuality(list: Listed[]) {
  if (list.some((r) => !r.rejections.length && !r.dead)) return undefined
  return list.find(
    (r) =>
      !r.dead &&
      (r.seeders ?? 0) > 0 &&
      r.rejections.length > 0 &&
      r.rejections.every((x) => / is not wanted in profile$/.test(x)) &&
      (r.grab.app === 'radarr' || (r.grab.app === 'sonarr' && r.fullSeason)),
  )
}

/** Release names are full of _ and *, which Discord would read as italics and bold. */
export const escape = (s: string) => s.replace(/([\\*_~`|>[\]])/g, '\\$1')

const facts = (r: Listed) =>
  [
    r.size > 0 ? size(r.size) : 'size unknown',
    r.seeders !== undefined ? `${r.seeders} seeder${r.seeders === 1 ? '' : 's'}` : undefined,
    r.source,
    r.quality,
  ].filter(Boolean)

const why = (r: Listed) => (r.dead ? 'tried already, never started' : r.rejections.length ? `turned down: ${[...new Set(r.rejections)].join('; ')}` : undefined)

/** One release as a line of a card: "**36.** Dune.Part.Two.2024.1080p · 4.2 GB · 120 seeders · YTS · turned down: …" */
export function releaseLine(r: Listed) {
  const reason = why(r)
  return `**${r.n}.** ${escape(r.title.slice(0, 180))} · ${facts(r).join(' · ')}${reason ? ` · *${escape(reason.slice(0, 200))}*` : ''}`
}

/**
 * The list as card texts: as many lines as fit in each (Discord allows 4,096 characters a card), and only the first
 * `max` releases; the attached file always has every one.
 */
export function listCards(list: Listed[], max = 200, budget = 3900) {
  const cards: string[] = []
  let card = ''
  for (const r of list.slice(0, max)) {
    const line = releaseLine(r)
    if (card && card.length + 1 + line.length > budget) {
      cards.push(card)
      card = ''
    }
    card += (card ? '\n' : '') + line
  }
  if (card) cards.push(card)
  return cards
}

/** The whole list as plain text, attached to the list's first card. */
export function listFile(list: ReleaseList) {
  const lines = [`Every release found for ${list.title}, ${new Date(list.at).toISOString().slice(0, 16).replace('T', ' ')} UTC`, '']
  for (const r of list.entries) lines.push(`${r.n}. ${r.title} · ${facts(r).join(' · ')}${why(r) ? ` · ${why(r)}` : ''}`)
  if (!list.entries.length) lines.push('Nothing found.')
  return `${lines.join('\n')}\n`
}

/** The list's first card: how many, and how to pick one. */
export function listIntro(list: ReleaseList, shown: number) {
  const n = list.entries.length
  if (!n) return `The search found no releases for ${list.title}.`
  const ok = list.entries.filter((r) => !r.rejections.length && !r.dead).length
  const rest = n > shown ? ` The first ${shown} are below; the attached file has all ${n}.` : ' They are below and in the attached file.'
  return `${n} release${n === 1 ? '' : 's'} found for ${list.title}, ${ok} acceptable.${rest} Reply with a number to download one ("download number 3"), or with anything else you want done.`
}

/** A message in a thread, as Discord's API gives it. */
export type Message = {
  id: string
  author: { id: string; bot?: boolean }
  content: string
  timestamp: string
  attachments?: { filename: string }[]
  embeds?: { title?: string; description?: string }[]
}

/** Discord's ids grow with time, so they sort as numbers (they're too big for a double). */
export const byId = (a: { id: string }, b: { id: string }) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0)

/**
 * What's new in a thread since `seen`: the Admin's messages (the reply) and the bot's (what happened meanwhile).
 * `ready` once the Admin has stopped typing for `quietMs`, so several messages in a row go as one reply. Everyone
 * else's messages are skipped.
 */
export function newMessages(messages: Message[], adminId: string, botId: string, now: number, quietMs = 20_000) {
  const sorted = [...messages].sort(byId)
  const admin = sorted.filter((m) => m.author.id === adminId)
  const bot = sorted.filter((m) => m.author.id === botId)
  const last = admin.at(-1)
  return { admin, bot, latest: sorted.at(-1)?.id, ready: !!last && now - Date.parse(last.timestamp) >= quietMs }
}

/** The Admin's messages as one reply, without @mentions of the bot. Attachments are named: The Doctarr can't open them. */
export const replyText = (admin: Message[], botId = '') =>
  admin
    .map((m) => [m.content.replaceAll(`<@${botId}>`, '').replaceAll(`<@!${botId}>`, '').trim(), ...(m.attachments ?? []).map((a) => `(attached ${a.filename}, which you can't open)`)].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n')

/**
 * True when Discord hides what the Admin wrote: the Message Content Intent is off. A message with no text, no
 * attachments and no embeds can't be sent, so empty means hidden.
 */
export const contentHidden = (admin: Message[]) => admin.length > 0 && admin.every((m) => !m.content && !m.attachments?.length && !m.embeds?.length)

/** The bot's cards since The Doctarr last looked, as lines of what happened meanwhile. */
export const meanwhile = (bot: Message[]) =>
  bot.flatMap((m) => (m.embeds ?? []).map((e) => [e.title, e.description].filter(Boolean).join(': ')).filter(Boolean)).map((t) => t.slice(0, 600))

/** How long after a follow-up said it was solved the Admin can still reply ("no, it's still stuck"). */
export const OPEN_FOR = 60 * 60_000

/** Whether the Admin's reply in a Problem thread goes to The Doctarr: Needs you, or Open for an hour after a reply run. */
export const replyable = (tags: string[], openUntil: number | undefined, now: number) =>
  tags.includes('Needs you') || (tags.includes('Open') && (openUntil ?? 0) > now)

/** Fixes that wait for the Admin's click, since they can't be undone. */
export const CONFIRM = ['remove-request', 'delete-torrent'] as const
export type ConfirmAction = (typeof CONFIRM)[number]

/** A button's id: what it does and which pending fix it's for. */
export const buttonId = (choice: 'go' | 'cancel', id: string) => `doctor:${choice}:${id}`
export function parseButton(customId: string) {
  const m = /^doctor:(go|cancel):([\w-]{1,40})$/.exec(customId)
  return m ? { choice: m[1] as 'go' | 'cancel', id: m[2] } : undefined
}

/** How long a button waits for the click. */
export const CONFIRM_FOR = 24 * 3_600_000

/** Go ahead and Cancel, as a Discord action row (style 4 is red, 2 grey). */
export const confirmButtons = (id: string) => [
  {
    type: 1,
    components: [
      { type: 2, style: 4, label: 'Go ahead', custom_id: buttonId('go', id) },
      { type: 2, style: 2, label: 'Cancel', custom_id: buttonId('cancel', id) },
    ],
  },
]

/** "later 90" and the like: whole minutes from 5 minutes to a week. */
export function laterMinutes(value: unknown) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 5 || n > 7 * 24 * 60) throw new Error('minutes must be a whole number from 5 to 10080 (a week)')
  return n
}
