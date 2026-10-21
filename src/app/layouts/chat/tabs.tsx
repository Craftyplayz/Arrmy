'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { admin } from '../data'

const TABS: [href: string, label: string][] = [
  ['/layouts/chat', 'home'],
  ['/layouts/chat/requests', 'requests'],
  ['/layouts/chat/admin', 'admin'],
  ['/layouts/chat/settings', 'settings'],
  ['/layouts/chat/phone', 'phone'],
]

/** The channel list: each channel is a tab. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="lc-chans" aria-label="Chat feed mockup">
      <p className="lc-cat">Channels</p>
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'lc-chan is-active' : 'lc-chan'} aria-current={path === href ? 'page' : undefined}>
          <span className="lc-hash">#</span>{label}
          {label === 'admin' && <span className="lc-n">{admin.problems.length}</span>}
        </Link>
      ))}
    </nav>
  )
}
