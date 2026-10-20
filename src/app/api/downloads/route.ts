import { liveDownloads } from '@/lib/admin'
import { currentUser } from '@/lib/session'

/** What's downloading, live from qBittorrent, for the Admin view's Downloading list. Only the Admin sees it. */
export async function GET() {
  const user = await currentUser()
  if (!user?.is_admin) return new Response('Not found', { status: 404 })
  try {
    return Response.json(await liveDownloads())
  } catch (e) {
    console.error(e)
    return new Response("qBittorrent isn't responding", { status: 502 })
  }
}
