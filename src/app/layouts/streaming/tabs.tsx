'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string][] = [
  ['/layouts/streaming', 'Home'],
  ['/layouts/streaming/requests', 'Requests'],
  ['/layouts/streaming/admin', 'Admin'],
  ['/layouts/streaming/settings', 'Settings'],
  ['/layouts/streaming/phone', 'Phone'],
]

/** The mockup's tab links. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="st-tabs" aria-label="Streaming mockup">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'is-active' : undefined} aria-current={path === href ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
