// What the doctor (scripts/doctor.mjs) can ask Arrmy, on the AudioBook Bay relay's internal port (see abbrelay.ts):
// the Editions still waiting, a live AudioBook Bay test through the VPN, and a fresh search for one Edition.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { searchPage } from './abb'
import { doctorToken, safeEqual, sessionSecret } from './token'
import { findEdition, waitingEditions } from './editions'

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
    json(res, 404, { error: 'Not found' })
  } catch (e) {
    json(res, 500, { error: (e as Error).message })
  }
}
