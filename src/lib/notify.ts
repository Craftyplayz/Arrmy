// Request events as posts in the Request's thread in the Requests forum: one thread per title, with everything that
// happened to it (embeds.ts has the look, botrules.ts the thread). The Request Log's events (see logrules.ts) are posted
// as they're recorded, through log().
import { editionOf } from './bookrules'
import { duration, linked, requestThread, size, type RequestStatus } from './botrules'
import { addLog, getSetting, getThread, listRequests, logFor, logItem, requestsFor, seasonsOf, setSetting, type RequestRow } from './db'
import { announce, botEnabled, post, publicUrl, retag } from './discord'
import { COLOUR, embed, people, speed, type Embed } from './embeds'
import { releaseText, utc, whyNothing, type Dead, type Downloaded, type Grabbed, type Imported, type LogKind, type Note, type Searched } from './logrules'

/** What a card needs to know about a Request, before or after it's saved. `slug` is Sonarr's; `tmdbId` a show's. */
export type RequestItem = Pick<RequestRow, 'media_type' | 'external_id' | 'title' | 'year' | 'poster'> & { id?: number; slug?: string; tmdbId?: number }

/** "Dune (2021)" */
export const titleOf = (r: Pick<RequestRow, 'title' | 'year'>) => `${r.title}${r.year ? ` (${r.year})` : ''}`

/** The app that handles a Request. Its own page only opens for the Admin, so the author line links to Arrmy instead. */
function service(r: RequestItem) {
  if (r.media_type === 'movie') return 'Radarr'
  if (r.media_type === 'tv') return 'Sonarr'
  return editionOf(r.external_id) ? 'Arrmy' : 'LazyLibrarian' // see editions.ts
}

/** The title's page in Arrmy: Discover when there's a TMDB id, otherwise the Request's own page. */
const pageOf = (r: RequestItem) =>
  r.media_type === 'movie'
    ? publicUrl('arrmy', `/discover/movie/${r.external_id}`)
    : r.tmdbId
      ? publicUrl('arrmy', `/discover/tv/${r.tmdbId}`)
      : publicUrl('arrmy', r.id ? `/requests/${r.id}` : '/requests')

const threadOf = (r: RequestItem, status?: RequestStatus) => requestThread(logItem(r.media_type, r.external_id), titleOf(r), r.media_type, status, r.poster)

function card(r: RequestItem, colour: keyof typeof COLOUR, title: string, description?: string, fields: [string, string | undefined | false][] = [], at?: Date) {
  return embed({ colour, app: service(r), appUrl: publicUrl('arrmy', '/requests'), title, url: pageOf(r), art: r.poster, description, fields, at })
}

/**
 * A post in a Request's thread. The first one opens the thread, so it's titled with the title itself; `status` swaps
 * the thread's status tag.
 */
export function tellRequest(r: RequestItem, colour: keyof typeof COLOUR, description: string, fields: [string, string | undefined][] = [], status?: RequestStatus) {
  announce(threadOf(r, status), card(r, colour, titleOf(r), description, fields))
}

/** A removed Request: who removed it, then the thread is archived unless someone else still wants the title. */
export function tellRemoved(r: RequestRow, description: string, othersLeft: boolean) {
  tellRequest(r, 'neutral', description, [], othersLeft ? undefined : 'Removed')
  if (!othersLeft && botEnabled()) retag(threadOf(r).key, { archived: true })
}

const seasonLabel = (seasons?: number[]) => (seasons?.length ? ` · Season${seasons.length > 1 ? 's' : ''} ${seasons.join(', ')}` : '')

/** A Request Log event as a post, or nothing for events the thread doesn't show. */
export function logCard(r: RequestItem, kind: LogKind, detail: object, at?: Date): { card: Embed; status?: RequestStatus } | undefined {
  if (kind === 'searched') {
    const x = detail as Searched
    if (x.error) return { card: card(r, 'danger', 'Search', 'The search failed, so Radarr searched by itself.', [], at) }
    const ok = x.releases.filter((s) => !s.rejections.length).length
    const shown = x.releases.slice(0, 10).map((s) => releaseText(s).slice(0, 300))
    const more = x.releases.length - shown.length
    const head = ok ? `${x.releases.length} releases found, ${ok} acceptable.` : `Nothing to grab. ${whyNothing(x.releases)} Radarr keeps watching for new releases.`
    const lines = [head, ...shown, more > 0 && `…and ${more} more.`].filter(Boolean).join('\n')
    return { card: card(r, ok ? 'info' : 'danger', 'Search', lines, [], at) }
  }
  if (kind === 'grabbed') {
    const x = detail as Grabbed
    const page = r.id ? publicUrl('arrmy', `/requests/${r.id}`) : undefined
    return {
      status: 'Downloading',
      card: card(r, 'info', `Picked${seasonLabel(x.seasons)}`, x.release, [
        ['Indexer', x.indexer],
        ['Size', x.size ? size(x.size) : undefined],
        ['Quality', x.quality],
        ['Torrent', page && linked('On the Request page', page)],
      ], at),
    }
  }
  if (kind === 'dead') {
    const x = detail as Dead
    const why = x.by ? `${x.by} chose Try another release.` : `${x.reason}, so Arrmy is trying another release.`
    return { card: card(r, 'info', `Dead release swapped${seasonLabel(x.seasons)}`, why, [], at) }
  }
  if (kind === 'downloaded') {
    const x = detail as Downloaded
    return {
      card: card(r, 'ok', `Downloaded${seasonLabel(x.seasons)}`, undefined, [
        ['Took', duration(x.seconds)],
        ['Average speed', x.seconds > 0 && speed(x.size / x.seconds)],
        ['Size', size(x.size)],
        ['Seeders', x.seeds ? `Up to ${x.seeds}` : undefined],
      ], at),
    }
  }
  if (kind === 'imported') {
    const x = detail as Imported
    return {
      card: card(r, 'info', `Imported into ${service(r)}${seasonLabel(x.seasons)}`, undefined, [
        ['Quality', x.quality],
        ['Resolution', x.resolution],
        ['Size', x.size ? size(x.size) : undefined],
        ['Audio', x.audioLanguages?.length ? [...new Set(x.audioLanguages)].join(', ') : undefined],
        ['Subtitles', x.subtitles?.length ? [...new Set(x.subtitles)].join(', ') : undefined],
      ], at),
    }
  }
  if (kind === 'note') {
    const x = detail as Note
    if (x.request !== undefined) return // an edit, which tellRequest already posted
    return { card: card(r, 'info', `${x.text}${seasonLabel(x.seasons)}`, x.by && `By ${x.by}.`, [], at) }
  }
}

