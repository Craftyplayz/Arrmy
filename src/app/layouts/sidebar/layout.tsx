import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { Tabs } from './tabs'
import './sidebar.css'

/** Mockup B: the chrome every page in this layout shares. The signed-in Requester is the fake one from data.ts. */
export default async function SidebarLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-sidebar">
      <aside className="side">
        <div className="brand">
          <img src="/icon.svg" alt="" width={26} height={26} />
          Arrmy
        </div>
        <Tabs />
        <p className="l-note">Mockup: nothing here works.</p>
        <div className="side-user">
          <span className="avatar" style={{ background: `hsl(${user.avatarHue} 50% 45%)` }}>{user.username[0]}</span>
          <span>
            <b>{user.username}</b>
            <small>{user.isAdmin ? 'Admin' : 'Requester'}</small>
          </span>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <input className="field search" type="search" placeholder="Search movies, TV shows and audiobooks…" defaultValue="the" />
          <button type="button" className="b">Refresh</button>
          <button type="button" className="b">Open Plex</button>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}
