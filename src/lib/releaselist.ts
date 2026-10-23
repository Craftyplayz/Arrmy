// The Doctarr's numbered list of every release found for a Problem, posted in its thread with the whole list attached
// as a text file, so the Admin can reply "download number 36". Built here rather than by Claude: exact, and free
// however long it is. The rules (order, lines, cards) are in replyrules.ts.
import { arr } from './arr'
import type { LLBook, Release } from './bookrules'
import { ll } from './books'
import { problemKey, problemThread } from './botrules'
import { deadHashes, getSetting, setSetting } from './db'
import { post } from './discord'
import { grabEditionRelease, pickBookRelease, searchEditionReleases } from './editions'
import { embed } from './embeds'
import type { Problem } from './problems'
import { escape, listCards, listFile, listIntro, numbered, otherQuality, type Found, type Listed, type ReleaseList } from './replyrules'

type ArrRelease = {
  guid: string
  indexerId: number
  indexer: string
  title: string
  size: number
  seeders?: number
  infoHash?: string
  protocol?: string
  quality?: { quality?: { name: string } }
  rejections?: (string | { reason: string })[]
  fullSeason?: boolean
}
type ProwlarrRelease = Release & { indexer?: string; infoHash?: string }

/** Releases shown on cards; past this only the attached file has them. */
const LIST_MAX = 200

/** A Problem's latest list, with the Problem it was made for (grabbing needs what was searched). */
type Stored = ReleaseList & { problem: Problem }
const keyOf = (p: Problem) => `doctor:releases:${problemKey(p)}`
export const storedList = (problemKey: string) => getSetting<Stored>(`doctor:releases:${problemKey}`)

const hashOf = (r: { infoHash?: string; magnetUrl?: string }) => (r.infoHash ?? /btih:([a-f0-9]{40})/i.exec(r.magnetUrl ?? '')?.[1])?.toLowerCase()

/** Radarr's or Sonarr's own search (Interactive Search in their pages): every release, with why each would be turned down. */
const arrSearch = (p: Problem) => {
  const m = p.media!
  return 'movieId' in m
    ? arr<ArrRelease[]>('radarr', `/release?movieId=${m.movieId}`)
    : arr<ArrRelease[]>('sonarr', `/release?seriesId=${m.seriesId}&seasonNumber=${m.season}`)
}

async function search(p: Problem): Promise<Found[]> {
  const dead = deadHashes()
  if (p.media) {
    const app = 'movieId' in p.media ? ('radarr' as const) : ('sonarr' as const)
    return (await arrSearch(p))
      .filter((r) => r.protocol !== 'usenet')
      .map((r) => ({
        title: r.title,
        size: r.size,
        seeders: r.seeders,
        source: (r.indexer ?? 'Unknown indexer').replace(/ \(Prowlarr\)$/, ''),
        quality: r.quality?.quality?.name,
        rejections: (r.rejections ?? []).map((x) => (typeof x === 'string' ? x : x.reason)),
        dead: dead.has(hashOf(r) ?? ''),
        fullSeason: r.fullSeason,
        grab: { app, guid: r.guid, indexerId: r.indexerId },
      }))
  }
  if (p.service === 'editions' && p.book) {
    const { releases, candidates } = await searchEditionReleases(p.book)
    const kinds = new Map(candidates.map((c) => [c.release, c.kind]))
    return releases
      .filter((r: ProwlarrRelease) => r.protocol === 'torrent')
      .map((r: ProwlarrRelease) => ({
        title: r.title,
        size: r.size,
        seeders: r.seeders,
        source: r.indexer?.replace(/ \(Prowlarr\)$/, '') ?? 'Prowlarr',
        rejections: kinds.has(r) ? [] : ['not this book read by this narrator, or too small for an audiobook'],
        dead: dead.has(hashOf(r) ?? ''),
        grab: r.magnetUrl || r.downloadUrl ? { app: 'edition' as const, id: p.book!, release: r, pack: kinds.get(r) === 'pack' } : { app: 'none' as const, why: 'it has no link to download' },
      }))
  }
  if (p.service === 'lazylibrarian' && p.book) {
    // LazyLibrarian finds its releases through Prowlarr, so this is the same search it makes.
    const book = (await ll<LLBook[]>('getAllBooks')).find((b) => b.BookID === p.book)
    const queries = [...new Set([book ? `${book.BookName} ${book.AuthorName}` : p.title, book?.BookName ?? p.title])]
    const found = (
      await Promise.all(queries.map((query) => arr<ProwlarrRelease[]>('prowlarr', `/search?${new URLSearchParams({ query, type: 'search' })}&categories=3030&categories=3000`)))
    ).flat()
    return [...new Map(found.map((r) => [r.downloadUrl ?? r.magnetUrl ?? r.title, r])).values()]
      .filter((r) => r.protocol === 'torrent')
      .map((r) => ({
        title: r.title,
        size: r.size,
        seeders: r.seeders,
        source: r.indexer?.replace(/ \(Prowlarr\)$/, '') ?? 'Prowlarr',
        rejections: r.size && r.size < 50e6 ? ['too small for an audiobook (probably an ebook)'] : [],
        dead: dead.has(hashOf(r) ?? ''),
        // LazyLibrarian only files a download it grabbed itself, so Arrmy downloads the pick and files it (editions.ts).
        grab: r.magnetUrl || r.downloadUrl ? { app: 'book' as const, id: p.book!, release: r } : { app: 'none' as const, why: 'it has no link to download' },
      }))
  }
  throw new Error(`nothing to search for ${p.title}`)
}

