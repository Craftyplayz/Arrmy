import type { Metadata } from 'next'
import { admin, poster, requests, type MockRequest } from '../../data'
import { Avatar, StatusPill } from '../bits'

export const metadata: Metadata = { title: 'Tiles · Requests' }

const { counts } = admin
const FILTERS: [label: string, n: number][] = [
  ['All', requests.length],
  ['Downloading', counts.downloading],
  ['Requested', counts.requested],
  ['Importing', counts.importing],
  ['Stuck', counts.stuck],
  ['Available', counts.available],
]

const foot = (r: MockRequest) =>
  r.status === 'Available' ? `${r.sizeGb} GB in Plex`
  : r.status === 'Stuck' ? admin.problems.find(p => p.title === r.title.title)?.what ?? 'Needs the Admin'
  : 'Waiting for a release'

export default function TilesRequests() {
  return (
    <>
      <div className="t-filters" role="group" aria-label="Filter">
        {FILTERS.map(([label, n], i) => <button key={label} type="button" className={i === 0 ? 't-filter on' : 't-filter'}>{label}<span className="n">{n}</span></button>)}
      </div>
      <div className="t-reqs">
        {requests.map(r => {
          const moving = r.status === 'Downloading' || r.status === 'Importing'
          return (
            <article key={r.id} className={r.status === 'Stuck' ? 'tile t-req is-stuck' : 'tile t-req'}>
              <div className="t-poster" style={poster(r.title.hue)} />
              <div className="t-req-body">
                <h3>{r.title.title}</h3>
                <small className="t-dim">{r.title.year} · {r.title.type} · {r.detail}</small>
                <StatusPill status={r.status} />
                <div className="who"><Avatar name={r.requestedBy} />{r.requestedBy} · {r.requestedAgo}</div>
              </div>
              <div className="t-req-foot">
                {moving ? (
                  <>
                    <div className={r.status === 'Importing' ? 't-bar big importing' : 't-bar big'}><i style={{ width: `${r.progress}%` }} /></div>
                    <span>{r.progress}% · {r.sizeGb} GB</span>
                  </>
                ) : (
                  <span>{foot(r)}</span>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
