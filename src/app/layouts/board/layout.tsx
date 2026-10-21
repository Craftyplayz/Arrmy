import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { Avatar } from './bits'
import { Tabs } from './tabs'
import './board.css'

/** The Board mockup's own chrome: a slim top bar with brand, tabs, search and the signed-in avatar. */
export default async function BoardLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-board">
      <header className="lb-top">
        <Link href="/layouts/board" className="lb-brand"><i />Arrmy</Link>
        <Tabs />
        <label className="lb-search"><input placeholder="Search or jump to…" /><kbd>/</kbd></label>
        <p className="l-note">Mockup: nothing here works.</p>
        <Avatar name={user.username} />
      </header>
      <div className="lb-body">{children}</div>
    </div>
  )
}
