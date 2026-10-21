import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { Tabs } from './tabs'
import './mobile.css'

/** Mockup "Phone app everywhere": a phone-width column with the tabs at its bottom, on every screen size. Admin only, like /layouts. */
export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-mobile">
      <div className="lm-phone">
        <div className="lm-top">
          <Link href="/layouts/mobile" className="lm-brand">Arrmy</Link>
          <span className="lm-who">
            {user.username}
            <i className="lm-avatar" style={{ background: `hsl(${user.avatarHue} 55% 45%)` }}>{user.username[0]}</i>
          </span>
        </div>
        <p className="lm-pull">↓ Pull down to refresh</p>
        <div className="lm-screen">{children}</div>
        <Tabs />
      </div>
      <p className="l-note">Mockup: nothing here works.</p>
    </div>
  )
}
