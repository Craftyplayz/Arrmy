import { drawLogo } from '@/lib/logo'

const APP_BG = [0x1e, 0x23, 0x29] // --bg, so the icon blends into the app; full-bleed, so the same PNG serves as the maskable icon
const SIZES = [180, 192, 512] // apple-touch-icon, the manifest's two

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size)
  if (!SIZES.includes(size)) return new Response('Not found', { status: 404 })
  return new Response(Buffer.from(drawLogo(size, APP_BG)), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
  })
}
