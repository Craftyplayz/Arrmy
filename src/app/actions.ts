'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { addMovie, addSeries, posterOf } from '@/lib/arr'
import { addRequest, hasRequest } from '@/lib/db'
import { createPin } from '@/lib/plex'
import { PIN_COOKIE, requireUser, SESSION_COOKIE } from '@/lib/session'

const positiveInt = (value: FormDataEntryValue | null) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Not a valid id: ${value}`)
  return n
}

export async function signIn() {
  const h = await headers()
  const proto = h.get('x-forwarded-proto')?.split(',')[0] ?? 'http'
  const { pinId, authUrl } = await createPin(`${proto}://${h.get('x-forwarded-host') ?? h.get('host')}/api/auth/plex/callback`)
  ;(await cookies()).set(PIN_COOKIE, String(pinId), { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' })
  redirect(authUrl)
}

export async function signOut() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect('/login')
}

export async function requestMovie(form: FormData) {
  const user = await requireUser()
  const tmdbId = positiveInt(form.get('id'))
  const movie = await addMovie(tmdbId)
  if (!hasRequest(user.id, 'movie', tmdbId)) {
    addRequest({ userId: user.id, type: 'movie', externalId: tmdbId, title: movie.title, year: movie.year, poster: posterOf(movie) })
  }
  revalidatePath('/')
}

export async function requestTv(form: FormData) {
  const user = await requireUser()
  const tvdbId = positiveInt(form.get('id'))
  const seasons = form.getAll('season').map(positiveInt)
  if (!seasons.length) return
  const show = await addSeries(tvdbId, seasons)
  addRequest({ userId: user.id, type: 'tv', externalId: tvdbId, title: show.title, year: show.year, poster: posterOf(show), seasons })
  revalidatePath('/')
}
