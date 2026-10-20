import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { currentUser } from '@/lib/session'
import { signOut } from './actions'
import { Nav } from './nav'
import './globals.css'
import './components.css'
import './pieces.css'

export const metadata: Metadata = {
  title: { default: 'Arrmy', template: '%s · Arrmy' },
  description: 'Request movies, TV shows and audiobooks for the family Plex server',
}
export const viewport: Viewport = { themeColor: '#202020', colorScheme: 'dark' }

/** The header links: the only list of them. The last field marks Admin-only pages. */
const NAV: [href: string, label: string, adminOnly: boolean][] = [
  ['/', 'Search', false],
  ['/requests', 'Requests', false],
  ['/admin', 'Admin', true],
  ['/settings', 'Settings', true],
]

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  return (
    <html lang="en-GB">
      <body>
        {user && (
          <header className="site-header">
            <div className="sh-inner">
              <Link href="/" className="sh-brand">
                <img src="/icon.svg" alt="" width={24} height={24} />
                Arrmy
              </Link>
              <Nav links={NAV.filter(([, , adminOnly]) => !adminOnly || user.is_admin).map(([href, label]) => [href, label])} />
              <form action={signOut} className="sh-user">
                <span>{user.username}</span>
                <button className="btn small">Sign out</button>
              </form>
            </div>
          </header>
        )}
        <main className="page ar" id="main">
          {children}
        </main>
        <footer className="site-footer">
          <p className="sf-meta">Movie and show details from TMDB and TheTVDB, book details from OpenLibrary.</p>
        </footer>
      </body>
    </html>
  )
}
