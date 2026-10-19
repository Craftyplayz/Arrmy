import { cookies } from 'next/headers'
import { upsertUser } from '@/lib/db'
import { pinToken, plexAccount, wirePlex } from '@/lib/plex'
import { PIN_COOKIE, startSession } from '@/lib/session'

const go = (path: string) => new Response(null, { status: 303, headers: { Location: path } })

/** Plex sends the browser here after "Sign in with Plex". */
export async function GET(request: Request) {
  const jar = await cookies()
  const pinId = Number(jar.get(PIN_COOKIE)?.value)
  jar.delete(PIN_COOKIE)
  try {
    const token = pinId ? await pinToken(pinId) : null
    if (!token) return go('/login?error=failed')
    const account = await plexAccount(token)
    if (!account.access) return go('/login?error=no-access')

    upsertUser({ id: account.id, username: account.username, isAdmin: account.access === 'admin' })
    if (account.access === 'admin') wirePlex(token).catch((e) => console.warn(`[wire] Plex: ${e.message}`))
    await startSession(account.id, request.headers.get('x-forwarded-proto')?.startsWith('https') ?? false)
    return go('/')
  } catch (e) {
    console.error('[auth]', e)
    return go('/login?error=failed')
  }
}
