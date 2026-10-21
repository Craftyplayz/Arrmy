import type { Metadata } from 'next'
import { admin, poster, requests, type MockRequest } from '../../data'

export const metadata: Metadata = { title: 'One thing at a time · Requests' }

const FILTERS = ['All', 'Mine', 'Movies', 'TV Shows', 'Audiobooks', 'Stuck']

/** The plain-English line under each title, and the one button that goes with it. */
function sentence(r: MockRequest): [what: string, action: string] {
  switch (r.status) {
    case 'Available': return ['Available: open it in Plex', 'Open in Plex']
    case 'Downloading': {
      const d = admin.downloads.find((x) => x.title.startsWith(r.title.title))
      return [d ? `Downloading, about ${d.eta} left` : `Downloading, ${r.progress}% so far`, 'Remove']
    }
    case 'Importing': return ['Importing: downloaded, Plex is adding it now', 'Remove']
    case 'Stuck': return ['Stuck: nothing found yet, the Admin has been told', 'Ask again']
    default: return ['Requested: waiting for a release to turn up', 'Remove']
  }
}

export default function WizardRequests() {
  return (
    <div className="wz-page">
      <h1 className="wz-title">Your Requests</h1>
      <p className="wz-lede">{requests.length} Requests, newest first. Each card says where it is in plain words.</p>
      <div className="wz-pills wz-filters">
        {FILTERS.map((f) => <button key={f} type="button" className={f === 'All' ? 'wz-pill on' : 'wz-pill'}>{f}</button>)}
      </div>
      {requests.map((r) => {
        const [what, action] = sentence(r)
        return (
          <article key={r.id} className={`wz-req st-${r.status.toLowerCase()}`}>
            <div className="wz-poster" style={poster(r.title.hue)} />
            <div>
              <h2>{r.title.title} <small>{r.title.year}</small></h2>
              <p className="wz-req-meta">{r.title.type} · {r.detail}{r.sizeGb > 0 && ` · ${r.sizeGb} GB`}</p>
              <p className="wz-req-who">Asked by {r.requestedBy}, {r.requestedAgo}</p>
              <p className="wz-req-status">{what}</p>
              <div className="wz-bar"><i style={{ width: `${r.status === 'Stuck' ? 100 : r.progress}%` }} /></div>
            </div>
            <button type="button" className={r.status === 'Available' ? 'wz-btn' : 'wz-btn ghost'}>{action}</button>
          </article>
        )
      })}
    </div>
  )
}
