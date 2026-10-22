'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { addSeries, arr, removeMovie, removeSeasons, retryRelease } from '@/lib/arr'
import { editionOf } from '@/lib/bookrules'
import { audiobookTorrents, dropAudiobookRelease, removeAudiobook } from '@/lib/books'
import { removeEdition } from '@/lib/editions'
import {
  addLog,
  deleteRequest,
  getDeadLimits,
  getLimits,
  getRequest,
  logItem,
  otherRequests,
  seasonsOf,
  setSearchPending,
  setSeasons,
  setSetting,
  type Limits,
} from '@/lib/db'
import { announce } from '@/lib/discord'
import { embed } from '@/lib/embeds'
import { applyLimits, showLimitProblem } from '@/lib/limits'
import { tellRequest } from '@/lib/notify'
import { createPin } from '@/lib/plex'
import { type DeadLimits } from '@/lib/problems'
import { createAudiobookRequest, createMovieRequest, createTvRequest } from '@/lib/requests'
import { logEpisodeSearch, logRetry, searchMovie } from '@/lib/requestlog'
import { PIN_COOKIE, requireUser, SESSION_COOKIE } from '@/lib/session'
import { seasonLabel } from '@/lib/status'
import { themeOf } from '@/lib/themes'

const positiveInt = (value: FormDataEntryValue | null) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Not a valid id: ${value}`)
  return n
}

const union = (...lists: number[][]) => [...new Set(lists.flat())].sort((a, b) => a - b)

/** The Request Log is a record, not part of the job: failing to write it never stops the action. */
const logged = (what: Promise<unknown>) => what.catch((e) => console.warn(`[log] ${(e as Error).message}`))

/** One-click fix for a Problem on the Admin page. */
export async function fixProblem(form: FormData) {
  const user = await requireUser()
  if (!user.is_admin) throw new Error('Only the Admin can fix Problems')
  const service = form.get('service')
  const fixed = (what: string) =>
    announce('admin-log', embed({ colour: 'info', app: 'Arrmy', title: String(form.get('title') ?? 'A Problem'), description: `**${user.username}** clicked **${what}** in the Admin view.` }))
  if (service === 'lazylibrarian' && form.get('fix') === 'retry') {
    // An audiobook's dead release (see dead.ts): drop it, and search again once LazyLibrarian has marked it Failed.
    const hash = String(form.get('hash'))
    if (!/^[a-f0-9]{40}$/.test(hash)) throw new Error(`Bad torrent hash: ${hash}`)
    await logged(
      audiobookTorrents().then((books) => {
        const book = books.get(hash)
        if (book) addLog(logItem('audiobook', book), 'dead', { downloadId: hash, reason: 'Try another release', by: user.username })
      }),
    )
    await dropAudiobookRelease(hash)
    setSearchPending(hash, true)
    fixed('Try another release')
    return revalidatePath('/admin')
  }
  if (service !== 'radarr' && service !== 'sonarr') throw new Error(`Unknown service: ${service}`)
  const ids = form.getAll('id').map(positiveInt)
  if (form.get('fix') === 'retry') {
    await logged(logRetry(service, ids, user.username)) // before the release leaves the queue
    await retryRelease(service, ids)
    fixed('Try another release')
  } else if (form.get('fix') === 'search') {
    // Movies: Arrmy's own search, in the background (it waits on every indexer), logging every release.
    if (service === 'radarr') for (const id of ids) logged(searchMovie(id, { text: 'Search again', by: user.username }))
    else {
      await logged(logEpisodeSearch(ids, user.username))
      await arr(service, '/command', 'POST', { name: 'EpisodeSearch', episodeIds: ids })
    }
    fixed('Search again')
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
  const before = getLimits()
  await applyLimits(limits) // before saving, so a failure leaves the old limits in place everywhere
  setSetting('limits', limits)
  const shown = (n: number) => (n ? `${n} GB` : 'no limit')
  const changed = (Object.keys(limits) as (keyof Limits)[]).filter((k) => limits[k] !== before[k])
  const names: Record<keyof Limits, string> = { movieGb: 'movie', episodeGb: 'hour of episode', showGb: 'show' }
  if (changed.length)
    announce(
      'admin-log',
      embed({
        colour: 'info',
        app: 'Arrmy',
        title: 'Size Limits changed',
        description: `**${user.username}** changed them on the Admin page.`,
        fields: changed.map((k) => [`Per ${names[k]}`, `${shown(before[k])} → ${shown(limits[k])}`]),
      }),
    )
  redirect('/admin?saved=1#limits')
}

export async function saveDeadLimits(form: FormData) {
  const user = await requireUser()
  if (!user.is_admin) throw new Error('Only the Admin can change Dead releases')
  const whole = (key: keyof DeadLimits, min: number, max: number) => {
    const n = Number(form.get(key))
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Needs a whole number from ${min} to ${max}: ${form.get(key)}`)
    return n
  }
  const limits: DeadLimits = { metaMinutes: whole('metaMinutes', 1, 1440), idleMinutes: whole('idleMinutes', 1, 1440), strikes: whole('strikes', 1, 20) }
  const before = getDeadLimits()
  setSetting('dead', limits)
  const names: Record<keyof DeadLimits, [string, string]> = {
    metaMinutes: ['Minutes without a file list', ' min'],
    idleMinutes: ['Minutes with nothing downloaded', ' min'],
    strikes: ['Dead releases in a row', ''],
  }
  const changed = (Object.keys(limits) as (keyof DeadLimits)[]).filter((k) => limits[k] !== before[k])
  if (changed.length)
    announce(
      'admin-log',
      embed({
        colour: 'info',
        app: 'Arrmy',
        title: 'Dead releases changed',
        description: `**${user.username}** changed them on the Admin page.`,
        fields: changed.map((k) => [names[k][0], `${before[k]}${names[k][1]} → ${limits[k]}${names[k][1]}`]),
      }),
    )
  redirect('/admin?saved=dead#dead')
}

