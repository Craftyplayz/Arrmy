import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { existsSync } from 'node:fs'
import { getRequest, logFor, logItem, seasonsOf } from '@/lib/db'
import { buildSteps, logText, took, type Grabbed } from '@/lib/logrules'
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
  const { steps, total } = buildSteps({ created_at: request.created_at, username: request.username, seasons: seasonsOf(request) }, events)
  const running = steps.some((s) => s.end === undefined)
  // .torrent copies, Admin only: one per grab whose file was saved.
  const torrents = admin ? events.filter((e) => e.kind === 'grabbed').map((e) => (JSON.parse(e.detail) as Grabbed).downloadId).filter((h) => existsSync(torrentFile(h))) : []

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
      {request.media_type === 'audiobook' && <p className="muted">Audiobooks only show when they were requested for now; their steps come in a later version.</p>}
      {events.length === 0 && request.status === 'available' && <p className="muted">This finished before Arrmy kept Request Logs, so only the Request is here.</p>}
      <div className="rows">
        {(request.media_type === 'audiobook' || (events.length === 0 && request.status === 'available') ? steps.slice(0, 1) : steps).map((s, i) => (
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
            </div>
          </div>
        ))}
      </div>
      {total !== undefined && (
        <p>
          <b>Request to playable: {duration(total)}</b>
        </p>
      )}
      {torrents.length > 0 && (
        <p className="ar-sub">
          {torrents.map((h) => (
            <a key={h} href={`/api/requests/${request.id}/torrent?hash=${h}`} download>
              Download .torrent ({h.slice(0, 8)})
            </a>
          ))}
        </p>
      )}
    </>
  )
}
