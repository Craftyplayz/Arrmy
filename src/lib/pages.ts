// Posts with Back and Next buttons (The Doctarr's answer, the list of releases): every page is a whole card, kept by
// id so a click (/api/discord) can swap in another. One settings row per post, kept for good: a click reads only its own.
import { randomUUID } from 'node:crypto'
import { getSetting, setSetting } from './db'
import { post, type Extra, type Target } from './discord'
import { compact, type Embed } from './embeds'
import { pageButtons } from './replyrules'

const keyOf = (id: string) => `discord:pages:${id}`

const page = (id: string, pages: Embed[], n: number) => ({
  card: pages.length > 1 ? { ...pages[n], footer: { text: `Page ${n + 1} of ${pages.length}` } } : pages[n],
  components: pageButtons(id, n, pages.length),
})

/** Posts the first page with the buttons (none for a single page) and returns the message id, like post. */
export async function postPages(target: Target, pages: Embed[], ping = false, file?: Extra['file']) {
  const id = randomUUID().replace(/-/g, '').slice(0, 16)
  if (pages.length > 1) setSetting(keyOf(id), pages)
  const first = page(id, pages, 0)
  return post(target, first.card, ping, { file, components: first.components })
}

/** Page `n` of a kept post, as a thread post shows it, or undefined if it isn't kept (from before pages, or deleted). */
export function turnPage(id: string, n: number) {
  const pages = getSetting<Embed[]>(keyOf(id))
  if (!pages?.[n]) return
  const p = page(id, pages, n)
  return { ...p, card: compact(p.card) }
}
