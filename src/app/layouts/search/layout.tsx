import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { Tabs } from './tabs'
import './search.css'

/** Mockup C, "Search first": its own light chrome around the fake pages. Admin only, like /layouts. */
export default async function SearchLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-search">
      <header className="ls-top">
        <Link href="/layouts/search" className="ls-brand">Arrmy</Link>
        <Tabs />
        <span className="ls-who">{user.username}</span>
      </header>
      <p className="l-note">Mockup: nothing here works.</p>
      {children}
    </div>
  )
}
