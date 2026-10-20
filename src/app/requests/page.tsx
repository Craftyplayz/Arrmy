import Link from 'next/link'
import { requestDetails, type RequestDetails } from '@/lib/arr'
import { listRequests, otherRequests, seasonsOf, type RequestRow } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { seasonLabel } from '@/lib/status'
import { editSeasons, removeRequest } from '../actions'
import { AutoRefresh } from '../auto-refresh'
import { Badge, Card } from '../ui'

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

  return (
    <>
      <h1>{user.is_admin ? 'All Requests' : 'Your Requests'}</h1>
      {details?.some((d) => d.status && d.status.label !== 'Available') && <AutoRefresh seconds={5} />}
      {notice && <p className="error">{notice}</p>}
      {!details && <p className="error">Radarr, Sonarr or LazyLibrarian isn't responding, so live status is missing.</p>}
      {requests.length === 0 && (
        <p className="muted">
          Nothing requested yet. <Link href="/">Search</Link> for something to watch.
        </p>
      )}
      <ul className="results">
        {requests.map((r, i) => (
          <Card key={r.id} title={r.title} year={r.year} poster={r.poster}>
            <p className="muted">
              {r.seasons && `${seasonLabel(seasonsOf(r))} · `}
              {user.is_admin ? `${r.username} · ` : ''}
              {new Date(`${r.created_at.replace(' ', 'T')}Z`).toLocaleDateString()}
            </p>
            {details && <Badge status={details[i].status} />}
            {details && <Manage r={r} details={details[i]} />}
          </Card>
        ))}
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
    <div className="manage">
      {r.media_type === 'tv' && details.seasons.length > 0 && (
        <details>
          <summary>Edit seasons</summary>
          <form action={editSeasons} className="seasons">
            <input type="hidden" name="id" value={r.id} />
            {details.seasons.map((n) => (
              <label key={n}>
                <input type="checkbox" name="season" value={n} defaultChecked={requested.includes(n)} /> Season {n}
              </label>
            ))}
            <button>Save</button>
          </form>
          <p className="muted">Unticked seasons are deleted from the server, unless someone else requested them.</p>
        </details>
      )}
      <details>
        <summary>Remove</summary>
        <form action={removeRequest}>
          <input type="hidden" name="id" value={r.id} />
          <p className="muted">
            {shared
              ? 'Someone else requested this too, so what they asked for stays.'
              : started
                ? 'Deletes the download and the files from the server.'
                : 'Cancels the Request. Nothing has downloaded yet.'}
          </p>
          <button className="danger">{started && !shared ? 'Delete' : 'Cancel Request'}</button>
        </form>
      </details>
    </div>
  )
}
