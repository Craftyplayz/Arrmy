'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string][] = [
  ['/layouts/magazine', 'Home'],
  ['/layouts/magazine/requests', 'Requests'],
  ['/layouts/magazine/admin', 'Admin'],
  ['/layouts/magazine/settings', 'Settings'],
  ['/layouts/magazine/phone', 'Phone'],
]

/** The section nav under the wordmark. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="lm-nav" aria-label="Magazine mockup">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'lm-tab is-active' : 'lm-tab'} aria-current={path === href ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
