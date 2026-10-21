'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string][] = [
  ['/layouts/shelf', 'Home'],
  ['/layouts/shelf/requests', 'Requests'],
  ['/layouts/shelf/admin', 'Admin'],
  ['/layouts/shelf/settings', 'Settings'],
  ['/layouts/shelf/phone', 'Phone'],
]

/** The wooden tabs. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="tabs" aria-label="Shelf mockup">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'tab is-active' : 'tab'} aria-current={path === href ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
