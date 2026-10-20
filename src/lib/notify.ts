// Request events as cards in #requests (embeds.ts has the look).
import type { RequestRow } from './db'
import { announce, publicUrl } from './discord'
import { COLOUR, embed, mediaUrl } from './embeds'

/** What a card needs to know about a Request, before or after it's saved. `slug` is Sonarr's, for its page. */
export type RequestItem = Pick<RequestRow, 'media_type' | 'external_id' | 'title' | 'year' | 'poster'> & { slug?: string }

/** "Dune (2021)" */
export const titleOf = (r: Pick<RequestRow, 'title' | 'year'>) => `${r.title}${r.year ? ` (${r.year})` : ''}`

/** The service that handles a Request, with its page on this server. */
function service(r: RequestItem) {
  if (r.media_type === 'movie') return { app: 'Radarr', appUrl: publicUrl('radarr', `/movie/${r.external_id}`) }
  if (r.media_type === 'tv') return { app: 'Sonarr', appUrl: publicUrl('sonarr', r.slug ? `/series/${r.slug}` : '') }
  return { app: 'LazyLibrarian' }
}

/** A card in #requests about one Request: its poster, its page on the web, and what happened. */
export function tellRequest(r: RequestItem, colour: keyof typeof COLOUR, description: string, fields: [string, string | undefined][] = []) {
  announce('requests', embed({ colour, ...service(r), title: titleOf(r), url: mediaUrl(r.media_type, r.external_id), art: r.poster, description, fields }))
}

/** Tells #requests a Request is Available. */
export function tellDiscord(r: RequestRow) {
  const book = r.media_type === 'audiobook'
  announce(
    'requests',
    embed({
      colour: 'ok',
      app: book ? 'Audiobookshelf' : 'Plex',
      appUrl: book ? publicUrl('books') : publicUrl('plex', '/web'),
      title: titleOf(r),
      url: mediaUrl(r.media_type, r.external_id),
      art: r.poster,
      description: book ? 'Available: ready to listen to in Audiobookshelf.' : 'Available: ready to watch in Plex.',
      fields: [
        ['Requested by', r.username],
        ['Seasons', r.seasons ? (JSON.parse(r.seasons) as number[]).join(', ') : undefined],
      ],
    }),
  )
}
