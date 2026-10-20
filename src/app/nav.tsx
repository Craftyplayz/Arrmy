'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** The header links. A client component only because the layout can't see which page is open. */
export function Nav({ links }: { links: [href: string, label: string][] }) {
  const path = usePathname()
  return (
    <nav className="sh-nav" aria-label="Main">
      <ul className="sh-list">
        {links.map(([href, label]) => (
          <li key={href} className={path === href ? 'sh-item is-active' : 'sh-item'}>
            <Link className="sh-top" href={href} aria-current={path === href ? 'page' : undefined}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
