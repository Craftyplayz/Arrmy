import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { existsSync } from 'node:fs'
import { editionOf } from '@/lib/bookrules'
import { getRequest, logFor, logItem, seasonsOf } from '@/lib/db'
import { buildSteps, logText, releaseText, took, utc, type Grabbed } from '@/lib/logrules'
import { torrentFile } from '@/lib/requestlog'
import { requireUser } from '@/lib/session'
import { seasonLabel } from '@/lib/status'
import { duration } from '@/lib/botrules'
import { AutoRefresh } from '../../auto-refresh'
import { CopyLog, Elapsed } from '../../request-log'
import { Hero } from '../../ui'

export const metadata: Metadata = { title: 'Request Log' }

const clock = (ms: number) => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Every step of one Request, from asking to playable. Requesters see their own, without release names and errors. */
export default async function RequestLogPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const request = getRequest(Number((await params).id))
  if (!request || (request.user_id !== user.id && !user.is_admin)) notFound()
  const admin = !!user.is_admin
  const title = `${request.title}${request.year ? ` (${request.year})` : ''}${request.seasons ? ` · ${seasonLabel(seasonsOf(request))}` : ''}`

  const events = logFor(logItem(request.media_type, request.external_id))
  const app = request.media_type === 'audiobook' ? 'Audiobookshelf' : 'Plex'
  const { steps, total } = buildSteps({ id: request.id, created_at: request.created_at, username: request.username, seasons: seasonsOf(request), app }, events)
  const running = steps.some((s) => s.end === undefined)
  // .torrent copies, Admin only: the release downloading now is the main one, every other grab (dead, or swapped for
  // another) is listed as failed.
  const dead = new Set(events.filter((e) => e.kind === 'dead').map((e) => JSON.parse(e.detail).downloadId))
  const grabs = admin
    ? [...new Map(events.filter((e) => e.kind === 'grabbed' && utc(e.at) >= utc(request.created_at) - 60_000).map((e) => JSON.parse(e.detail) as Grabbed).map((g) => [g.downloadId, g])).values()].filter((g) => existsSync(torrentFile(g.downloadId)))
    : []
  const current = grabs.findLast((g) => !dead.has(g.downloadId))
  const failed = grabs.filter((g) => g !== current)
  const torrentLink = (g: Grabbed) => (
    <a href={`/api/requests/${request.id}/torrent?hash=${g.downloadId}`} download>
      {g.release ?? g.downloadId.slice(0, 8)}
    </a>
  )

  return (
    <>
      <Hero title={title} lede="Every step from the Request to playable, with how long each took.">
        <div className="actions">
          <Link className="btn small" href="/requests">
            All Requests
          </Link>
          <CopyLog text={logText(title, steps, total, admin)} />
        </div>
      </Hero>
      {running && <AutoRefresh seconds={15} />}
      {editionOf(request.external_id) && <p className="muted">Editions Arrmy finds itself only show when they were requested for now.</p>}
      {events.length === 0 && request.status === 'available' && <p className="muted">This finished before Arrmy kept Request Logs, so only the Request is here.</p>}
      <div className="rows">
        {(editionOf(request.external_id) || (events.length === 0 && request.status === 'available') ? steps.slice(0, 1) : steps).map((s, i) => (
          <div className="rowi" key={i}>
            <div className="grow">
              <b>{s.name}</b> {s.end === undefined ? <Elapsed since={s.start} /> : took(s) && <span className="badge">{took(s)}</span>}
              <small className="ar-sub">{clock(s.start)}</small>
              {s.lines
                .filter((l) => admin || !l.admin)
                .map((l, j) => (
                  <span className="ar-sub ar-name" key={j} title={l.text}>
                    {l.text}
                  </span>
                ))}
              {admin && s.releases && (
                <details>
                  <summary className="ar-sub">Every release ({s.releases.length})</summary>
                  <div className="ar-releases">
                    {s.releases.map((r, j) => (
                      <small className="ar-sub" key={j}>
                        {releaseText(r)}
                      </small>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>
      {total !== undefined && (
        <p>
          <b>Request to playable: {duration(total)}</b>
        </p>
      )}
      {current && (
        <p className="ar-sub">
          Download .torrent: {torrentLink(current)}
        </p>
      )}
      {failed.length > 0 && (
        <div className="ar-sub">
          Failed torrents
          {failed.map((g) => (
            <span className="ar-name" key={g.downloadId}>
              {torrentLink(g)}
            </span>
          ))}
        </div>
      )}
    </>
  )
}
