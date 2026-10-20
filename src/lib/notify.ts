import type { RequestRow } from './db'
import { seasonLabel } from './status'

/** Posts to the Discord channel. Without DISCORD_WEBHOOK_URL there's nothing to do. `ping` = Discord user ids to @mention. */
async function post(content: string, ping: string[] = []) {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // allowed_mentions: only the ids asked for get pinged, so a title can't ping @everyone
    body: JSON.stringify({ content, allowed_mentions: { parse: [], users: ping } }),
  })
  if (!res.ok) throw new Error(`webhook → ${res.status}`)
}

/** Tells the Discord channel a Request is Available. */
export async function tellDiscord(r: RequestRow) {
  const what = `**${r.title}**${r.year ? ` (${r.year})` : ''}${r.seasons ? `, ${seasonLabel(JSON.parse(r.seasons))}` : ''}`
  const ready = r.media_type === 'audiobook' ? 'ready to listen to' : 'ready to watch'
  await post(`${what} is ${ready}. Requested by ${r.username}.`)
}

/** Tells the Discord channel something needs the Admin, @mentioning them when DISCORD_ADMIN_ID is set. */
export async function pingAdmin(text: string) {
  const admin = process.env.DISCORD_ADMIN_ID
  await post(admin ? `<@${admin}> ${text}` : text, admin ? [admin] : [])
}
