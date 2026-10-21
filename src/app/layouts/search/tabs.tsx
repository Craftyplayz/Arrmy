'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string][] = [
  ['/layouts/search', 'Home'],
  ['/layouts/search/requests', 'Requests'],
  ['/layouts/search/admin', 'Admin'],
  ['/layouts/search/settings', 'Settings'],
  ['/layouts/search/phone', 'Phone'],
]

/** The mockup's tab links. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="ls-tabs" aria-label="Search first mockup">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'ls-tab is-active' : 'ls-tab'} aria-current={path === href ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
