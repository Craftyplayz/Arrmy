import type { Metadata } from 'next'
import { poster, requests, type MockRequest } from '../../data'

export const metadata: Metadata = { title: 'Phone app · Requests' }

const SWIPED = 108 // the one cell drawn mid-swipe, to show how Remove works

export default function Requests() {
  const active = requests.filter((r) => r.status !== 'Available').length
  const available = requests.length - active
  return (
    <>
      <h1 className="lm-title">Requests <span className="lm-count">{requests.length}</span></h1>
      <div className="lm-seg" role="group" aria-label="Show">
        <button type="button" className="on" aria-pressed>All</button>
        <button type="button">Active · {active}</button>
        <button type="button">Available · {available}</button>
      </div>
      <div className="lm-group">
        {requests.map((r) => r.id === SWIPED ? (
          <div key={r.id} className="lm-swipe">
            <div className="lm-swipe-action">← Remove</div>
            <Cell r={r} />
          </div>
        ) : <Cell key={r.id} r={r} />)}
      </div>
      <p className="lm-foot">Swipe a Request left to remove it.</p>
    </>
  )
}

function Cell({ r }: { r: MockRequest }) {
  const moving = r.status === 'Downloading' || r.status === 'Importing'
  return (
    <div className="lm-cell">
      <div className="lm-poster" style={poster(r.title.hue)} />
      <div className="lm-main">
        <b>{r.title.title}</b>
        <small>{r.detail}{r.sizeGb > 0 && ` · ${r.sizeGb} GB`}</small>
        <small>{r.requestedBy} · {r.requestedAgo}</small>
        {moving && <div className={r.status === 'Importing' ? 'lm-bar gold' : 'lm-bar'}><i style={{ width: `${r.progress}%` }} /></div>}
      </div>
      <div className="lm-side">
        <span className={`lm-chip st-${r.status.toLowerCase()}`}>{r.status}</span>
        {moving && <small className="muted">{r.progress}%</small>}
      </div>
    </div>
  )
}
