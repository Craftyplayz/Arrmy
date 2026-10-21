'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string, key: string][] = [
  ['/layouts/palette', 'Home', '⌘1'],
  ['/layouts/palette/requests', 'Requests', '⌘2'],
  ['/layouts/palette/admin', 'Admin', '⌘3'],
  ['/layouts/palette/settings', 'Settings', '⌘4'],
  ['/layouts/palette/phone', 'Phone', '⌘5'],
]

/** The tab links in the status bar. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="pal-tabs" aria-label="Command palette mockup">
      {TABS.map(([href, label, key]) => (
        <Link key={href} href={href} className={path === href ? 'pal-tab is-active' : 'pal-tab'} aria-current={path === href ? 'page' : undefined}>
          <kbd>{key}</kbd>{label}
        </Link>
      ))}
    </nav>
  )
}
