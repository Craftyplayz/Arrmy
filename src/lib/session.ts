import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUser } from './db'
import { createToken, readToken, sessionSecret } from './token'

export const SESSION_COOKIE = 'arrmy_session'
/** Ties a Plex sign-in to the browser that started it, so a forwarded callback link can't log someone in. */
export const PIN_COOKIE = 'arrmy_pin'
const TTL_MS = 30 * 24 * 60 * 60 * 1000

// shortcut: Plex access is only checked at sign-in, so someone un-shared keeps access until the 30-day cookie expires; re-check plex.tv per visit if that matters.
export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value // first, so Next knows the page is dynamic
  const id = readToken(sessionSecret(), token)
  return id === null ? undefined : getUser(id)
}

export async function requireUser() {
  const user = await currentUser()
  if (!user) redirect('/login')
  return user
}

export async function startSession(userId: number, secure: boolean) {
  ;(await cookies()).set(SESSION_COOKIE, createToken(sessionSecret(), userId, TTL_MS), {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: TTL_MS / 1000,
    path: '/',
  })
}
