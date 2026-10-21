'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string][] = [
  ['/layouts/wizard', 'Home'],
  ['/layouts/wizard/requests', 'Requests'],
  ['/layouts/wizard/admin', 'Admin'],
  ['/layouts/wizard/settings', 'Settings'],
  ['/layouts/wizard/phone', 'Phone'],
]

/** The mockup's tab links. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="wz-tabs" aria-label="One thing at a time mockup">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'wz-tab is-active' : 'wz-tab'} aria-current={path === href ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
