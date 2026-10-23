// The Activity forum's rules: which play earns a card, when a comeback edits the old card instead, and what a card says.
// No I/O here, so they can be unit-tested (test/activity.test.ts); activity.ts looks at Plex and Audiobookshelf and posts.
// .ts so plain node (the tests) can load this file too
import { duration, threadName, TYPE_TAGS, type ThreadRef } from './botrules.ts'
import { embed, type Embed } from './embeds.ts'

/** Seconds played before a play gets a card. */
export const CARD_AFTER = 60
/** The same person back at the same episode or book this soon continues its card. */
export const RESUME_WITHIN = 30 * 60_000
// A gap longer than this between two looks (a restart, a slow check) isn't counted as watched.
const MAX_GAP = 2 * 60_000

/** One playback session as a look at Plex or Audiobookshelf sees it. */
export type Session = {
  /** The app's session; Plex's changes with the episode. */
  id: string
  /** The Activity thread: the movie, show or book. */
  thread: string
  /** The thread's title and tag. */
  title: string
  type: keyof typeof TYPE_TAGS
  /** The movie, episode or book a comeback has to match. */
  item: string
  user: string
  device: string
  /** "S1E3 · Pilot", or the chapter. */
  detail?: string
  playing: boolean
  /** Seconds listened, when the app counts them itself (Audiobookshelf). */
  listened?: number
}

/** One play: a session, or several when the person came back within RESUME_WITHIN. Times are ms. */
export type Play = Omit<Session, 'id' | 'playing' | 'listened'> & {
  session: string
  /** Where the play began, when it moved on since (chapters). */
  from?: string
  started: number
  seen: number
  ended?: number
  /** Seconds, and those from earlier sessions of the same play. */
  watched: number
  base: number
  /** Its card, once posted. */
  message?: string
  url?: string
  /** Already playing when Arrmy first looked: never gets a card. */
  quiet?: true
}

export type Activity = { live: Record<string, Play>; ended: Play[] }

/**
 * Compares a look with the last one (`before`, undefined the first time: then it only records). Returns what to keep,
 * the plays that need a card posted, and those whose card changed (a comeback, or stopped).
 */
export function look(before: Activity | undefined, sessions: Session[], now: number) {
  const state: Activity = { live: {}, ended: (before?.ended ?? []).filter((p) => now - p.ended! < RESUME_WITHIN + MAX_GAP) }
  const post: Play[] = []
  const edit: Play[] = []
  for (const s of sessions) {
    const was = before?.live[s.id]
    const p: Play = was ?? { session: s.id, thread: s.thread, title: s.title, type: s.type, item: s.item, user: s.user, device: s.device, from: s.detail, started: now, seen: now, watched: 0, base: 0, ...(!before && { quiet: true as const }) }
    if (s.listened !== undefined) p.watched = p.base + s.listened
    else if (was && s.playing && now - was.seen <= MAX_GAP) p.watched += (now - was.seen) / 1000
    Object.assign(p, { device: s.device, detail: s.detail, seen: now })
    state.live[s.id] = p
    if (p.quiet || p.message || p.watched < CARD_AFTER) continue
    const i = state.ended.findIndex((e) => e.user === p.user && e.item === p.item && p.started - e.ended! <= RESUME_WITHIN)
    if (i < 0) {
      post.push(p)
      continue
    }
    const [old] = state.ended.splice(i, 1)
    Object.assign(p, { started: old.started, from: old.from, base: old.watched + p.base, watched: old.watched + p.watched, message: old.message, url: old.url })
    edit.push(p)
  }
  for (const p of Object.values(before?.live ?? {})) {
    if (state.live[p.session] || !p.message) continue // still playing, or never earned a card
    p.ended = p.seen
    state.ended.push(p)
    edit.push(p)
  }
  return { state, post, edit }
}

/** A play's Activity thread: one per movie, show or book, opened by its first play. */
export const activityThread = (p: Pick<Play, 'thread' | 'title' | 'type'>, art?: string | null): ThreadRef => ({
  forum: 'activity',
  key: p.thread,
  name: threadName(p.title),
  tags: [TYPE_TAGS[p.type]],
  art,
})

