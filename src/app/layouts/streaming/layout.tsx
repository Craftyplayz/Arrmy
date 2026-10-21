import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { poster, user } from '../data'
import { Tabs } from './tabs'
import './streaming.css'

/** The Streaming mockup's chrome: a translucent top bar that stays put while the page scrolls under it. */
export default async function StreamingLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-streaming">
      <header className="st-top">
        <span className="st-brand"><i />Arrmy</span>
        <Tabs />
        <input className="st-search" type="search" placeholder="Search movies, TV shows, audiobooks…" aria-label="Search" />
        <span className="st-user"><i style={poster(user.avatarHue)} />{user.username}</span>
      </header>
      {children}
      <p className="l-note">Mockup: nothing here works.</p>
    </div>
  )
}
