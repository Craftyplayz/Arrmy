import type { Metadata } from 'next'
import { poster, requests, type MockRequest, type MockStatus } from '../../data'

export const metadata: Metadata = { title: 'Shelf · Requests' }

const SHELVES: [heading: string, statuses: MockStatus[]][] = [
  ['Downloading & Importing', ['Downloading', 'Importing']],
  ['Requested', ['Requested']],
  ['Stuck', ['Stuck']],
  ['Available', ['Available']],
]
const STATUSES: MockStatus[] = ['Downloading', 'Importing', 'Requested', 'Stuck', 'Available']
const HUES: Record<string, number> = { Crafty: 200, Sam: 120, Jo: 330, Alex: 40 }
const count = (s: MockStatus) => requests.filter((r) => r.status === s).length

export default function ShelfRequests() {
  return (
    <>
      <h1>Requests</h1>
      <p className="lede">Every Request on the shelves, newest first. Pick a tag to show only those.</p>
      <div className="filters">
        <button type="button" className="chip is-active">All <i>{requests.length}</i></button>
        {STATUSES.map((s) => <button key={s} type="button" className="chip">{s} <i>{count(s)}</i></button>)}
        <span className="sep" />
        {['Movie', 'TV Show', 'Audiobook'].map((m) => <button key={m} type="button" className="chip">{m}</button>)}
      </div>
      {SHELVES.map(([heading, statuses]) => {
        const items = requests.filter((r) => statuses.includes(r.status))
        return (
          <section key={heading} className="shelf">
            <h2>{heading} <small>{items.length}</small></h2>
            <div className="row">{items.map((r) => <Item key={r.id} r={r} />)}</div>
          </section>
        )
      })}
    </>
  )
}

/** A cover on the shelf: what's stuck on it depends on the status; the caption says what was asked for, by whom and when. */
function Item({ r }: { r: MockRequest }) {
  const busy = r.status === 'Downloading' || r.status === 'Importing'
  return (
    <div className="item">
      <div className={r.status === 'Stuck' ? 'cover dim' : 'cover'} style={poster(r.title.hue)}>
        {r.status === 'Stuck' && <span className="tag red">Stuck</span>}
        {r.status === 'Available' && <span className="tag green">On Plex</span>}
        <b>{r.title.title}</b>
        {busy && <span className={r.status === 'Importing' ? 'strip gold' : 'strip'}><i style={{ width: `${r.progress}%` }} /></span>}
      </div>
      <div className="plank" />
      <div className="cap">
        <b>{r.title.title}</b>
        <span>{r.detail}{busy && ` · ${r.progress}%`}{r.sizeGb > 0 && ` · ${r.sizeGb} GB`}</span>
        <span className="who"><i className="avatar s" style={poster(HUES[r.requestedBy])}>{r.requestedBy[0]}</i>{r.requestedAgo}</span>
      </div>
    </div>
  )
}
