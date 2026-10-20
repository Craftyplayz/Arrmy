import { audiobookBayToken, safeEqual, sessionSecret } from '@/lib/token'

// LazyLibrarian's built-in AudioBook Bay search is pointed here (see the Wiring). AudioBook Bay answers 404 to anything
// whose user agent mentions LazyLibrarian, which LazyLibrarian reads as "no results", so Arrmy fetches the same pages
// with a browser's user agent and hands them back unchanged.
const ABB_URL = process.env.ABB_URL ?? 'https://audiobookbay.lu'
const BROWSER = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0'

export async function GET(request: Request, { params }: { params: Promise<{ token: string; path?: string[] }> }) {
  const { token, path = [] } = await params
  if (!safeEqual(token, audiobookBayToken(sessionSecret()))) return new Response('Forbidden', { status: 403 })
  // Only page paths (search pages, book pages): nothing that could point the relay anywhere else.
  if (!path.every((p) => /^[\w.-]+$/.test(p))) return new Response('Bad path', { status: 400 })
  const res = await fetch(`${ABB_URL}/${path.map(encodeURIComponent).join('/')}${path.length ? '/' : ''}${new URL(request.url).search}`, {
    headers: { 'User-Agent': BROWSER },
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  }).catch((e: Error) => new Response(`AudioBook Bay: ${e.message}`, { status: 502 }))
  return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') ?? 'text/html' } })
}
