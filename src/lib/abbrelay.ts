// The AudioBook Bay relay. LazyLibrarian's built-in AudioBook Bay search is pointed here (see the Wiring), because the site
// answers 404 to any user agent mentioning LazyLibrarian, which LazyLibrarian reads as "no results". The relay fetches the
// same pages with a browser's user agent and hands them back unchanged.
//
// It's its own small server on an internal port, not a Next.js route: LazyLibrarian opens book pages imitating Chrome,
// which asks to switch to HTTP/2 mid-request, and Next.js's server leaves that hanging. Node's plain server answers it
// as HTTP/1.1. The port isn't published or tunnelled, and the key in the address is checked anyway. /doctor/ addresses
// are The Doctarr's own questions (doctorapi.ts).
import { createServer } from 'node:http'
import { fetch as undiciFetch, ProxyAgent } from 'undici'
// .ts so plain node (the tests) can load this file too
import { audiobookBayToken, safeEqual, sessionSecret } from './token.ts'

export const ABB_URL = process.env.ABB_URL ?? 'https://audiobookbay.lu'
export const BROWSER = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0'
export const RELAY_PORT = Number(process.env.ABB_RELAY_PORT ?? 3001)

// The home connection can't reach AudioBook Bay (it times out), so in the Stack it goes through the VPN's proxy
// (ABB_PROXY, gluetun:8888), like Prowlarr's indexers. undici's fetch: Node's own can't take a proxy per request.
const proxy = process.env.ABB_PROXY ? new ProxyAgent(process.env.ABB_PROXY) : undefined

/** Fetches an AudioBook Bay page as a browser would, through the VPN when ABB_PROXY is set. */
export async function abbFetch(url: string) {
  // Up to 3 tries: from some VPN servers it drops about 1 connection in 10, and an Edition search makes ~20.
  for (let attempt = 1; ; attempt++) {
    try {
      return await undiciFetch(url, { headers: { 'User-Agent': BROWSER }, dispatcher: proxy, signal: AbortSignal.timeout(30_000) })
    } catch (e) {
      if (attempt === 3) throw e
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

/** The address LazyLibrarian's AudioBook Bay setting gets. scripts/init.mjs writes the same for fresh installs. */
export const relayAddress = () => `http://arrmy:${RELAY_PORT}/abb/${audiobookBayToken(sessionSecret())}`

/**
 * The AudioBook Bay page a relay request is for, or an HTTP status to answer instead. LazyLibrarian joins the host and a
 * page link with a slash, so book pages arrive as /abb/<key>//abss/<slug>/; empty segments are dropped.
 */
export function upstreamUrl(requestUrl: string, key: string): string | 403 | 400 {
  const url = new URL(requestUrl, 'http://relay')
  const [prefix, token, ...rest] = url.pathname.split('/').filter(Boolean)
  if (prefix !== 'abb' || !token || !safeEqual(token, key)) return 403
  // Only page paths (search pages, book pages): nothing that could point the relay anywhere else.
  if (!rest.every((p) => /^[\w.-]+$/.test(p) && p !== '..')) return 400
  return `${ABB_URL}/${rest.join('/')}${rest.length ? '/' : ''}${url.search}`
}

export function startAudiobookBayRelay() {
  createServer(async (req, res) => {
    // Loaded only when asked: it pulls in the database, which the tests loading this file don't have.
    if (req.url?.startsWith('/doctor/')) return (await import('./doctorapi')).doctorApi(req, res)
    const target = req.method === 'GET' ? upstreamUrl(req.url ?? '/', audiobookBayToken(sessionSecret())) : 405
    if (typeof target === 'number') return res.writeHead(target).end()
    try {
      const page = await abbFetch(target)
      res.writeHead(page.status, { 'Content-Type': page.headers.get('content-type') ?? 'text/html' }).end(await page.text())
    } catch (e) {
      res.writeHead(502).end(`AudioBook Bay: ${(e as Error).message}`)
    }
  }).listen(RELAY_PORT)
}
