'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string][] = [
  ['/layouts/tiles', 'Home'],
  ['/layouts/tiles/requests', 'Requests'],
  ['/layouts/tiles/admin', 'Admin'],
  ['/layouts/tiles/settings', 'Settings'],
  ['/layouts/tiles/phone', 'Phone'],
]

/** The tab pills. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="t-tabs" aria-label="Tiles mockup">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'tile t-tab is-active' : 'tile t-tab'} aria-current={path === href ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
