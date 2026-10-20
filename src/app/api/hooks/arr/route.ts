import { requestDetails } from '@/lib/arr'
import { markAvailable, waitingRequests } from '@/lib/db'
import { tellDiscord } from '@/lib/notify'
import { hookToken, safeEqual, sessionSecret } from '@/lib/token'

/** Radarr and Sonarr call this after every import (the "Arrmy" webhook the Wiring adds). */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!safeEqual(token, hookToken(sessionSecret()))) return new Response('Forbidden', { status: 403 })

  const event = await request.json()
  const id = Number(event.movie?.tmdbId ?? event.series?.tvdbId)
  if (event.eventType !== 'Download' || !id) return new Response(null, { status: 204 })

  const waiting = waitingRequests(event.movie ? 'movie' : 'tv', id)
  const details = await requestDetails(waiting)
  for (const [i, r] of waiting.entries()) {
    if (details[i].status?.label !== 'Available') continue
    markAvailable(r.id)
    await tellDiscord(r).catch((e) => console.warn(`[discord] ${e.message}`))
  }
  return new Response(null, { status: 204 })
}