/**
 * Searches for every release of the Problem's title, numbers them, keeps the list and posts it in the Problem's
 * thread: a card saying how many and how to pick, the releases on cards, and the whole list as a text file, always.
 * `posted` gets each post's id.
 */
export async function postReleaseList(p: Problem, posted: (id: string) => void = () => {}) {
  const entries = numbered(await search(p))
  const list: Stored = { at: Date.now(), title: p.title, entries, problem: p }
  setSetting(keyOf(p), list)
  const shown = Math.min(entries.length, LIST_MAX)
  const cards = listCards(entries, LIST_MAX)
  const thread = problemThread(p)
  const file = { name: `releases-${new Date(list.at).toISOString().slice(0, 10)}.txt`, text: listFile(list) }
  posted(await post(thread, embed({ colour: 'info', app: 'Arrmy', title: 'Every release found', description: listIntro(list, shown) }), false, { file }))
  for (const c of cards) posted(await post(thread, embed({ colour: 'neutral', description: c, at: false })))
  return list
}

/**
 * When nothing in a wanted quality can be had, grabs the best release in another one (otherQuality) and says so in the
 * thread: a watchable copy now beats waiting. Only on The Doctarr's first look.
 */
export async function grabOtherQuality(p: Problem, list: Stored, posted: (id: string) => void = () => {}) {
  const pick = otherQuality(list.entries)
  if (!pick) return
  const done = await grabListed(problemKey(p), pick.n)
  const facts = [pick.quality, pick.seeders !== undefined && `${pick.seeders} seeders`].filter(Boolean).join(', ')
  posted(
    await post(
      problemThread(p),
      embed({
        colour: 'ok',
        app: 'Arrmy',
        title: 'Grabbed another quality',
        description: `Nothing in the wanted quality can be downloaded, so Arrmy grabbed number ${pick.n} instead (${facts}).\n${escape(done)}\nReply if you'd rather wait for the wanted quality.`,
      }),
    ),
  )
}

/** The latest list as The Doctarr reads it (`get arrmy /releases`): one line per release, without the grab details. */
export function readableList(problemKey: string) {
  const list = storedList(problemKey)
  if (!list) return { error: 'No list of releases has been made for this Problem yet: run `fix list-releases`.' }
  return {
    title: list.title,
    at: new Date(list.at).toISOString(),
    releases: list.entries.map(({ grab, ...r }: Listed) => ({ ...r, ...(grab.app === 'none' && { cannotGrab: grab.why }) })),
  }
}

/**
 * Downloads release `n` of the Problem's latest list: through Radarr or Sonarr, which track and import it as usual, or
 * Arrmy's own download, which files an Edition or a book LazyLibrarian was looking for into Audiobookshelf. Radarr and Sonarr forget a search's releases after about 30 minutes, so a release they
 * no longer know is searched for again first.
 */
export async function grabListed(problemKey: string, n: number) {
  const list = storedList(problemKey)
  if (!list) throw new Error('No list of releases for this Problem yet')
  const r = list.entries.find((e) => e.n === n)
  if (!r) throw new Error(`There is no number ${n}: the latest list has ${list.entries.length}`)
  const g = r.grab
  if (g.app === 'none') throw new Error(`Can't grab number ${n}: ${g.why}`)
  if (g.app === 'book') {
    await pickBookRelease(g.id, g.release)
    return `Sent number ${n} (${r.title}) to qBittorrent. Arrmy files it into Audiobookshelf when it finishes, and LazyLibrarian has stopped looking for the book.`
  }
  if (g.app === 'edition') {
    await grabEditionRelease(g.id, g.release, g.pack)
    return `Sent number ${n} (${r.title}) to qBittorrent for the Edition${g.pack ? ', downloading only this book\'s files' : ''}.`
  }
  const send = () => arr(g.app, '/release', 'POST', { guid: g.guid, indexerId: g.indexerId })
  try {
    await send()
  } catch {
    const again = await arrSearch(list.problem)
    if (!again.some((x) => x.guid === g.guid)) throw new Error(`${g.app === 'radarr' ? 'Radarr' : 'Sonarr'} no longer finds number ${n} (${r.title}): run \`fix list-releases\` for a fresh list`)
    await send()
  }
  return `Sent number ${n} (${r.title}) to ${g.app === 'radarr' ? 'Radarr' : 'Sonarr'}, which grabs it and imports it as usual.`
}
