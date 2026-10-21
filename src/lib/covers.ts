// Book cover art: the first of several sources that has the book. OpenLibrary's own cover server is often unreachable and
// has none for many works, so it is the last resort (see searchAudiobooks). Audible's and Amazon's addresses are
// unofficial (Audiobookshelf uses Audible's the same way), so each source is allowed to fail quietly.
import { isbn10, sameBook } from './bookrules'

type Book = { title: string; author: string }
const get = (url: string) => fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5_000) })
const json = async <T>(url: string) => {
  const res = await get(url)
  return res.ok ? ((await res.json()) as T) : undefined
}
/** An image counts if it downloads and isn't a placeholder: Google's is ~1 KB, Amazon's a 1-pixel gif. */
const real = async (url: string) => {
  const res = await get(url).catch(() => undefined)
  return !!res?.ok && (await res.arrayBuffer()).byteLength > 3_000
}

/** Audible's catalogue, which has the audiobook's own cover. */
async function audible({ title, author }: Book) {
  const q = new URLSearchParams({ num_results: '5', response_groups: 'product_desc,contributors,media', title, author })
  type Product = { title: string; authors?: { name: string }[]; product_images?: Record<string, string> }
  const found = (await json<{ products?: Product[] }>(`https://api.audible.com/1.0/catalog/products?${q}`))?.products ?? []
  const match = found.find((p) => sameBook({ title: p.title, author: p.authors?.[0]?.name }, { title, author }))
  return match?.product_images?.['500'] ?? Object.values(match?.product_images ?? {}).pop()
}

/** Apple's audiobook catalogue (the iTunes Search API, no key). */
async function apple({ title, author }: Book) {
  const q = new URLSearchParams({ term: `${title} ${author}`, media: 'audiobook', limit: '5' })
  type Hit = { collectionName: string; artistName?: string; artworkUrl100?: string }
  const found = (await json<{ results?: Hit[] }>(`https://itunes.apple.com/search?${q}`))?.results ?? []
  const match = found.find((h) => sameBook({ title: h.collectionName, author: h.artistName }, { title, author }))
  return match?.artworkUrl100?.replace('100x100bb', '600x600bb')
}

/** Google Books' image server by ISBN. (Its volumes API needs a key: without one everyone shares a daily quota.) */
async function google(isbns: string[]) {
  for (const isbn of isbns) {
    const url = `https://books.google.com/books/content?vid=ISBN:${isbn}&printsec=frontcover&img=1&zoom=1`
    if (await real(url)) return url
  }
}

/** Amazon's cover by ISBN-10, which only exists for books with a 978- ISBN. */
async function amazon(isbns: string[]) {
  for (const isbn of isbns) {
    const ten = isbn10(isbn)
    const url = ten && `https://m.media-amazon.com/images/P/${ten}.01._SCLZZZZZZZ_.jpg`
    if (url && (await real(url))) return url
  }
}

/** In order: Audible, Apple, Google Books, Amazon. shortcut: nothing is cached, so each search asks again; cache the winner if it gets slow. */
export async function findCover(book: Book, isbns: string[] = []) {
  const few = [...isbns.filter((i) => i.length === 13), ...isbns.filter((i) => i.length !== 13)].slice(0, 4)
  for (const source of [() => audible(book), () => apple(book), () => google(few), () => amazon(few)]) {
    const url = await source().catch(() => undefined)
    if (url) return url
  }
}
