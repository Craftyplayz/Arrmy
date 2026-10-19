import { requestStatuses } from '@/lib/arr'
import { markAvailable, waitingRequests, type RequestRow } from '@/lib/db'
import { seasonLabel } from '@/lib/status'
import { hookToken, safeEqual, sessionSecret } from '@/lib/token'

/** Radarr and Sonarr call this after every import (the "Arrmy" webhook the Wiring adds). */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!safeEqual(token, hookToken(sessionSecret()))) return new Response('Forbidden', { status: 403 })

  const event = await request.json()
  const id = Number(event.movie?.tmdbId ?? event.series?.tvdbId)
  if (event.eventType !== 'Download' || !id) return new Response(null, { status: 204 })

  const waiting = waitingRequests(event.movie ? 'movie' : 'tv', id)
  const statuses = await requestStatuses(waiting)
  for (const [i, r] of waiting.entries()) {
    if (statuses[i]?.label !== 'Available') continue
    markAvailable(r.id)
    await tellDiscord(r).catch((e) => console.warn(`[discord] ${e.message}`))
  }
  return new Response(null, { status: 204 })
}

async function tellDiscord(r: RequestRow) {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return
  const what = `**${r.title}**${r.year ? ` (${r.year})` : ''}${r.seasons ? `, ${seasonLabel(JSON.parse(r.seasons))}` : ''}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // allowed_mentions: a title can't ping @everyone
    body: JSON.stringify({ content: `${what} is ready to watch. Requested by ${r.username}.`, allowed_mentions: { parse: [] } }),
  })
  if (!res.ok) throw new Error(`webhook → ${res.status}`)
}
