// Hands each Problem #problems announces to The Doctarr (scripts/doctor.mjs), which has Claude look into it and maybe fix
// it, and posts its answer in the Problem's thread, one page per part (Cause, What I did…). Its first look also posts every
// release found, numbered (releaselist.ts). The Admin's replies in the thread go back to The Doctarr (replies.ts). On
// only when CLAUDE_CODE_OAUTH_TOKEN is set (docker-compose.yml sets DOCTOR).
import { request } from 'node:http'
import { problemKey, problemThread } from './botrules'
import { announce, botEnabled, post } from './discord'
import { getSetting, setSetting } from './db'
import { embed } from './embeds'
import type { Problem } from './problems'
import { grabOtherQuality, postReleaseList } from './releaselist'
import { postPages } from './pages'
import { answerPages, OPEN_FOR } from './replyrules'
import { doctorToken, sessionSecret } from './token'

const DOCTOR_URL = process.env.DOCTOR_URL ?? 'http://doctor:3002'

/** One line of The Doctarr's answer: a step, or the last line with the answer or the error. */
type Event = { step?: 'Checked' | 'Fixed'; text?: string; failed?: boolean; answer?: string; solved?: boolean; error?: string }

/**
 * What Arrmy keeps per Problem thread The Doctarr has posted in: the Problem, the last message it has read (`seen`),
 * the ids of its own posts (so they aren't handed back to it as news), until when an Open thread still takes replies,
 * and a look the Admin asked for later.
 */
export type ThreadState = { problem: Problem; seen?: string; mine?: string[]; openUntil?: number; hiddenTold?: boolean; later?: { at: number; note?: string } }
const STATES = 'doctor:threads'
export const threadStates = () => getSetting<Record<string, ThreadState>>(STATES) ?? {}
export function updateState(key: string, change: (s: ThreadState | undefined) => ThreadState | undefined) {
  const all = threadStates()
  const next = change(all[key])
  if (next) all[key] = next
  else delete all[key]
  setSetting(STATES, all)
}
/** Keeps a Problem The Doctarr has looked into up to date for its replies, writing only when it changed. */
export function keepProblem(key: string, p: Problem) {
  const s = threadStates()[key]
  if (JSON.stringify(s?.problem) !== JSON.stringify(p)) updateState(key, (x) => ({ ...x, problem: p }))
}

/** Notes a post as the bot's own work on this Problem, so it isn't handed back to The Doctarr as news. */
export const remember = (key: string, id: string) => updateState(key, (s) => s && { ...s, mine: [...(s.mine ?? []), id].slice(-300) })

/** Threads The Doctarr is working in now, and those where it's answering the Admin. In memory: a restart ends any run anyway. */
export const busy = new Set<string>()
/** Only a run answering the Admin may grab, look later or ask to remove (doctorapi.ts checks). */
export const replying = new Set<string>()

// node:http, not fetch: fetch gives up after 5 minutes without an answer, and an investigation can take 20. A 200 means
// the run has started; its body is one JSON line per step, then the answer (doctor.mjs serve).
function ask(path: '/investigate' | '/reply', body: string, started: () => void, onEvent: (e: Event) => void) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = request(
      `${DOCTOR_URL}${path}`,
      { method: 'POST', headers: { Authorization: `Bearer ${doctorToken(sessionSecret())}`, 'Content-Type': 'application/json' }, timeout: 30 * 60_000 },
      (res) => {
        const status = res.statusCode ?? 0
        if (status === 200) started()
        let text = ''
        res.setEncoding('utf8')
        res
          .on('data', (c: string) => {
            text += c
            if (status !== 200) return
            const lines = text.split('\n')
            text = lines.pop()!
            try {
              for (const l of lines) if (l.trim()) onEvent(JSON.parse(l))
            } catch (e) {
              req.destroy(e as Error)
            }
          })
          .on('end', () => resolve({ status, text }))
          .on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('no answer in 30 minutes'))).on('error', reject)
    req.end(body)
  })
}

const card = (description: string, colour: 'info' | 'ok' | 'danger' | 'neutral' = 'neutral') =>
  embed({ colour, app: 'Claude', description: description.slice(0, 4000) })

/** The answer's cards, one per part (Cause, What I did…), titled Resolved or Needs you. */
const answerCards = (text: string, solved: boolean) =>
  answerPages(text).map((p) => {
    const status = solved ? 'Resolved' : 'Needs you'
    return embed({ colour: solved ? 'ok' : 'danger', app: 'Claude', title: p.heading ? `${status}: ${p.heading}` : status, description: p.body, at: false })
  })

