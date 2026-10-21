'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string, icon: string][] = [
  ['/layouts/mobile', 'Home', 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  ['/layouts/mobile/requests', 'Requests', 'M3 13l2-8h14l2 8v6H3zM3 13h5l2 3h4l2-3h5'],
  ['/layouts/mobile/admin', 'Admin', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4'],
  ['/layouts/mobile/settings', 'Settings', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1'],
  ['/layouts/mobile/phone', 'Phone', 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM10 18h4'],
]

/** The bottom tab bar: the mockup's real links. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="lm-tabs" aria-label="Phone app mockup">
      {TABS.map(([href, label, d]) => (
        <Link key={href} href={href} className={path === href ? 'lm-tab is-active' : 'lm-tab'} aria-current={path === href ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
          {label}
        </Link>
      ))}
    </nav>
  )
}
