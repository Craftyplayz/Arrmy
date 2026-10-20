'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { addMovie, addSeries, arr, posterOf, removeMovie, removeSeasons, retryRelease } from '@/lib/arr'
import { addAudiobook, dropAudiobookRelease, removeAudiobook } from '@/lib/books'
import {
  addRequest,
  deleteRequest,
  getRequest,
  hasRequest,
  otherRequests,
  requestsFor,
  seasonsOf,
  setSearchPending,
  setSeasons,
  setSetting,
  type Limits,
} from '@/lib/db'
import { applyLimits, showLimitProblem } from '@/lib/limits'
import { createPin } from '@/lib/plex'
import { PIN_COOKIE, requireUser, SESSION_COOKIE } from '@/lib/session'

const positiveInt = (value: FormDataEntryValue | null) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Not a valid id: ${value}`)
  return n
}

const union = (...lists: number[][]) => [...new Set(lists.flat())].sort((a, b) => a - b)

/** One-click fix for a Problem on the Admin page. */
export async function fixProblem(form: FormData) {
  const user = await requireUser()
  if (!user.is_admin) throw new Error('Only the Admin can fix Problems')
  const service = form.get('service')
  if (service === 'lazylibrarian' && form.get('fix') === 'retry') {
    // An audiobook's dead release (see dead.ts): drop it, and search again once LazyLibrarian has marked it Failed.
    const hash = String(form.get('hash'))
    if (!/^[a-f0-9]{40}$/.test(hash)) throw new Error(`Bad torrent hash: ${hash}`)
    await dropAudiobookRelease(hash)
    setSearchPending(hash, true)
    return revalidatePath('/admin')
  }
  if (service !== 'radarr' && service !== 'sonarr') throw new Error(`Unknown service: ${service}`)
  const ids = form.getAll('id').map(positiveInt)
  if (form.get('fix') === 'retry') {
    await retryRelease(service, ids)
  } else if (form.get('fix') === 'search') {
    const command = service === 'radarr' ? { name: 'MoviesSearch', movieIds: ids } : { name: 'EpisodeSearch', episodeIds: ids }
    await arr(service, '/command', 'POST', command)
  } else throw new Error(`Unknown fix: ${form.get('fix')}`)
  revalidatePath('/admin')
}

export async function saveLimits(form: FormData) {
  const user = await requireUser()
  if (!user.is_admin) throw new Error('Only the Admin can change Size Limits')
  const gb = (key: keyof Limits) => {
    const n = Number(form.get(key) || 0)
    if (!Number.isFinite(n) || n < 0 || n > 10_000) throw new Error(`Not a size in GB: ${form.get(key)}`)
    return n
  }
  const limits = { movieGb: gb('movieGb'), episodeGb: gb('episodeGb'), showGb: gb('showGb') }
  await applyLimits(limits) // before saving, so a failure leaves the old limits in place everywhere
  setSetting('limits', limits)
  redirect('/settings?saved=1')
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
  let note: string | undefined
  if (request.media_type === 'audiobook') {
    if (!others.length) note = await removeAudiobook(request)
  } else if (request.media_type === 'movie') {
    if (!others.length) await removeMovie(Number(request.external_id))
  } else {
    const wanted = new Set(others.flatMap(seasonsOf))
    await removeSeasons(Number(request.external_id), seasonsOf(request).filter((n) => !wanted.has(n)))
  }
  deleteRequest(request.id)
  if (note) redirect(`/requests?notice=${encodeURIComponent(note)}`)
  revalidatePath('/requests')
}

/** LazyLibrarian BookIDs: OpenLibrary works (OL123W), Goodreads numbers, Google ids. Nothing else reaches its API. */
const bookId = (value: FormDataEntryValue | null) => {
  const id = String(value ?? '')
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new Error(`Not a valid book id: ${id}`)
  return id
}

export async function requestAudiobook(form: FormData) {
  const user = await requireUser()
  const id = bookId(form.get('id'))
  const book = await addAudiobook(id)
  if (!hasRequest(user.id, 'audiobook', id)) {
    addRequest({ userId: user.id, type: 'audiobook', externalId: id, title: book.title, year: book.year, poster: book.poster })
  }
  revalidatePath('/')
}

/** Adds and removes seasons of a TV Request; removed seasons follow the same rules as removing a Request. */
export async function editSeasons(form: FormData) {
  const request = await ownRequest(form)
  const before = seasonsOf(request)
  const after = form.getAll('season').map(positiveInt)
  if (!after.length) return removeRequest(form)

  const added = after.filter((n) => !before.includes(n))
  const removed = before.filter((n) => !after.includes(n))
  if (added.length) {
    const problem = await showLimitProblem(Number(request.external_id), union(otherRequests(request).flatMap(seasonsOf), after))
    if (problem) redirect(`/requests?notice=${encodeURIComponent(problem)}`)
    await addSeries(Number(request.external_id), added)
  }
  if (removed.length) {
    const wanted = new Set(otherRequests(request).flatMap(seasonsOf))
    await removeSeasons(Number(request.external_id), removed.filter((n) => !wanted.has(n)))
  }
  setSeasons(request.id, after, added.length > 0)
  revalidatePath('/requests')
}

export async function requestTv(form: FormData) {
  const user = await requireUser()
  const tvdbId = positiveInt(form.get('id'))
  const seasons = form.getAll('season').map(positiveInt)
  if (!seasons.length) return
  const problem = await showLimitProblem(tvdbId, union(requestsFor('tv', tvdbId).flatMap(seasonsOf), seasons))
  if (problem) redirect(`/?type=tv&q=${encodeURIComponent(String(form.get('q') ?? ''))}&notice=${encodeURIComponent(problem)}`)
  const show = await addSeries(tvdbId, seasons)
  addRequest({ userId: user.id, type: 'tv', externalId: tvdbId, title: show.title, year: show.year, poster: posterOf(show), seasons })
  revalidatePath('/')
}
