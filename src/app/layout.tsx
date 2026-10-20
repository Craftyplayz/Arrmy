import type { Metadata } from 'next'
import Link from 'next/link'
import { currentUser } from '@/lib/session'
import { signOut } from './actions'
import './globals.css'

export const metadata: Metadata = { title: 'Arrmy', description: 'Request movies and TV shows for the family Plex server' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  return (
    <html lang="en">
      <body>
        {user && (
          <header className="bar">
            <Link href="/" className="brand">
              Arrmy
            </Link>
            <nav>
              <Link href="/">Search</Link>
              <Link href="/requests">Requests</Link>
              {user.is_admin ? <Link href="/admin">Admin</Link> : null}
              {user.is_admin ? <Link href="/settings">Settings</Link> : null}
            </nav>
            <form action={signOut}>
              <span className="muted">{user.username}</span>
              <button className="link">Sign out</button>
            </form>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  )
}
