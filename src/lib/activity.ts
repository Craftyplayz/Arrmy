// The Activity forum and #weekly-summary: who plays what in Plex and Audiobookshelf. Plex needs the Admin's Plex token,
// saved when they sign in. What each look saw is kept in the settings table, so a restart doesn't post again.
import { absSession, activityThread, look, plexSession, plexThreadKey, playCard, type AbsSession, type Activity, type PlexSession, type Play, type Session } from './activityrules'
import { abs } from './books'
import { getSetting, getThread, setSetting } from './db'
import { announce, edit, post, publicUrl, threadLink } from './discord'
import { compact, embed, ICONS } from './embeds'
import { absKey } from './keys'
import { bookArt, plexArt } from './media'
import { plex, PLEX_URL } from './plex'
import { history } from './tautulli'
import { summaryDue, weekSummary } from './watchrules'

const APPS = {
  plex: { name: 'Plex', url: publicUrl('plex', '/web') },
  abs: { name: 'Audiobookshelf', url: publicUrl('books') },
}

/** Posts and edits the cards for one app's look; `art` finds the cover and page of a play about to get its card. */
async function report(app: keyof typeof APPS, sessions: Session[], art: (p: Play) => Promise<{ art?: string | null; url?: string }>) {
  const { state, post: due, edit: changed } = look(getSetting<Activity>(`bot:activity:${app}`), sessions, Date.now())
  for (const p of due) {
    const found = await art(p).catch(() => ({ art: undefined, url: undefined }))
    p.url = found.url
    // Not posted: the next look tries again, and the others still get theirs.
    p.message = await post(activityThread(p, found.art), playCard(p, APPS[app], found.art)).catch((e: Error) => void console.warn(`[bot] ${p.thread}: ${e.message}`))
  }
  for (const p of changed) {
    // The thread's first post is the full card (its cover attached); later ones are compact.
    const card = playCard(p, APPS[app])
    if (p.message) await edit(activityThread(p), p.message, getThread(p.thread)?.id === p.message ? card : compact(card)).catch((e: Error) => console.warn(`[bot] ${p.thread}: ${e.message}`))
  }
  setSetting(`bot:activity:${app}`, state)
}

export async function plexActivity() {
  const token = getSetting<string>('plexToken')
  if (!token) return
  const list = (await plex<{ MediaContainer: { Metadata?: PlexSession[] } }>(`${PLEX_URL}/status/sessions`, token)).MediaContainer.Metadata ?? []
  const pairs = list.flatMap((s) => {
    const session = plexSession(s)
    return session ? [[session, s] as const] : []
  })
  const raw = new Map(pairs.map(([session, s]) => [session.id, s]))
  await report('plex', pairs.map(([session]) => session), (p) => plexArt(raw.get(p.session)!))
}

export async function audiobookshelfActivity() {
  if (!absKey()) return
  const { openSessions } = await abs<{ openSessions: AbsSession[] }>('/users/online')
  const users = openSessions.length ? (await abs<{ users: { id: string; username: string }[] }>('/users')).users : []
  const sessions = openSessions.map((s) => absSession(s, users)).filter((s): s is Session => !!s)
  const authors = new Map(openSessions.map((s) => [s.id, s.displayAuthor]))
  await report('abs', sessions, async (p) => ({ art: (await bookArt(p.title, authors.get(p.session))).art, url: publicUrl('books', `/item/${p.item}`) }))
}

// #weekly-summary: once a week, Sunday from 18:00 in the server's time zone (TZ), who watched what in Plex in the last
// 7 days, each title linking to its Activity thread.
export async function weeklySummary() {
  const week = summaryDue(new Date(), getSetting<string>('bot:watchedWeek'))
  if (!week) return
  const thread = (p: { media_type: string; rating_key: number; grandparent_rating_key: number | null }) =>
    threadLink(plexThreadKey(p.media_type === 'episode' ? (p.grandparent_rating_key ?? p.rating_key) : p.rating_key))
  const lines = weekSummary(await history(), Date.now() - 7 * 24 * 60 * 60 * 1000, thread)
  setSetting('bot:watchedWeek', week)
  announce('weekly-summary', embed({ colour: 'info', app: 'Tautulli', art: ICONS.Tautulli, title: 'Watched this week', description: lines.join('\n') || 'Nothing was played in Plex this week.' }))
}
