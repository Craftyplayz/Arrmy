import type { RequestRow } from './db'
import { announce, publicUrl } from './discord'
import { linked } from './botrules'
import { seasonLabel } from './status'

/** "**Dune** (2021), Season 1" as Requests read in Discord. */
export const requestTitle = (r: Pick<RequestRow, 'title' | 'year' | 'seasons'>) =>
  `**${r.title}**${r.year ? ` (${r.year})` : ''}${r.seasons ? `, ${seasonLabel(JSON.parse(r.seasons))}` : ''}`

/** Tells #requests a Request is Available. */
export function tellDiscord(r: RequestRow) {
  const ready = r.media_type === 'audiobook' ? 'ready to listen to' : 'ready to watch'
  const where = r.media_type === 'audiobook' ? linked('Audiobookshelf', publicUrl('books')) : linked('Plex', publicUrl('plex', '/web'))
  announce('requests', `🎉 ${requestTitle(r)} is ${ready} in ${where}. Requested by ${r.username}.`)
}
