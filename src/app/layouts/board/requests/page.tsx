import type { Metadata } from 'next'
import { requests, type MockRequest, type MockStatus } from '../../data'
import { Avatar, Chip, Thumb } from '../bits'

export const metadata: Metadata = { title: 'Board · Requests' }

const COLUMNS: MockStatus[] = ['Requested', 'Downloading', 'Importing', 'Stuck', 'Available']
const TYPES = ['Movie', 'TV Show', 'Audiobook']

export default function BoardRequests() {
  return (
    <>
      <div className="lb-toolbar">
        <h1>Requests</h1>
        <div className="lb-chips">
          <button type="button" className="lb-chipbtn">Mine</button>
          <button type="button" className="lb-chipbtn on">Everyone</button>
          <i className="lb-sep" />
          {TYPES.map((t) => <button key={t} type="button" className="lb-chipbtn">{t}</button>)}
        </div>
        <label className="lb-select">
          Group by
          <select defaultValue="status">
            <option value="status">Status</option>
            <option value="requester">Requester</option>
            <option value="type">Media Type</option>
          </select>
        </label>
        <span className="lb-hint"><kbd>N</kbd> new Request · <kbd>F</kbd> filter · <kbd>←</kbd><kbd>→</kbd> columns</span>
      </div>

      <div className="lb-board">
        {COLUMNS.map((c) => {
          const cards = requests.filter((r) => r.status === c)
          const shown = c === 'Available' ? cards.slice(0, 3) : cards
          return (
            <section key={c} className={`lb-col st-${c.toLowerCase()}`}>
              <header className="lb-col-head">
                <i /><h2>{c}</h2><span className="lb-count">{cards.length}</span>
                <button type="button" className="lb-plus" aria-label={`Add to ${c}`}>+</button>
              </header>
              <div className="lb-col-body">
                {shown.map((r) => <Card key={r.id} r={r} />)}
                {cards.length === 0 && <p className="lb-empty">Nothing here</p>}
              </div>
              {shown.length < cards.length && <button type="button" className="lb-col-foot">Show all {cards.length}</button>}
            </section>
          )
        })}
      </div>
    </>
  )
}

function Card({ r }: { r: MockRequest }) {
  const busy = r.status === 'Downloading' || r.status === 'Importing'
  return (
    <article className="lb-card">
      <div className="lb-card-top">
        <Thumb hue={r.title.hue} />
        <div className="lb-card-main">
          <b>{r.title.title}</b>
          <span className="lb-meta">{r.detail}</span>
          <Chip type={r.title.type} />
        </div>
      </div>
      {busy && (
        <div className="lb-progress">
          <div className="lb-bar"><i style={{ width: `${r.progress}%` }} /></div>
          <span>{r.progress}% · {r.sizeGb} GB</span>
        </div>
      )}
      <footer className="lb-card-foot">
        <Avatar name={r.requestedBy} />
        <span className="lb-meta">{r.requestedAgo}</span>
        {r.status === 'Stuck' && <button type="button" className="lb-btn danger">Fix</button>}
        <span className="lb-id">#{r.id}</span>
      </footer>
    </article>
  )
}
