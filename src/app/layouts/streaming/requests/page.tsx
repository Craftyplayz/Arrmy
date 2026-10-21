import type { Metadata } from 'next'
import { poster, requests, type MockMediaType } from '../../data'

export const metadata: Metadata = { title: 'Streaming · Requests' }

const count = (type: MockMediaType) => requests.filter((r) => r.title.type === type).length
const FILTERS: [label: string, n: number][] = [
  ['All', requests.length],
  ['Movies', count('Movie')],
  ['TV Shows', count('TV Show')],
  ['Audiobooks', count('Audiobook')],
  ['Stuck', requests.filter((r) => r.status === 'Stuck').length],
]

export default function StreamingRequests() {
  return (
    <div className="st-page">
      <h1>Requests</h1>
      <p className="st-lede">Everything the family has asked for, newest first.</p>
      <div className="st-filters">
        {FILTERS.map(([label, n], i) => <button key={label} type="button" className={i === 0 ? 'is-on' : undefined}>{label} <span>{n}</span></button>)}
      </div>
      <div className="st-grid">
        {requests.map((r) => {
          const s = r.status.toLowerCase()
          const busy = r.status === 'Downloading' || r.status === 'Importing'
          return (
            <div key={r.id} className="st-card">
              <div className={`st-poster is-${s}`} style={poster(r.title.hue)}>
                <span className={`st-chip st-${s}`}>{r.status}</span>
                {busy && <span className="st-pct">{r.progress}%</span>}
                {busy && <span className={`st-bar st-${s}`}><i style={{ width: `${r.progress}%` }} /></span>}
                {r.status === 'Stuck' && <span className="st-pct">Nothing found</span>}
              </div>
              <div className="st-cap">
                <b>{r.title.title}</b>
                <small>{r.detail}{r.sizeGb > 0 && ` · ${r.sizeGb} GB`}</small>
                <small>{r.requestedBy} · {r.requestedAgo}</small>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
