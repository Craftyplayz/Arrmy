import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { admin, requests, user } from '../data'
import { Tabs } from './tabs'
import './palette.css'

const speed = admin.downloads.reduce((n, d) => n + d.speedMbs, 0).toFixed(1)

/** The Command palette mockup's chrome: a brand glyph, the glow, and a status bar that holds the tab links. */
export default async function PaletteLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-palette">
      <div className="pal-glow" aria-hidden="true" />
      <Link href="/layouts/palette" className="pal-brand"><i>A</i>Arrmy</Link>
      <p className="l-note">Mockup: nothing here works.</p>
      <div className="pal-stage">{children}</div>
      <footer className="pal-status">
        <span>{requests.length} Requests</span>
        <span>{admin.downloads.length} downloading at {speed} MB/s</span>
        <span className="is-bad">{admin.counts.stuck} stuck</span>
        <Tabs />
        <span className="pal-me"><i style={{ background: `hsl(${user.avatarHue} 55% 45%)` }} />{user.username}</span>
      </footer>
    </div>
  )
}
