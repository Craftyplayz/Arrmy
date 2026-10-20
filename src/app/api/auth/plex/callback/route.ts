import { cookies } from 'next/headers'
import { setSetting, upsertUser } from '@/lib/db'
import { announce } from '@/lib/discord'
import { embed } from '@/lib/embeds'
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
    if (account.access === 'admin') {
      wirePlex(token).catch((e) => console.warn(`[wire] Plex: ${e.message}`))
      // Kept so the Discord bot can see who's watching (/status/sessions) and who the server is shared with.
      setSetting('plexToken', token)
    }
    const role = account.access === 'admin' ? 'the Admin' : 'a Requester'
    announce('activity', embed({ colour: 'info', app: 'Arrmy', title: `${account.username} signed in`, description: `Signed in to Arrmy as ${role}.`, art: account.avatar }))
    await startSession(account.id, request.headers.get('x-forwarded-proto')?.startsWith('https') ?? false)
    return go('/')
  } catch (e) {
    console.error('[auth]', e)
    return go('/login?error=failed')
  }
}
