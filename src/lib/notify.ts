import type { RequestRow } from './db'
import { seasonLabel } from './status'

/** Tells the Discord channel a Request is Available. Without DISCORD_WEBHOOK_URL there's nothing to do. */
export async function tellDiscord(r: RequestRow) {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return
  const what = `**${r.title}**${r.year ? ` (${r.year})` : ''}${r.seasons ? `, ${seasonLabel(JSON.parse(r.seasons))}` : ''}`
  const ready = r.media_type === 'audiobook' ? 'ready to listen to' : 'ready to watch'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // allowed_mentions: a title can't ping @everyone
    body: JSON.stringify({ content: `${what} is ${ready}. Requested by ${r.username}.`, allowed_mentions: { parse: [] } }),
  })
  if (!res.ok) throw new Error(`webhook → ${res.status}`)
}
