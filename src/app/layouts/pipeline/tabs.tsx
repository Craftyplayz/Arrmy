'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string][] = [
  ['/layouts/pipeline', 'Home'],
  ['/layouts/pipeline/requests', 'Requests'],
  ['/layouts/pipeline/admin', 'Admin'],
  ['/layouts/pipeline/settings', 'Settings'],
  ['/layouts/pipeline/phone', 'Phone'],
]

/** The mockup's tab links. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="lp-tabs" aria-label="Pipeline mockup">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'lp-tab is-active' : 'lp-tab'} aria-current={path === href ? 'page' : undefined}>{label}</Link>
      ))}
    </nav>
  )
}
