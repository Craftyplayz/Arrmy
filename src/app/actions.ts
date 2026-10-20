'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { addMovie, addSeries, posterOf, removeMovie, removeSeasons } from '@/lib/arr'
import { addRequest, deleteRequest, getRequest, hasRequest, otherRequests, seasonsOf, setSeasons } from '@/lib/db'
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

/** The Request in the form, if the signed-in person may change it: their own, or any for the Admin. */
async function ownRequest(form: FormData) {
  const user = await requireUser()
  const request = getRequest(positiveInt(form.get('id')))
  if (!request || (request.user_id !== user.id && !user.is_admin)) throw new Error('Not your Request')
  return request
}

/** Cancels the Request, or deletes its download and files, keeping whatever another Request still wants. */
export async function removeRequest(form: FormData) {
  const request = await ownRequest(form)
  const others = otherRequests(request)
  if (request.media_type === 'movie') {
    if (!others.length) await removeMovie(request.external_id)
  } else {
    const wanted = new Set(others.flatMap(seasonsOf))
    await removeSeasons(request.external_id, seasonsOf(request).filter((n) => !wanted.has(n)))
  }
  deleteRequest(request.id)
  revalidatePath('/requests')
}

/** Adds and removes seasons of a TV Request; removed seasons follow the same rules as removing a Request. */
export async function editSeasons(form: FormData) {
  const request = await ownRequest(form)
  const before = seasonsOf(request)
  const after = form.getAll('season').map(positiveInt)
  if (!after.length) return removeRequest(form)

  const added = after.filter((n) => !before.includes(n))
  const removed = before.filter((n) => !after.includes(n))
  if (added.length) await addSeries(request.external_id, added)
  if (removed.length) {
    const wanted = new Set(otherRequests(request).flatMap(seasonsOf))
    await removeSeasons(request.external_id, removed.filter((n) => !wanted.has(n)))
  }
  setSeasons(request.id, after, added.length > 0)
  revalidatePath('/requests')
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
