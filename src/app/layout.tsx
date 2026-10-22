import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { currentUser } from '@/lib/session'
import { signOut } from './actions'
import { Nav } from './nav'
import { ThemePicker } from './theme-picker'
import { getSetting } from '@/lib/db'
import { THEMES, themeOf } from '@/lib/themes'
import './globals.css'
import './themes.css'
import './components.css'
import './pieces.css'

export const metadata: Metadata = {
  title: { default: 'Arrmy', template: '%s · Arrmy' },
  description: 'Request movies, TV shows and audiobooks for the family Plex server',
  appleWebApp: { capable: true, title: 'Arrmy', statusBarStyle: 'black-translucent' },
  icons: { apple: '/pwa-icon/180' },
}

/** This person's saved theme, or the default. */
async function themeNow() {
  const user = await currentUser()
  return themeOf(user && getSetting(`theme:${user.id}`)) ?? THEMES[0]
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await themeNow()
  // cover: full screen under the notch when installed as an app
  return { themeColor: theme.color, colorScheme: theme.light ? 'light' : 'dark', viewportFit: 'cover' }
}

/** The sidebar links: the only list of them. `adminOnly` marks Admin-only pages; `icon` is a 24x24 stroke path. */
const NAV: [href: string, label: string, adminOnly: boolean, icon: string][] = [
  ['/', 'Search', false, 'M11 4a7 7 0 1 0 0 14 7 7 0 1 0 0-14zM20 20l-3.5-3.5'],
  ['/discover', 'Discover', false, 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM15.5 8.5l-2 5-5 2 2-5z'],
  ['/requests', 'Requests', false, 'M4 6h16M4 12h16M4 18h10'],
  ['/admin', 'Admin', true, 'M3 12h4l3-8 4 16 3-8h4'],
]

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  const theme = await themeNow()
  const version = process.env.ARRMY_VERSION // baked into the image: 1.1.0-rc.30, or `latest`
  return (
    <html lang="en-GB" data-theme={theme.id}>
      <body className="shell">
        {user && (
          <aside className="side">
            <Link href="/" className="side-brand">
              <img src="/icon.svg" alt="" width={26} height={26} />
              Arrmy
            </Link>
            <Nav links={NAV.filter(([, , adminOnly]) => !adminOnly || user.is_admin).map(([href, label, , icon]) => [href, label, icon])} />
            <ThemePicker themes={THEMES} current={theme.id} />
            <form action={signOut} className="side-user">
              <span className="side-avatar" aria-hidden="true">
                {user.username[0]?.toUpperCase()}
              </span>
              <span className="side-who">
                <b>{user.username}</b>
                <small>{user.is_admin ? 'Admin' : 'Requester'}</small>
              </span>
              <button className="btn small">Sign out</button>
            </form>
          </aside>
        )}
        <div className="shell-main">
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
        </div>
      </body>
    </html>
  )
}
