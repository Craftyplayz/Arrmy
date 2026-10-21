'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS: [href: string, label: string, key: string][] = [
  ['/layouts/board', 'Home', '1'],
  ['/layouts/board/requests', 'Requests', '2'],
  ['/layouts/board/admin', 'Admin', '3'],
  ['/layouts/board/settings', 'Settings', '4'],
  ['/layouts/board/phone', 'Phone', '5'],
]

/** The mockup's tab links. A client component only because the layout can't see which page is open. */
export function Tabs() {
  const path = usePathname()
  return (
    <nav className="lb-tabs" aria-label="Board mockup">
      {TABS.map(([href, label, key]) => (
        <Link key={href} href={href} className={path === href ? 'lb-tab is-active' : 'lb-tab'} aria-current={path === href ? 'page' : undefined}>
          {label}<kbd>{key}</kbd>
        </Link>
      ))}
    </nav>
  )
}
