// Hands each Problem #problems announces to the doctor (scripts/doctor.mjs), which has Claude look into it and maybe fix
// it, and posts what it checked, what it fixed and its answer in the Problem's thread. On only when
// CLAUDE_CODE_OAUTH_TOKEN is set (docker-compose.yml sets DOCTOR).
import { request } from 'node:http'
import { problemKey, problemThread } from './botrules'
import { announce, botEnabled } from './discord'
import { embed } from './embeds'
import type { Problem } from './problems'
import { doctorToken, sessionSecret } from './token'

const DOCTOR_URL = process.env.DOCTOR_URL ?? 'http://doctor:3002'

/** One line of the doctor's answer: a step, or the last line with the answer or the error. */
type Event = { step?: 'Checked' | 'Fixed'; text?: string; failed?: boolean; answer?: string; solved?: boolean; error?: string }

// node:http, not fetch: fetch gives up after 5 minutes without an answer, and an investigation can take 20. A 200 means
// the run has started; its body is one JSON line per step, then the answer (doctor.mjs serve).
function ask(body: string, started: () => void, onEvent: (e: Event) => void) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = request(
      `${DOCTOR_URL}/investigate`,
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

/** In the background: never slows down or fails the feed. */
export function investigate(p: Problem) {
  if (!process.env.DOCTOR) return
  // Steps are posted together every 5 seconds, so a burst of reads can't flood the thread. Only in the bot's forum:
  // the webhook's single channel would fill up with them.
  let steps: string[] = []
  let timer: NodeJS.Timeout | undefined
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    if (steps.length) announce(problemThread(p), card(steps.join('\n')))
    steps = []
  }
  let last: Event | undefined
  const onEvent = (e: Event) => {
    if (!e.step) return void (last = e)
    if (!botEnabled()) return
    steps.push(`**${e.step}** \`${(e.text ?? '').replace(/`/g, "'")}\`${e.failed ? ' (failed)' : ''}`)
    timer ??= setTimeout(flush, 5000)
  }
  // Not solved: the thread is tagged Needs you and the Admin is @mentioned. Solved: back to Open, until the feed sees
  // the Problem gone and marks it Resolved.
  const finish = (solved: boolean, text: string) => announce(problemThread(p, solved ? 'Open' : 'Needs you'), card(text, solved ? 'ok' : 'danger'), !solved)
  ask(JSON.stringify({ key: problemKey(p), problem: p }), () => announce(problemThread(p, 'Doctor working'), card('Looking into this Problem.', 'info')), onEvent)
    .then(({ status, text }) => {
      flush()
      if (status === 204) return finish(false, 'The doctor has looked into this Problem in the last day already, or has reached its limit for today.')
      if (status !== 200) throw new Error(`${status} ${text.slice(0, 300)}`)
      if (last?.answer === undefined) throw new Error(last?.error ?? 'the doctor stopped without an answer')
      finish(!!last.solved, `${last.answer}\n\n**Solved:** ${last.solved ? 'Yes' : 'No'}`)
    })
    .catch((e: Error) => {
      flush()
      console.warn(`[doctor] ${p.title}: ${e.message}`)
      finish(false, `The doctor couldn't finish: ${e.message.slice(0, 500)}`)
    })
}
