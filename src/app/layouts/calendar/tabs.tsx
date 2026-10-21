'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string][] = [
  ['/layouts/calendar', 'Home'],
  ['/layouts/calendar/requests', 'Requests'],
  ['/layouts/calendar/admin', 'Admin'],
  ['/layouts/calendar/settings', 'Settings'],
  ['/layouts/calendar/phone', 'Phone'],
]

/** The mockup's tab links as a segmented control. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="lc-tabs" aria-label="Calendar mockup">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'lc-tab is-active' : 'lc-tab'} aria-current={path === href ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
