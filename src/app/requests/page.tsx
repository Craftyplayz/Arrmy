import Link from 'next/link'
import { requestStatuses } from '@/lib/arr'
import { listRequests } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { seasonLabel, type Status } from '@/lib/status'
import { AutoRefresh } from '../auto-refresh'
import { Badge, Card } from '../ui'

export default async function RequestsPage() {
  const user = await requireUser()
  const requests = listRequests(user.is_admin ? undefined : user.id)
  let statuses: (Status | null)[] | undefined
  try {
    statuses = await requestStatuses(requests)
  } catch (e) {
    console.error(e)
  }

  return (
    <>
      <h1>{user.is_admin ? 'All Requests' : 'Your Requests'}</h1>
      {statuses?.some((s) => s && s.label !== 'Available') && <AutoRefresh seconds={5} />}
      {!statuses && <p className="error">Radarr or Sonarr isn't responding, so live status is missing.</p>}
      {requests.length === 0 && (
        <p className="muted">
          Nothing requested yet. <Link href="/">Search</Link> for something to watch.
        </p>
      )}
      <ul className="results">
        {requests.map((r, i) => (
          <Card key={r.id} title={r.title} year={r.year} poster={r.poster}>
            <p className="muted">
              {r.seasons && `${seasonLabel(JSON.parse(r.seasons))} · `}
              {user.is_admin ? `${r.username} · ` : ''}
              {new Date(`${r.created_at.replace(' ', 'T')}Z`).toLocaleDateString()}
            </p>
            {statuses && <Badge status={statuses[i]} />}
          </Card>
        ))}
      </ul>
    </>
  )
}
