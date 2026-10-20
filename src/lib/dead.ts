// Dead releases: a torrent that never starts is swapped for another release. After STRIKES dead releases in a row for
// the same title, the last one is left alone and the Admin gets a Problem and a Discord ping instead.
import { queueOf, retryRelease } from './arr'
import { audiobookTorrents, dropAudiobookRelease, searchDroppedBooks } from './books'
import { addDeadRelease, deadReleaseCount, isDeadRelease, pendingBookSearches, requestsFor, setSearchPending } from './db'
import { pingAdmin } from './notify'
import { byDownload, deadReason, nameOf, STRIKES } from './problems'
import { torrents } from './qbit'

// The qBittorrent categories Radarr, Sonarr and LazyLibrarian file their torrents under. Anything else is left alone.
const CATEGORIES = new Set(['movies', 'tv', 'books'])

/** What each torrent hash is for, and how to swap it for another release. */
type Target = { item: string; title: string; book?: string; swap: () => Promise<unknown> }

async function targets(categories: Set<string>) {
  const [movies, tv, books] = await Promise.all([
    categories.has('movies') ? queueOf('radarr') : [],
    categories.has('tv') ? queueOf('sonarr') : [],
    categories.has('books') ? audiobookTorrents() : new Map<string, string>(),
  ])
  const found = new Map<string, Target>()
  for (const [service, records] of [['radarr', movies], ['sonarr', tv]] as const)
    for (const g of byDownload(records)) {
      const r = g[0]
      if (!r.downloadId) continue
      found.set(r.downloadId.toLowerCase(), {
        item: service === 'radarr' ? `radarr:${r.movieId}` : `sonarr:${r.seriesId}:${r.seasonNumber}`,
        title: nameOf(r),
        swap: () => retryRelease(service, g.map((x) => x.id)),
      })
    }
  for (const [hash, book] of books)
    found.set(hash, {
      item: `book:${book}`,
      title: requestsFor('audiobook', book)[0]?.title ?? book,
      book,
      swap: () => dropAudiobookRelease(hash),
    })
  return found
}

export async function checkDeadReleases(now = Date.now()) {
  const dead = (await torrents()).flatMap((t) => {
    const reason = CATEGORIES.has(t.category) && !isDeadRelease(t.hash.toLowerCase()) && deadReason(t, now)
    return reason ? [{ hash: t.hash.toLowerCase(), category: t.category, reason }] : []
  })
  if (dead.length) {
    const found = await targets(new Set(dead.map((t) => t.category)))
    for (const t of dead) {
      const target = found.get(t.hash)
      if (!target) continue // not handed to its Service yet, or not one of theirs
      const strike = deadReleaseCount(target.item) + 1
      const last = strike >= STRIKES
      // Swapped before it's recorded, so a swap that fails is tried again next minute.
      if (!last) await target.swap()
      addDeadRelease({ hash: t.hash, item: target.item, title: target.title, kept: last, searchPending: !last && !!target.book })
      if (last) {
        console.warn(`[dead] ${target.title}: ${t.reason}. ${strike} dead releases in a row, so it's a Problem now`)
        await pingAdmin(
          `**${target.title}**: ${strike} releases in a row never started (${t.reason.toLowerCase()}). It's a Problem in Arrmy's Admin view now.`,
        ).catch((e) => console.warn(`[discord] ${e.message}`))
      } else console.log(`[dead] ${target.title}: ${t.reason}. Trying another release (${strike} of ${STRIKES})`)
    }
  }

  const pending = pendingBookSearches()
  if (pending.length)
    for (const hash of await searchDroppedBooks(pending.map((d) => ({ hash: d.hash, bookId: d.item.replace('book:', '') }))))
      setSearchPending(hash, false)
}

export function startDeadReleaseWatch() {
  let running = false
  setInterval(async () => {
    if (running) return // a slow LazyLibrarian run can outlast the minute
    running = true
    try {
      await checkDeadReleases()
    } catch (e) {
      console.warn(`[dead] ${(e as Error).message}`)
    } finally {
      running = false
    }
  }, 60_000)
}
