import { existsSync, readFileSync } from 'node:fs'
import { torrentFile } from '@/lib/requestlog'
import { currentUser } from '@/lib/session'

/** A saved .torrent by its hash, also of a removed Request. Admin only. */
export async function GET(_: Request, { params }: { params: Promise<{ hash: string }> }) {
  const user = await currentUser()
  const hash = (await params).hash.toLowerCase()
  // the hash becomes part of a file path, so only 40 hex characters
  if (!user?.is_admin || !/^[a-f0-9]{40}$/.test(hash) || !existsSync(torrentFile(hash))) return new Response('Not found', { status: 404 })
  return new Response(readFileSync(torrentFile(hash)), {
    headers: { 'Content-Type': 'application/x-bittorrent', 'Content-Disposition': `attachment; filename="${hash}.torrent"` },
  })
}
