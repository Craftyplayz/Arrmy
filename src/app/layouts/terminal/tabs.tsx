'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string][] = [
  ['/layouts/terminal', 'home'],
  ['/layouts/terminal/requests', 'requests'],
  ['/layouts/terminal/admin', 'admin'],
  ['/layouts/terminal/settings', 'settings'],
  ['/layouts/terminal/phone', 'phone'],
]

/** The status-line tabs, `[1] home` … `[5] phone`. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="lt-tabs" aria-label="Terminal mockup">
      {TABS.map(([href, label], i) => (
        <Link key={href} href={href} className={path === href ? 'lt-tab is-active' : 'lt-tab'} aria-current={path === href ? 'page' : undefined}>
          <b>[{i + 1}]</b> {label}
        </Link>
      ))}
    </nav>
  )
}
