import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { Avatar, Magnifier } from './bits'
import { Tabs } from './tabs'
import './tiles.css'

export default async function TilesLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-tiles">
      <div className="t-chrome">
        <Link href="/layouts/tiles" className="tile t-brand"><img src="/icon.svg" alt="" width={28} height={28} />Arrmy</Link>
        <Tabs />
        <div className="tile t-search"><Magnifier />Search movies, TV shows and audiobooks</div>
        <div className="tile t-me"><Avatar name={user.username} big /><span>{user.username}<small>{user.isAdmin ? 'Admin' : 'Requester'}</small></span></div>
      </div>
      <p className="l-note">Mockup: nothing here works.</p>
      {children}
    </div>
  )
}
