import type { Metadata } from 'next'
import Link from 'next/link'
import { requestDetails, type RequestDetails } from '@/lib/arr'
import { listRequests, seasonsOf } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { seasonLabel } from '@/lib/status'
import { AutoRefresh } from '../auto-refresh'
import { Cover, Hero, num } from '../ui'

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
      <ul className="ar-caps">
        {requests.map((r, i) => (
          <Cover
            key={r.id}
            id={String(r.id)}
            href={`/requests/${r.id}`}
            title={r.title}
            sub={[r.year, r.seasons ? seasonLabel(seasonsOf(r)) : '', user.is_admin && r.username].filter(Boolean).join(' · ')}
            poster={r.poster}
            status={details?.[i].status}
            eager={i < 6}
          />
        ))}
      </ul>
    </>
  )
}
