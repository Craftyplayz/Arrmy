import { getRequest } from '@/lib/db'
import { episodeRows } from '@/lib/episodes'
import { currentUser } from '@/lib/session'

/** A TV Request's episodes, file by file, for its drawer on the Requests page. Only the requester and the Admin see it. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser()
  const request = getRequest(Number((await params).id))
  if (!user || request?.media_type !== 'tv' || (request.user_id !== user.id && !user.is_admin))
    return new Response('Not found', { status: 404 })
  try {
    return Response.json(await episodeRows(request))
  } catch (e) {
    console.error(e)
    return new Response("Sonarr isn't responding", { status: 502 })
  }
}
