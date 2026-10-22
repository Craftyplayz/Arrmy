// Hands each Problem #problems announces to the doctor (scripts/doctor.mjs), which has Claude look into it and maybe fix
// it, and posts the answer under it. On only when CLAUDE_CODE_OAUTH_TOKEN is set (docker-compose.yml sets DOCTOR).
import { request } from 'node:http'
import { problemKey } from './botrules'
import { announce } from './discord'
import { embed } from './embeds'
import type { Problem } from './problems'
import { doctorToken, sessionSecret } from './token'

const DOCTOR_URL = process.env.DOCTOR_URL ?? 'http://doctor:3002'

// node:http, not fetch: fetch gives up after 5 minutes without an answer, and an investigation can take 20.
function ask(body: string) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = request(
      `${DOCTOR_URL}/investigate`,
      { method: 'POST', headers: { Authorization: `Bearer ${doctorToken(sessionSecret())}`, 'Content-Type': 'application/json' }, timeout: 30 * 60_000 },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c: string) => (text += c)).on('end', () => resolve({ status: res.statusCode ?? 0, text }))
      },
    )
    req.on('timeout', () => req.destroy(new Error('no answer in 30 minutes'))).on('error', reject)
    req.end(body)
  })
}

/** In the background: never slows down or fails the feed. */
export function investigate(p: Problem) {
  if (!process.env.DOCTOR) return
  ask(JSON.stringify({ key: problemKey(p), problem: p }))
    .then(({ status, text }) => {
      if (status === 204) return // looked into today already, or the day's limit is reached
      if (status !== 200) throw new Error(`${status} ${text.slice(0, 300)}`)
      announce('problems', embed({ colour: 'info', app: 'Claude', title: p.title, art: p.poster, description: text.slice(0, 4000), fields: [['Problem', p.kind]] }))
    })
    .catch((e: Error) => console.warn(`[doctor] ${p.title}: ${e.message}`))
}
