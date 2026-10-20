import { existsSync, readFileSync } from 'node:fs'
import { getRequest, logFor, logItem } from '@/lib/db'
import { torrentFile } from '@/lib/requestlog'
import { currentUser } from '@/lib/session'

/** A grabbed release's .torrent, saved when it was grabbed. Admin only, and only a release this Request's log lists. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser()
  const r = getRequest(Number((await params).id))
  const hash = new URL(request.url).searchParams.get('hash') ?? ''
  const listed = r && logFor(logItem(r.media_type, r.external_id)).some((e) => e.kind === 'grabbed' && JSON.parse(e.detail).downloadId === hash)
  if (!user?.is_admin || !listed || !/^[a-f0-9]{40}$/.test(hash) || !existsSync(torrentFile(hash))) return new Response('Not found', { status: 404 })
  return new Response(readFileSync(torrentFile(hash)), {
    headers: { 'Content-Type': 'application/x-bittorrent', 'Content-Disposition': `attachment; filename="${hash}.torrent"` },
  })
}