/** The Activity thread of a Plex movie or show, by its rating key (a show's is an episode's grandparentRatingKey). */
export const plexThreadKey = (ratingKey: string | number) => `play:plex:${ratingKey}`

/** A time Discord shows in each reader's own time zone. */
const at = (ms: number) => `<t:${Math.round(ms / 1000)}:t>`

/** A play's card: who, which episode or chapter, which device, when it started, and once it stopped, for how long. */
export function playCard(p: Play, app: { name: string; url?: string }, art?: string | null): Embed {
  const book = p.type === 'audiobook'
  const verb = book ? 'listen' : 'watch'
  return embed({
    colour: 'info',
    app: app.name,
    appUrl: app.url,
    title: p.title,
    url: p.url,
    art,
    description: p.ended ? `**${p.user}** ${verb}ed for ${duration(p.watched)}.` : `**${p.user}** is ${verb}ing.`,
    fields: [
      [book ? 'Chapter' : 'Episode', p.from && p.detail && p.from !== p.detail ? `${p.from} → ${p.detail}` : p.detail],
      ['Device', p.device],
      ['Started', at(p.started)],
      ['Ended', p.ended ? at(p.ended) : undefined],
    ],
    at: new Date(p.started),
  })
}

/** Plex's /status/sessions, as much as the cards need. */
export type PlexSession = {
  sessionKey: string
  ratingKey: string
  grandparentRatingKey?: string
  type: string
  title: string
  year?: number
  grandparentTitle?: string
  parentIndex?: number
  index?: number
  User?: { id?: string; title?: string }
  Player?: { title?: string; product?: string; state?: string }
}

/** A Plex session as Activity sees it; music, trailers and the like have no thread. */
export function plexSession(s: PlexSession): Session | undefined {
  const episode = s.type === 'episode'
  if (!episode && s.type !== 'movie') return
  return {
    id: `${s.sessionKey}:${s.ratingKey}`, // autoplay keeps the session for the next episode, which is a new play
    thread: plexThreadKey(episode ? (s.grandparentRatingKey ?? s.ratingKey) : s.ratingKey),
    title: episode ? (s.grandparentTitle ?? s.title) : `${s.title}${s.year ? ` (${s.year})` : ''}`,
    type: episode ? 'tv' : 'movie',
    item: s.ratingKey,
    user: s.User?.title ?? 'Someone',
    device: s.Player?.title ?? s.Player?.product ?? 'a device',
    detail: episode ? `S${s.parentIndex}E${s.index} · ${s.title}` : undefined,
    playing: s.Player?.state === 'playing',
  }
}

/** Audiobookshelf's open sessions (/users/online), as much as the cards need. */
export type AbsSession = {
  id: string
  userId: string
  libraryItemId: string
  mediaType?: string
  displayTitle: string
  displayAuthor?: string
  timeListening?: number
  currentTime?: number
  chapters?: { start: number; end: number; title: string }[]
  deviceInfo?: { deviceName?: string; clientName?: string; browserName?: string; model?: string }
}

/** An Audiobookshelf session as Activity sees it; podcasts have no thread. */
export function absSession(s: AbsSession, users: { id: string; username: string }[]): Session | undefined {
  if (s.mediaType && s.mediaType !== 'book') return
  const d = s.deviceInfo
  const time = s.currentTime ?? 0
  return {
    id: s.id,
    thread: `play:abs:${s.libraryItemId}`,
    title: s.displayTitle,
    type: 'audiobook',
    item: s.libraryItemId,
    user: users.find((u) => u.id === s.userId)?.username ?? 'Someone',
    device: d?.deviceName ?? d?.model ?? d?.clientName ?? d?.browserName ?? 'a device',
    detail: s.chapters?.find((c) => time >= c.start && time < c.end)?.title,
    playing: true,
    listened: s.timeListening ?? 0,
  }
}
