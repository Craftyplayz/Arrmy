import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { Tabs } from './tabs'
import './split.css'

/** Mockup: Split pane. The icon rail every page shares; each page brings its own list pane and detail pane. */
export default async function SplitLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-split">
      <aside className="rail">
        <Link href="/layouts/split" className="brand">
          <img src="/icon.svg" alt="" width={28} height={28} />
          Arrmy
        </Link>
        <Tabs />
        <div className="rail-foot">
          <span className="avatar" style={{ background: `hsl(${user.avatarHue} 50% 45%)` }} title={user.username}>{user.username[0]}</span>
          <small>{user.username}</small>
          <p className="l-note">Mockup: nothing here works.</p>
        </div>
      </aside>
      {children}
    </div>
  )
}
