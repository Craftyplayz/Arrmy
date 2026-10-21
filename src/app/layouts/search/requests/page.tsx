import type { Metadata } from 'next'
import { poster, requests, type MockRequest, type MockStatus } from '../../data'

export const metadata: Metadata = { title: 'Search first · Requests' }

const GROUPS: [label: string, statuses: MockStatus[]][] = [
  ['Downloading & importing', ['Downloading', 'Importing']],
  ['Requested', ['Requested']],
  ['Stuck', ['Stuck']],
  ['Available', ['Available']],
]

export default function Requests() {
  const downloading = requests.filter((r) => r.status === 'Downloading').length
  return (
    <div className="ls-col">
      <h1 className="ls-h1">Requests</h1>
      <p className="ls-sum">{requests.length} Requests, {downloading} downloading</p>
      {GROUPS.map(([label, statuses]) => {
        const rows = requests.filter((r) => statuses.includes(r.status))
        return (
          <section key={label} className="ls-group">
            <h2>{label} <span>{rows.length}</span></h2>
            {rows.map((r) => <Row key={r.id} r={r} />)}
          </section>
        )
      })}
    </div>
  )
}

function Row({ r }: { r: MockRequest }) {
  const moving = r.status === 'Downloading' || r.status === 'Importing'
  return (
    <div className="ls-row">
      <div className="ls-poster" style={poster(r.title.hue)} />
      <div className="ls-main">
        <b>{r.title.title}</b>
        <p className="ls-sub">{r.detail}{r.sizeGb > 0 && ` · ${r.sizeGb} GB`} · {r.requestedBy}, {r.requestedAgo}</p>
        {moving && <div className={r.status === 'Importing' ? 'ls-line gold' : 'ls-line'}><i style={{ width: `${r.progress}%` }} /></div>}
      </div>
      <div className="ls-side">
        <span className={`ls-st ${r.status.toLowerCase()}`}>{r.status}{moving && ` ${r.progress}%`}</span>
        <button type="button" className="ls-text-btn">Remove</button>
      </div>
    </div>
  )
}
