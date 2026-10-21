import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { Tabs } from './tabs'
import './magazine.css'

/** The Magazine mockup's chrome: a newspaper masthead with a date line, the wordmark and a section nav. */
export default async function MagazineLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-magazine">
      <header className="lm-masthead">
        <p className="lm-ears">
          <span>Wednesday 21 October 2026</span>
          <span>Signed in as {user.username}{user.isAdmin && ', Admin'}</span>
        </p>
        <Link href="/layouts/magazine" className="lm-wordmark">Arrmy</Link>
        <p className="lm-tagline">Movies, TV Shows and Audiobooks for the family Plex</p>
        <Tabs />
        <p className="l-note">Mockup: nothing here works.</p>
      </header>
      <div className="lm-body">{children}</div>
    </div>
  )
}
