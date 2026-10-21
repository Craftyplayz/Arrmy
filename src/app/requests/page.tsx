import type { Metadata } from 'next'
import Link from 'next/link'
import { requestDetails, type RequestDetails } from '@/lib/arr'
import { betterPoster } from '@/lib/books'
import { listRequests, seasonsOf } from '@/lib/db'
import { utc } from '@/lib/logrules'
import { requireUser } from '@/lib/session'
import { seasonLabel } from '@/lib/status'
import { AutoRefresh } from '../auto-refresh'
import { Badge, day, Hero, num, size } from '../ui'

export const metadata: Metadata = { title: 'Requests' }

const TYPE_NAMES = { movie: 'Movie', tv: 'TV Show', audiobook: 'Audiobook' }

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const user = await requireUser()
  const { notice } = await searchParams
  const requests = listRequests(user.is_admin ? undefined : user.id)
  const posters = await Promise.all(requests.map(betterPoster))
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
      {requests.length > 0 && (
        <section className="ar-panel ar-scroll">
          <table className="ar-tbl">
            <thead>
              <tr>
                <th>Title</th>
                <th className="wide">Media Type</th>
                {user.is_admin && <th className="wide">Requested by</th>}
                <th className="wide">Requested</th>
                <th className="wide num">Size</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => {
                const status = details?.[i].status
                return (
                  <tr key={r.id}>
                    <td>
                      <Link className="ar-t" href={`/requests/${r.id}`}>
                        {posters[i] ? (
                          <img className="ar-thumb" src={posters[i]} alt="" width={28} height={42} loading={i < 12 ? undefined : 'lazy'} decoding="async" />
                        ) : (
                          <span className="ar-thumb" />
                        )}
                        <span>
                          <b>{r.title}</b>
                          <small>{[r.year, r.seasons ? seasonLabel(seasonsOf(r)) : ''].filter(Boolean).join(' · ')}</small>
                        </span>
                      </Link>
                    </td>
                    <td className="wide">{TYPE_NAMES[r.media_type]}</td>
                    {user.is_admin && <td className="wide">{r.username}</td>}
                    <td className="wide">{day(new Date(utc(r.created_at)))}</td>
                    <td className="wide num">{details?.[i].bytes ? size(details[i].bytes) : '—'}</td>
                    <td>
                      {status !== undefined && <Badge status={status} />}
                      {status?.label === 'Downloading' && (
                        <div className="progress" role="progressbar" aria-label={`${r.title} progress`} aria-valuenow={status.progress ?? 0} aria-valuemin={0} aria-valuemax={100}>
                          <i style={{ width: `${status.progress ?? 0}%` }} />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}
