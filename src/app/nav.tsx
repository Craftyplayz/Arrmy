'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** The sidebar links. A client component only because the layout can't see which page is open. */
export function Nav({ links }: { links: [href: string, label: string, icon: string][] }) {
  const path = usePathname()
  // a Request's own page still counts as Requests
  const current = (href: string) => (href === '/' ? path === '/' : path.startsWith(href))
  return (
    <nav className="side-nav" aria-label="Main">
      <ul className="side-list">
        {links.map(([href, label, icon]) => (
          <li key={href}>
            {/* fully prefetched, so a click shows the page at once instead of Loading... */}
            <Link href={href} prefetch aria-current={current(href) ? 'page' : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={icon} />
              </svg>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
