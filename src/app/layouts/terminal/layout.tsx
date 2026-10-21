import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { Hints } from './bits'
import { Tabs } from './tabs'
import './terminal.css'

const KEYS: [string, string][] = [['/', 'search'], ['r', 'request'], ['x', 'remove'], ['j/k', 'move'], ['1–5', 'tabs'], ['?', 'help']]

/** Mockup "Terminal": a status line on top, key hints along the bottom, everything monospace. Admin only, like /layouts. */
export default async function TerminalLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-terminal">
      <header className="lt-top">
        <span className="lt-brand">arrmy v1.1</span>
        <span className="lt-sep">│</span>
        <Tabs />
        <span className="lt-sep">│</span>
        <span className="lt-who">{user.username.toLowerCase()}@plex</span>
      </header>
      <div className="lt-body">{children}</div>
      <footer className="lt-bottom">
        <Hints className="lt-keys" keys={KEYS} />
        <p className="l-note">Mockup: nothing here works.</p>
      </footer>
    </div>
  )
}
