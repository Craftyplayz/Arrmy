// Fixes the doctor can only ask for: removing a Request and deleting a torrent can't be undone, so the doctor posts
// what it would do with Go ahead and Cancel buttons, and only the Admin's click runs it (Discord sends the click to
// /api/discord). The buttons' rules are in replyrules.ts.
import { randomUUID } from 'node:crypto'
import { arr } from './arr'
import { problemThread } from './botrules'
import { adminUser, getSetting, requestsFor, seasonsOf, setSetting, type RequestRow } from './db'
import { closeButtons, post } from './discord'
import { remember, threadStates } from './doctor'
import { embed, type Embed } from './embeds'
import type { Problem } from './problems'
import { deleteTorrents, torrents } from './qbit'
import { CONFIRM_FOR, confirmButtons, type ConfirmAction } from './replyrules'
import { removeRequestAs, removeSeasonAs } from './requests'

type Pending = { thread: string; action: ConfirmAction; arg?: string; text: string; at: number; message?: string }
const PENDING = 'doctor:pending'
const pending = () => getSetting<Record<string, Pending>>(PENDING) ?? {}
const save = (all: Record<string, Pending>) => setSetting(PENDING, all)

/** The Requests a Problem is about: the movie's, the show's that ask for this season, or the audiobook's. */
async function requestsOf(p: Problem): Promise<{ requests: RequestRow[]; season?: number }> {
  if (p.media && 'movieId' in p.media) {
    const movie = await arr<{ tmdbId: number }>('radarr', `/movie/${p.media.movieId}`)
    return { requests: requestsFor('movie', movie.tmdbId) }
  }
  if (p.media) {
    const { season } = p.media
    const series = await arr<{ tvdbId: number }>('sonarr', `/series/${p.media.seriesId}`)
    return { requests: requestsFor('tv', series.tvdbId).filter((r) => seasonsOf(r).includes(season)), season }
  }
  if (p.book) return { requests: requestsFor('audiobook', p.book) }
  return { requests: [] }
}

const who = (requests: RequestRow[]) => [...new Set(requests.map((r) => r.username))].join(', ')

/** Checks what the doctor asked for and how to say it, before any button is shown. */
async function describe(p: Problem, action: ConfirmAction, arg?: string) {
  if (action === 'remove-request') {
    const { requests, season } = await requestsOf(p)
    if (!requests.length) throw new Error(`No Request is waiting for ${p.title}`)
    return season === undefined
      ? `Remove the Request for ${requests[0].title} (asked by ${who(requests)}) and delete its download and files, unless another Request wants them?`
      : `Take Season ${season} out of the Request for ${requests[0].title} (asked by ${who(requests)}) and delete its downloads and files?`
  }
  const hash = (arg ?? '').toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(hash)) throw new Error('hash must be a 40-character torrent hash')
  const t = (await torrents()).find((x) => x.hash.toLowerCase() === hash)
  if (!t) throw new Error('qBittorrent has no torrent with that hash')
  return `Delete the torrent ${t.name} from qBittorrent, with its files?`
}

/** The doctor's ask: posts the question with the two buttons in the Problem's thread. Returns what to tell the doctor. */
export async function askToConfirm(problemKey: string, action: ConfirmAction, arg?: string) {
  const thread = `problem:${problemKey}`
  const state = threadStates()[thread]
  if (!state) throw new Error('No thread for this Problem')
  const text = await describe(state.problem, action, arg)
  const id = randomUUID().replace(/-/g, '').slice(0, 16)
  const message = await post(problemThread(state.problem), embed({ colour: 'accent', app: 'Claude', title: 'Go ahead?', description: text, at: false }), false, {
    components: confirmButtons(id),
  })
  remember(thread, message)
  // Old asks nobody answered go when a new one comes.
  const all = Object.fromEntries(Object.entries(pending()).filter(([, x]) => Date.now() - x.at < CONFIRM_FOR))
  save({ ...all, [id]: { thread, action, arg, text, at: Date.now(), message } })
  return `Asked the Admin: "${text}" It runs only if they click Go ahead in Discord, so say so in your answer and don't wait for it.`
}

async function act(p: Pending) {
  const state = threadStates()[p.thread]
  if (!state) throw new Error('This Problem has no thread any more')
  const admin = adminUser() ?? { id: 0, username: 'The Admin' }
  if (p.action === 'delete-torrent') {
    await deleteTorrents([p.arg!])
    return 'The torrent and its files are deleted.'
  }
  const { requests, season } = await requestsOf(state.problem)
  if (!requests.length) return 'Nothing to remove: no Request is waiting for it any more.'
  const notes: string[] = []
  for (const r of requests) {
    const note = season === undefined ? await removeRequestAs(admin, r) : await removeSeasonAs(admin, r, season)
    if (note) notes.push(note)
  }
  return [season === undefined ? 'The Request is removed.' : `Season ${season} is taken out of the Request.`, ...notes].join(' ')
}

/**
 * The Admin clicked Go ahead or Cancel: runs it or drops it, and returns the card the message becomes (without the
 * buttons). Anyone else's click is refused before this (/api/discord).
 */
export async function clicked(id: string, choice: 'go' | 'cancel'): Promise<Embed> {
  const all = pending()
  const p = all[id]
  const done = (colour: 'ok' | 'danger' | 'neutral', title: string, description: string) => embed({ colour, app: 'Claude', title, description: description.slice(0, 4000), at: false })
  if (!p || Date.now() - p.at > CONFIRM_FOR) return done('neutral', 'Expired', `${p?.text ?? 'This'} was asked over a day ago, so nothing was done. Reply in the thread to ask again.`)
  delete all[id]
  save(all)
  if (choice === 'cancel') return done('neutral', 'Cancelled', `${p.text} Nothing was done.`)
  try {
    return done('ok', 'Done', `${p.text}\n\n${await act(p)}`)
  } catch (e) {
    return done('danger', "Couldn't do it", `${p.text}\n\n${(e as Error).message}`)
  }
}

/** A reply instead of a click cancels what's waiting in that thread: the reply says what to do now. */
export async function cancelPending(thread: string) {
  const all = pending()
  const mine = Object.entries(all).filter(([, p]) => p.thread === thread)
  if (!mine.length) return
  for (const [id, p] of mine) {
    delete all[id]
    if (p.message)
      await closeButtons(thread, p.message, embed({ colour: 'neutral', app: 'Claude', title: 'Cancelled', description: `${p.text} Cancelled by your reply.`, at: false })).catch(() => {})
  }
  save(all)
}