/** Records a Request Log event, and posts it in the title's thread if someone requested the title. */
export function log(item: string, kind: LogKind, detail: object) {
  addLog(item, kind, detail)
  if (!botEnabled()) return
  const [type, ...id] = item.split(':')
  const r = requestsFor(type as RequestRow['media_type'], id.join(':')).sort((a, b) => a.id - b.id)[0]
  const out = r && logCard(r, kind, detail)
  if (out) announce(threadOf(r, out.status), out.card)
}

/** Plex's page for a movie or show, at Plex's public address. */
async function plexPage(r: RequestRow) {
  const token = getSetting<string>('plexToken') // kept when the Admin signs in
  if (!token || r.media_type === 'audiobook') return
  const { plex, plexLibrary, PLEX_URL } = await import('./plex') // plex.ts leads back here through arr.ts and books.ts
  const [items, identity] = await Promise.all([
    plexLibrary(token, r.media_type === 'movie' ? 'movie' : 'show'),
    plex<{ MediaContainer: { machineIdentifier: string } }>(`${PLEX_URL}/identity`),
  ])
  const item = items.find((i) => i.Guid?.some((g) => g.id === `${r.media_type === 'movie' ? 'tmdb' : 'tvdb'}://${r.external_id}`))
  return item && publicUrl('plex', `/web/index.html#!/server/${identity.MediaContainer.machineIdentifier}/details?key=${encodeURIComponent(`/library/metadata/${item.ratingKey}`)}`)
}

/** Audiobookshelf's page for a book. */
async function bookPage(r: RequestRow) {
  const { owned } = await import('./books') // books.ts imports this file, so not at the top
  const item = (await owned(r.title.replace(/ \([^)]*\)$/, ''))).find((i) => i.title)
  return item && publicUrl('books', `/item/${item.id}`)
}

async function availableCard(r: RequestRow, at?: Date) {
  const book = r.media_type === 'audiobook'
  const page = await (book ? bookPage(r) : plexPage(r)).catch((e: Error) => void console.warn(`[discord] ${r.title}'s page: ${e.message}`))
  const app = book ? 'Audiobookshelf' : 'Plex'
  return card(r, 'ok', 'Available', `${book ? 'Ready to listen to' : 'Ready to watch'} in ${linked(app, page ?? undefined)}.`, [
    ['Requested by', r.username],
    ['Seasons', r.seasons ? seasonsOf(r).join(', ') : undefined],
  ], at)
}

/** Tells a Request's thread it's Available, with a link straight to the title in Plex or Audiobookshelf. */
export function tellDiscord(r: RequestRow) {
  availableCard(r).then((c) => announce(threadOf(r, 'Available'), c))
}

/**
 * Once, the first time the bot runs with forums: a thread for every Request there is, filled with what the Request Log
 * kept. One title at a time, so Discord's limits on opening threads only slow it down.
 */
export async function backfillRequests() {
  if (getSetting('bot:backfilled')) return
  const byTitle = new Map<string, RequestRow[]>()
  for (const r of listRequests().reverse()) byTitle.set(logItem(r.media_type, r.external_id), [...(byTitle.get(logItem(r.media_type, r.external_id)) ?? []), r])
  let failed = 0
  for (const [item, rs] of byTitle) {
    const first = rs[0]
    const events = logFor(item)
    const status: RequestStatus = rs.every((r) => r.status === 'available') ? 'Available' : events.some((e) => e.kind === 'grabbed') ? 'Downloading' : 'Requested'
    const thread = threadOf(first, status)
    // shortcut: a title whose backfill stopped half way keeps its half thread; delete it in Discord to have it redone.
    if (getThread(thread.key)) continue
    try {
      const seasons = [...new Set(rs.flatMap(seasonsOf))].sort((a, b) => a - b)
      await post(thread, card(first, 'info', titleOf(first), `Requested by ${people(rs.map((r) => `**${r.username}**`))}.`, [['Seasons', seasons.join(', ') || undefined]], new Date(utc(first.created_at))))
      for (const e of events) {
        const out = logCard(first, e.kind, JSON.parse(e.detail), new Date(utc(e.at)))
        if (out) await post(thread, out.card)
      }
      for (const r of rs.filter((r) => r.status === 'available')) await post(thread, await availableCard(r))
    } catch (e) {
      failed++
      console.warn(`[discord] backfill ${item}: ${(e as Error).message}`)
    }
  }
  if (!failed) setSetting('bot:backfilled', true)
}
