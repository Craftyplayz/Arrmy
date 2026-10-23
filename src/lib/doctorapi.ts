// What The Doctarr (scripts/doctor.mjs) can ask Arrmy, on the AudioBook Bay relay's internal port (see abbrelay.ts):
// the Editions still waiting, a live AudioBook Bay test through the VPN, and a fresh search for one Edition. On a run
// that answers the Admin's reply, also: a Problem's numbered list of releases (read it, make a new one, grab a number),
// a look again later, and the Go ahead buttons for what can't be undone. <key> is the Problem's key (botrules.ts).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { searchPage } from './abb'
import { doctorToken, safeEqual, sessionSecret } from './token'
import { findEdition, waitingEditions } from './editions'
import { askToConfirm } from './confirm'
import { replying, threadStates, updateState } from './doctor'
import { grabListed, postReleaseList, readableList } from './releaselist'
import { CONFIRM, laterMinutes, type ConfirmAction } from './replyrules'

const json = (res: ServerResponse, status: number, body: unknown) =>
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))

export async function doctorApi(req: IncomingMessage, res: ServerResponse) {
  if (!safeEqual(req.headers.authorization ?? '', `Bearer ${doctorToken(sessionSecret())}`)) return res.writeHead(403).end()
  const url = new URL(req.url ?? '/', 'http://relay')
  const search = url.pathname.match(/^\/doctor\/editions\/([^/]+)\/search$/)
  try {
    if (req.method === 'GET' && url.pathname === '/doctor/editions') return json(res, 200, await waitingEditions())
    if (req.method === 'GET' && url.pathname === '/doctor/abb') {
      const s = url.searchParams.get('s')
      if (!s) return json(res, 400, { error: 's is missing' })
      const start = Date.now()
      return await searchPage(s).then(
        (found) => json(res, 200, { ok: true, ms: Date.now() - start, titles: found.slice(0, 20).map((f) => f.title) }),
        (e: Error) => json(res, 200, { ok: false, ms: Date.now() - start, error: e.message }),
      )
    }
    if (req.method === 'POST' && search) {
      const id = decodeURIComponent(search[1])
      if (!(await waitingEditions()).some((e) => e.id === id)) return json(res, 404, { error: 'No waiting Edition with that id' })
      void findEdition(id)
      return json(res, 202, { started: true })
    }
    const problem = url.pathname.match(/^\/doctor\/(releases|later|confirm)\/([^/]+)(?:\/(list|grab)(?:\/(\d+))?)?$/)
    if (problem) {
      const [, what, rawKey, sub, n] = problem
      const key = decodeURIComponent(rawKey)
      const state = threadStates()[`problem:${key}`]
      if (!state) return json(res, 404, { error: 'No thread for that Problem' })
      // Grabbing, looking later and asking to remove are the Admin's to ask for: only while The Doctarr answers a reply.
      const readOrList = what === 'releases' && (req.method === 'GET' || sub === 'list')
      if (!readOrList && !replying.has(`problem:${key}`)) return json(res, 403, { error: 'Only when answering the Admin' })
      if (what === 'releases' && req.method === 'GET' && !sub) return json(res, 200, readableList(key))
      if (what === 'releases' && req.method === 'POST' && sub === 'list') {
        const list = await postReleaseList(state.problem)
        return json(res, 200, { posted: true, releases: list.entries.length })
      }
      if (what === 'releases' && req.method === 'POST' && sub === 'grab' && n) return json(res, 200, { done: await grabListed(key, Number(n)) })
      if (what === 'later' && req.method === 'POST' && !sub) {
        const minutes = laterMinutes(url.searchParams.get('minutes'))
        const note = url.searchParams.get('note')?.slice(0, 300) || undefined
        updateState(`problem:${key}`, (s) => s && { ...s, later: { at: Date.now() + minutes * 60_000, note } })
        return json(res, 200, { at: new Date(Date.now() + minutes * 60_000).toISOString() })
      }
      if (what === 'confirm' && req.method === 'POST' && !sub) {
        const action = url.searchParams.get('action') as ConfirmAction
        if (!CONFIRM.includes(action)) return json(res, 400, { error: `action must be ${CONFIRM.join(' or ')}` })
        return json(res, 200, { asked: await askToConfirm(key, action, url.searchParams.get('arg') ?? undefined) })
      }
    }
    json(res, 404, { error: 'Not found' })
  } catch (e) {
    json(res, 500, { error: (e as Error).message })
  }
}
