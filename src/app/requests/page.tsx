import type { Metadata } from 'next'
import Link from 'next/link'
import { requestDetails, type RequestDetails } from '@/lib/arr'
import { listRequests, otherRequests, seasonsOf, type RequestRow } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { seasonLabel } from '@/lib/status'
import { editSeasons, removeRequest } from '../actions'
import { AutoRefresh } from '../auto-refresh'
import { EpisodeFiles } from '../episode-files'
import { SubmitButton } from '../submit-button'
import { Badge, Cover, day, Hero, num } from '../ui'

export const metadata: Metadata = { title: 'Requests' }

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const user = await requireUser()
  const { notice } = await searchParams
  const requests = listRequests(user.is_admin ? undefined : user.id)
  let details: RequestDetails[] | undefined
  try {
    details = await requestDetails(requests)
  } catch (e) {
    console.error(e)
  }

  const count = `${num(requests.length)} ${requests.length === 1 ? 'Request' : 'Requests'}, newest first.`
  return (
    <>
      <Hero
        title={user.is_admin ? 'All Requests' : 'Your Requests'}
        lede={requests.length === 0 ? "What you've asked for and how far along it is." : count}
      />
      {details?.some((d) => d.status && d.status.label !== 'Available') && <AutoRefresh seconds={5} />}
      {notice && <p className="err">{notice}</p>}
      {!details && <p className="err">Radarr, Sonarr or LazyLibrarian isn't responding, so live status is missing.</p>}
      {requests.length === 0 && (
        <p className="muted">
          Nothing requested yet. <Link href="/">Search</Link> for something to watch.
        </p>
      )}
      {/* keyed on the notice, so a refused change closes its drawer and the notice above shows */}
      <ul className="ar-caps" key={notice}>
        {requests.map((r, i) => {
          const when = day(new Date(`${r.created_at.replace(' ', 'T')}Z`))
          const seasons = r.seasons ? seasonLabel(seasonsOf(r)) : ''
          return (
            <Cover
              key={r.id}
              id={String(r.id)}
              title={r.title}
              sub={[r.year, seasons, user.is_admin && r.username].filter(Boolean).join(' · ')}
              poster={r.poster}
              status={details?.[i].status}
              eager={i < 6}
            >
              {details && (
                <div className="badges">
                  <Badge status={details[i].status} />
                </div>
              )}
              <div className="kv">
                {r.year && (
                  <>
                    <span>Year</span>
                    <span>{r.year}</span>
                  </>
                )}
                {seasons && (
                  <>
                    <span>Seasons</span>
                    <span>{seasons}</span>
                  </>
                )}
                {user.is_admin && (
                  <>
                    <span>Requested by</span>
                    <span>{r.username}</span>
                  </>
                )}
                <span>Requested on</span>
                <span>{when}</span>
              </div>
              <Link className="btn small" href={`/requests/${r.id}`}>
                Request Log
              </Link>
              {r.media_type === 'tv' && <EpisodeFiles id={r.id} />}
              {details && <Manage r={r} details={details[i]} />}
            </Cover>
          )
        })}
      </ul>
    </>
  )
}

/** Edit seasons and Remove. The server re-checks that the Request is the viewer's own (or that they're the Admin). */
function Manage({ r, details }: { r: RequestRow; details: RequestDetails }) {
  const requested = seasonsOf(r)
  const shared = otherRequests(r).length > 0
  const started = details.status && details.status.label !== 'Requested'
  return (
    <>
      {r.media_type === 'tv' && details.seasons.length > 0 && (
        <section>
          <form action={editSeasons} className="form">
            <input type="hidden" name="id" value={r.id} />
            <fieldset className="ar-seasons">
              <legend>Edit seasons</legend>
              {details.seasons.map((n) => (
                <label key={n} className="check">
                  <input type="checkbox" name="season" value={n} defaultChecked={requested.includes(n)} /> Season {n}
                </label>
              ))}
            </fieldset>
            <small className="ar-sub">Unticked seasons are deleted from the server, unless someone else requested them.</small>
            <div className="actions">
              <SubmitButton className="btn primary" pending="Saving...">
                Save seasons
              </SubmitButton>
            </div>
          </form>
        </section>
      )}
      <section>
        <details>
          <summary>Remove</summary>
          <form action={removeRequest} className="form">
            <input type="hidden" name="id" value={r.id} />
            <small className="ar-sub">
              {shared
                ? 'Someone else requested this too, so what they asked for stays.'
                : started
                  ? 'Deletes the download and the files from the server.'
                  : 'Cancels the Request. Nothing has downloaded yet.'}
            </small>
            <div className="actions">
              <SubmitButton pending="Removing...">{started && !shared ? 'Delete' : 'Cancel Request'}</SubmitButton>
            </div>
          </form>
        </details>
      </section>
    </>
  )
}
