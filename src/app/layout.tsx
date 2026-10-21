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
  ['/layouts', 'Layouts', true],
]

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  const version = process.env.ARRMY_VERSION // baked into the image: 1.1.0-rc.30, or `latest`
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
          {version && (
            <p className="sf-meta">
              <a href={`https://github.com/Craftyplayz/Arrmy/releases/${version === 'latest' ? '' : `tag/v${version}`}`} target="_blank" rel="noreferrer">
                Arrmy {version === 'latest' ? 'latest build' : `v${version}`}
              </a>
            </p>
          )}
        </footer>
      </body>
    </html>
  )
}
