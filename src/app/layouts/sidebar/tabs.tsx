'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const BASE = '/layouts/sidebar'

/** Each nav item: where it goes, its label, and a 24x24 stroke icon path. */
const LINKS: [href: string, label: string, icon: string][] = [
  [BASE, 'Home', 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z'],
  [`${BASE}/requests`, 'Requests', 'M4 6h16M4 12h16M4 18h10'],
  [`${BASE}/admin`, 'Admin', 'M3 12h4l3-8 4 16 3-8h4'],
  [`${BASE}/settings`, 'Settings', 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1'],
  [`${BASE}/phone`, 'Phone', 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2'],
]

/** The sidebar links. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="nav" aria-label="Sidebar">
      {LINKS.map(([href, label, icon]) => {
        const active = href === BASE ? path === href : path.startsWith(href)
        return (
          <Link key={href} href={href} className={active ? 'is-active' : undefined} aria-current={active ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={icon} />
            </svg>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