/**
 * One Doctarr run on a Problem, posting its steps and answer in the thread. Without the bot (only the webhook) just the
 * start and the answer go out. Not solved: the thread is tagged Needs you, and the Admin is @mentioned unless they
 * asked (`ping` false). Solved: back to Open, until the feed sees the Problem gone and marks it Resolved; for an hour
 * the Admin can still reply.
 */
function run(path: '/investigate' | '/reply', p: Problem, body: object, o: { start: string; ping: boolean; busyText: string; started?: (id?: string) => void }) {
  const thread = problemThread(p)
  const key = thread.key
  const say = async (tag: 'Doctarr working' | 'Open' | 'Needs you' | undefined, c: ReturnType<typeof card>, ping = false, pages?: ReturnType<typeof card>[]) => {
    if (!botEnabled()) return void announce(problemThread(p, tag), c, ping)
    try {
      const id = pages ? await postPages(problemThread(p, tag), pages, ping) : await post(problemThread(p, tag), c, ping)
      remember(key, id)
      return id
    } catch (e) {
      console.warn(`[doctarr] ${p.title}: ${(e as Error).message}`)
    }
  }
  // Only the start and the answer are posted: each step it checked or fixed would bury the answer.
  let posting = Promise.resolve()
  let last: Event | undefined
  const onEvent = (e: Event) => {
    if (!e.step) last = e
  }
  const finish = async (solved: boolean, text: string) => {
    await posting
    // The webhook can't take buttons, so it gets the whole answer on one card.
    await say(solved ? 'Open' : 'Needs you', card(text, solved ? 'ok' : 'danger'), !solved && o.ping, answerCards(text, solved))
    updateState(key, (s) => s && { ...s, openUntil: solved ? Date.now() + OPEN_FOR : undefined })
    busy.delete(key)
    replying.delete(key)
  }
  busy.add(key)
  if (path === '/reply') replying.add(key)
  if (botEnabled()) updateState(key, (s) => ({ ...s, problem: p })) // only the bot's threads take replies
  return ask(path, JSON.stringify({ key: problemKey(p), problem: p, ...body }), () => {
    posting = posting.then(async () => o.started?.(await say('Doctarr working', card(o.start, 'info'))))
  }, onEvent)
    .then(({ status, text }) => {
      if (status === 204 || status === 429) return finish(false, o.busyText)
      if (status !== 200) throw new Error(`${status} ${text.slice(0, 300)}`)
      if (last?.answer === undefined) throw new Error(last?.error ?? 'The Doctarr stopped without an answer')
      return finish(!!last.solved, last.answer)
    })
    .catch((e: Error) => {
      console.warn(`[doctarr] ${p.title}: ${e.message}`)
      return finish(false, `The Doctarr couldn't finish: ${e.message.slice(0, 500)}`)
    })
}

/** The Doctarr's first look, in the background: never slows down or fails the feed. */
export function investigate(p: Problem) {
  if (!process.env.DOCTOR) return
  const key = problemThread(p).key
  void run('/investigate', p, {}, {
    start: 'Looking into this Problem.',
    ping: true,
    busyText: 'The Doctarr has looked into this Problem in the last day already, or has reached its limit for today.',
    // Everything from here on is news for its next run: replies count from this card on. The list of releases goes
    // up beside the investigation (only in the bot's forum: it's what replies pick from).
    started: (id) => {
      updateState(key, (s) => s && { ...s, seen: id })
      if (botEnabled())
        postReleaseList(p, (id) => remember(key, id))
          .then((list) => grabOtherQuality(p, list, (id) => remember(key, id)))
          .catch((e: Error) => console.warn(`[doctarr] releases for ${p.title}: ${e.message}`))
    },
  })
}

/**
 * The Admin's reply (or a look they asked for later) to The Doctarr, which carries on its conversation about this
 * Problem. `meanwhile` is what the bot posted in the thread since The Doctarr last looked.
 */
export function reply(p: Problem, words: string, meanwhile: string[]) {
  return run('/reply', p, { reply: words, meanwhile }, {
    start: 'Got it, looking at this again.',
    ping: false,
    busyText: "The Doctarr has answered as many replies as it may today (DOCTOR_REPLIES). Reply again tomorrow, or fix it on the Admin page.",
  })
}
