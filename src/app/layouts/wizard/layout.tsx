import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { Tabs } from './tabs'
import './wizard.css'

/** Mockup "One thing at a time": one big question per screen. Admin only, like /layouts. */
export default async function WizardLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-wizard">
      <header className="wz-top">
        <Link href="/layouts/wizard" className="wz-brand"><i />Arrmy</Link>
        <div className="wz-top-right">
          <Tabs />
          <span className="wz-who">Signed in as <b>{user.username}</b></span>
        </div>
      </header>
      <p className="l-note">Mockup: nothing here works.</p>
      {children}
    </div>
  )
}