/** A blank box keeps the key; the values are never shown or logged, only which ones changed. */
export async function saveKeys(form: FormData) {
  const user = await requireUser()
  if (!user.is_admin) throw new Error('Only the Admin can change the API keys')
  const changed: string[] = []
  for (const [field, setting, name] of [['absKey', 'absKey', 'Audiobookshelf API key'], ['tmdbKey', 'tmdbKey', 'TMDB key']]) {
    const value = String(form.get(field) ?? '').trim()
    if (!value) continue
    setSetting(setting, value)
    changed.push(name)
  }
  if (changed.length)
    announce(
      'admin-log',
      embed({
        colour: 'info',
        app: 'Arrmy',
        title: 'API keys changed',
        description: `**${user.username}** set the ${changed.join(' and ')} on the Admin page.`,
      }),
    )
  redirect('/admin?saved=keys#apps')
}

export async function signIn() {
  const h = await headers()
  const proto = h.get('x-forwarded-proto')?.split(',')[0] ?? 'http'
  const { pinId, authUrl } = await createPin(`${proto}://${h.get('x-forwarded-host') ?? h.get('host')}/api/auth/plex/callback`)
  ;(await cookies()).set(PIN_COOKIE, String(pinId), { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' })
  redirect(authUrl)
}

export async function setTheme(form: FormData) {
  const user = await requireUser()
  const theme = themeOf(form.get('theme'))
  if (!theme) return
  setSetting(`theme:${user.id}`, theme.id)
  revalidatePath('/', 'layout')
}

export async function signOut() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect('/login')
}

export async function requestMovie(form: FormData) {
  await createMovieRequest(await requireUser(), positiveInt(form.get('id')))
  revalidatePath('/')
}

/** The Request in the form, if the signed-in person may change it: their own, or any for the Admin. */
async function ownRequest(form: FormData) {
  const user = await requireUser()
  const request = getRequest(positiveInt(form.get('id')))
  if (!request || (request.user_id !== user.id && !user.is_admin)) throw new Error('Not your Request')
  return { user, request }
}

/** "Mum removed Dune" also says whose it was when the Admin changes someone else's Request. */
const by = (user: { id: number; username: string }, request: { user_id: number; username: string }) =>
  `**${user.username}**${request.user_id !== user.id ? ` (for ${request.username})` : ''}`

/** Cancels the Request, or deletes its download and files, keeping whatever another Request still wants. */
export async function removeRequest(form: FormData) {
  const { user, request } = await ownRequest(form)
  const others = otherRequests(request)
  let note: string | undefined
  if (editionOf(request.external_id)) {
    if (!others.length) await removeEdition(String(request.external_id))
  } else if (request.media_type === 'audiobook') {
    if (!others.length) note = await removeAudiobook(request)
  } else if (request.media_type === 'movie') {
    if (!others.length) await removeMovie(Number(request.external_id))
  } else {
    const wanted = new Set(others.flatMap(seasonsOf))
    await removeSeasons(Number(request.external_id), seasonsOf(request).filter((n) => !wanted.has(n)))
  }
  deleteRequest(request.id)
  tellRequest(request, 'neutral', `${by(user, request)} removed this Request.${others.length ? ' Its files stay: someone else requested it too.' : ''}`)
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
  await createAudiobookRequest(await requireUser(), bookId(form.get('id')), String(form.get('edition') ?? ''))
  revalidatePath('/')
}

/** Adds and removes seasons of a TV Request; removed seasons follow the same rules as removing a Request. */
export async function editSeasons(form: FormData) {
  const { user, request } = await ownRequest(form)
  const before = seasonsOf(request)
  const after = form.getAll('season').map(positiveInt)
  if (!after.length) return removeRequest(form)

  const added = after.filter((n) => !before.includes(n))
  const removed = before.filter((n) => !after.includes(n))
  if (added.length) {
    const problem = await showLimitProblem(Number(request.external_id), union(otherRequests(request).flatMap(seasonsOf), after))
    if (problem) {
      tellRequest(request, 'danger', `${by(user, request)} couldn't add ${seasonLabel(added)}. ${problem}`)
      redirect(`/requests?notice=${encodeURIComponent(problem)}`)
    }
    await addSeries(Number(request.external_id), added)
  }
  if (removed.length) {
    const wanted = new Set(otherRequests(request).flatMap(seasonsOf))
    await removeSeasons(Number(request.external_id), removed.filter((n) => !wanted.has(n)))
  }
  setSeasons(request.id, after, added.length > 0)
  const what = [added.length && `added ${seasonLabel(added)}`, removed.length && `removed ${seasonLabel(removed)}`].filter(Boolean).join(' and ')
  if (what) {
    tellRequest(request, 'info', `${by(user, request)} ${what}.`, [['Seasons', after.join(', ')]])
    addLog(logItem('tv', request.external_id), 'note', { text: what[0].toUpperCase() + what.slice(1), by: user.username, request: request.id })
  }
  revalidatePath('/requests')
}

export async function requestTv(form: FormData) {
  const problem = await createTvRequest(await requireUser(), positiveInt(form.get('id')), form.getAll('season').map(positiveInt))
  if (problem) redirect(`/?type=${form.get('type') === 'all' ? 'all' : 'tv'}&q=${encodeURIComponent(String(form.get('q') ?? ''))}&notice=${encodeURIComponent(problem)}`)
  revalidatePath('/')
}
