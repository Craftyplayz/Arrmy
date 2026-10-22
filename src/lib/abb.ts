// AudioBook Bay search for the Audiobook Edition: Prowlarr has no ABB, so the results are read off the site's pages.
// ABB lists no seeders, and the info hash plus the page's trackers make the magnet.
import { ABB_URL, abbFetch } from './abbrelay.ts'
import type { Release } from './bookrules.ts'

const UNITS: Record<string, number> = { KBs: 1024, MBs: 1024 ** 2, GBs: 1024 ** 3 }
const decode = (s: string) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** The book page links and titles of a search page. */
export const parseSearch = (html: string) =>
  [...html.matchAll(/<h2[^>]*><a href="(\/abss\/[^"]+)"[^>]*>([^<]+)<\/a>/g)].map(([, path, title]) => ({ path, title: decode(title).trim() }))

/** A book page's size in bytes (0 when ABB shows "?") and its info hash and trackers; no hash, no book. */
export function parseBook(html: string) {
  const hash = html.match(/Info Hash:<\/td>\s*<td>\s*([0-9a-f]{40})\s*</i)?.[1]
  if (!hash) return null
  const [, num, unit] = html.match(/File Size:<\/td>\s*<td>(?:<span[^>]*>)?([\d.,]+)(?:<\/span>)?\s*(\w+)/) ?? []
  const size = Math.round(Number(num?.replace(/,/g, '')) * (UNITS[unit] ?? 0)) || 0
  const trackers = [...new Set([...html.matchAll(/<td[^>]*>\s*((?:udp|https?):\/\/[^<\s]+)\s*<\/td>/g)].map((m) => decode(m[1])))]
  return { hash: hash.toLowerCase(), size, trackers }
}

export const magnetOf = (hash: string, title: string, trackers: string[]) =>
  `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}${trackers.map((t) => `&tr=${encodeURIComponent(t)}`).join('')}`

const page = async (url: string) => {
  const res = await abbFetch(url)
  if (!res.ok) throw new Error(`AudioBook Bay answered ${res.status}`)
  return res.text()
}

/** First page of results. A failing search throws; a book page that fails or has no info hash is skipped. */
export async function searchAudiobookBay(query: string): Promise<Release[]> {
  const found = parseSearch(await page(`${ABB_URL}/?s=${encodeURIComponent(query).replace(/%20/g, '+')}`))
  const books = await Promise.all(found.map(async (f) => {
    try { return { title: f.title, book: parseBook(await page(`${ABB_URL}${f.path}`)) } } catch { return null }
  }))
  return books.flatMap((b) => b?.book ? [{ title: b.title, size: b.book.size, protocol: 'torrent', magnetUrl: magnetOf(b.book.hash, b.title, b.book.trackers) }] : [])
}
