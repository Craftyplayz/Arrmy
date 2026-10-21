import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { Avatar } from './bits'
import { Tabs } from './tabs'
import './chat.css'

/** The Chat feed mockup's chrome: a Discord-style rail with the channels on the left; each page is a channel. */
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-chat">
      <aside className="lc-rail">
        <Link href="/layouts/chat" className="lc-server"><img src="/icon.svg" alt="" width={22} height={22} />Arrmy</Link>
        <Tabs />
        <div className="lc-me">
          <Avatar name={user.username} />
          <span><b>{user.username}</b><small>{user.isAdmin ? 'Admin' : 'Requester'}</small></span>
          <p className="l-note">Mockup: nothing here works.</p>
        </div>
      </aside>
      <div className="lc-main">{children}</div>
    </div>
  )
}
