import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { poster, user } from '../data'
import { Tabs } from './tabs'
import './shelf.css'

/** The Shelf mockup's chrome: a brass plaque, wooden tabs and a search slot, all standing on a top plank. */
export default async function ShelfLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-shelf">
      <header className="top">
        <span className="brand">Arrmy<small>the family shelf</small></span>
        <Tabs />
        <div className="slot">
          <input className="field" type="search" placeholder="Search the shelves…" aria-label="Search" />
          <span className="who"><i className="avatar" style={poster(user.avatarHue)}>{user.username[0]}</i>{user.username}</span>
        </div>
      </header>
      <div className="plank" />
      <div className="body">{children}</div>
      <p className="l-note">Mockup: nothing here works.</p>
    </div>
  )
}
