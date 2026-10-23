// Hands each Problem #problems announces to the doctor (scripts/doctor.mjs), which has Claude look into it and maybe fix
// it, and posts what it checked, what it fixed and its answer in the Problem's thread. Its first look also posts every
// release found, numbered (releaselist.ts). The Admin's replies in the thread go back to the doctor (replies.ts). On
// only when CLAUDE_CODE_OAUTH_TOKEN is set (docker-compose.yml sets DOCTOR).
import { request } from 'node:http'
import { problemKey, problemThread } from './botrules'
import { announce, botEnabled, post } from './discord'
import { getSetting, setSetting } from './db'
import { embed } from './embeds'
import type { Problem } from './problems'
import { postReleaseList } from './releaselist'
import { OPEN_FOR } from './replyrules'
import { doctorToken, sessionSecret } from './token'

const DOCTOR_URL = process.env.DOCTOR_URL ?? 'http://doctor:3002'

/** One line of the doctor's answer: a step, or the last line with the answer or the error. */
type Event = { step?: 'Checked' | 'Fixed'; text?: string; failed?: boolean; answer?: string; solved?: boolean; error?: string }

/**
 * What Arrmy keeps per Problem thread the doctor has posted in: the Problem, the last message it has read (`seen`),
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
/** Keeps a Problem the doctor has looked into up to date for its replies, writing only when it changed. */
export function keepProblem(key: string, p: Problem) {
  const s = threadStates()[key]
  if (JSON.stringify(s?.problem) !== JSON.stringify(p)) updateState(key, (x) => ({ ...x, problem: p }))
}

/** Notes a post as the bot's own work on this Problem, so it isn't handed back to the doctor as news. */
export const remember = (key: string, id: string) => updateState(key, (s) => s && { ...s, mine: [...(s.mine ?? []), id].slice(-300) })

/** Threads the doctor is working in now, and those where it's answering the Admin. In memory: a restart ends any run anyway. */
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

/**
 * One doctor run on a Problem, posting its steps and answer in the thread. Without the bot (only the webhook) just the
 * start and the answer go out. Not solved: the thread is tagged Needs you, and the Admin is @mentioned unless they
 * asked (`ping` false). Solved: back to Open, until the feed sees the Problem gone and marks it Resolved; for an hour
 * the Admin can still reply.
 */
function run(path: '/investigate' | '/reply', p: Problem, body: object, o: { start: string; ping: boolean; busyText: string; started?: (id?: string) => void }) {
  const thread = problemThread(p)
  const key = thread.key
  const say = async (tag: 'Doctor working' | 'Open' | 'Needs you' | undefined, c: ReturnType<typeof card>, ping = false) => {
    if (!botEnabled()) return void announce(problemThread(p, tag), c, ping)
    try {
      const id = await post(problemThread(p, tag), c, ping)
      remember(key, id)
      return id
    } catch (e) {
      console.warn(`[doctor] ${p.title}: ${(e as Error).message}`)
    }
  }
  // Steps are posted together every 5 seconds, so a burst of reads can't flood the thread. Only in the bot's forum:
  // the webhook's single channel would fill up with them.
  let steps: string[] = []
  let timer: NodeJS.Timeout | undefined
  let posting = Promise.resolve()
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    const text = steps.join('\n')
    steps = []
    if (text) posting = posting.then(async () => void (await say(undefined, card(text))))
    return posting
  }
  let last: Event | undefined
  const onEvent = (e: Event) => {
    if (!e.step) return void (last = e)
    if (!botEnabled()) return
    steps.push(`**${e.step}** \`${(e.text ?? '').replace(/`/g, "'")}\`${e.failed ? ' (failed)' : ''}`)
    timer ??= setTimeout(flush, 5000)
  }
  const finish = async (solved: boolean, text: string) => {
    await flush()
    await say(solved ? 'Open' : 'Needs you', card(text, solved ? 'ok' : 'danger'), !solved && o.ping)
    updateState(key, (s) => s && { ...s, openUntil: solved ? Date.now() + OPEN_FOR : undefined })
    busy.delete(key)
    replying.delete(key)
  }
  busy.add(key)
  if (path === '/reply') replying.add(key)
  if (botEnabled()) updateState(key, (s) => ({ ...s, problem: p })) // only the bot's threads take replies
  return ask(path, JSON.stringify({ key: problemKey(p), problem: p, ...body }), () => {
    posting = posting.then(async () => o.started?.(await say('Doctor working', card(o.start, 'info'))))
  }, onEvent)
    .then(({ status, text }) => {
      if (status === 204 || status === 429) return finish(false, o.busyText)
      if (status !== 200) throw new Error(`${status} ${text.slice(0, 300)}`)
      if (last?.answer === undefined) throw new Error(last?.error ?? 'the doctor stopped without an answer')
      return finish(!!last.solved, `${last.answer}\n\n**Solved:** ${last.solved ? 'Yes' : 'No'}`)
    })
    .catch((e: Error) => {
      console.warn(`[doctor] ${p.title}: ${e.message}`)
      return finish(false, `The doctor couldn't finish: ${e.message.slice(0, 500)}`)
    })
}

/** The doctor's first look, in the background: never slows down or fails the feed. */
export function investigate(p: Problem) {
  if (!process.env.DOCTOR) return
  const key = problemThread(p).key
  void run('/investigate', p, {}, {
    start: 'Looking into this Problem.',
    ping: true,
    busyText: 'The doctor has looked into this Problem in the last day already, or has reached its limit for today.',
    // Everything from here on is news for its next run: replies count from this card on. The list of releases goes
    // up beside the investigation (only in the bot's forum: it's what replies pick from).
    started: (id) => {
      updateState(key, (s) => s && { ...s, seen: id })
      if (botEnabled())
        postReleaseList(p, (id) => remember(key, id)).catch((e: Error) => console.warn(`[doctor] releases for ${p.title}: ${e.message}`))
    },
  })
}

/**
 * The Admin's reply (or a look they asked for later) to the doctor, which carries on its conversation about this
 * Problem. `meanwhile` is what the bot posted in the thread since the doctor last looked.
 */
export function reply(p: Problem, words: string, meanwhile: string[]) {
  return run('/reply', p, { reply: words, meanwhile }, {
    start: 'Got it, looking at this again.',
    ping: false,
    busyText: "The doctor has answered as many replies as it may today (DOCTOR_REPLIES). Reply again tomorrow, or fix it on the Admin page.",
  })
}
