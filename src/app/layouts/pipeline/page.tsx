import type { Metadata } from 'next'
import { poster, recentlyAdded, requests, searchResults, type MockRequest, type MockStatus } from '../data'

export const metadata: Metadata = { title: 'Pipeline · Home' }

/** The five stages, left to right, and which status sits on each. Indexer has no status of its own. */
const STAGES: [name: string, sub: string, status?: MockStatus][] = [
  ['Request', 'Waiting to be picked up', 'Requested'],
  ['Indexer', 'Prowlarr is searching'],
  ['Download', 'qBittorrent', 'Downloading'],
  ['Import', 'Radarr · Sonarr · LazyLibrarian', 'Importing'],
  ['Plex', 'Available to watch', 'Available'],
]

export default function PipelineHome() {
  const stuck = requests.filter((r) => r.status === 'Stuck')
  return (
    <>
      <div className="lp-head"><h1>Pipeline</h1><p>Every Request, on the stage it has reached. Left to right: from asked for to Available in Plex.</p></div>
      <div className="lp-diagram">
        {STAGES.map(([name, sub, status]) => {
          const here = status ? requests.filter((r) => r.status === status) : []
          return (
            <div key={name} className="lp-node">
              <div className="lp-node-head"><b>{name}</b><small>{sub}</small><span className="lp-count">{here.length}</span></div>
              <div className="lp-node-body">
                {here.length === 0 && <span className="lp-empty">Nothing here right now</span>}
                {here.map((r) => <Chip key={r.id} r={r} />)}
              </div>
            </div>
          )
        })}
        {/* the Stuck siding: dashed red drops out of Indexer and Import */}
        <svg className="lp-drops" aria-hidden="true">
          <line x1="30%" y1="0" x2="30%" y2="100%" stroke="#ff5c5c" strokeWidth={2} strokeDasharray="4 3" />
          <line x1="70%" y1="0" x2="70%" y2="100%" stroke="#ff5c5c" strokeWidth={2} strokeDasharray="4 3" />
        </svg>
        <div className="lp-node stuck">
          <div className="lp-node-head"><b>Stuck</b><small>Fell off the line and needs the Admin</small><span className="lp-count">{stuck.length}</span></div>
          <div className="lp-node-body">{stuck.map((r) => <Chip key={r.id} r={r} />)}</div>
        </div>
      </div>

      <div className="lp-home">
        <section className="lp-panel">
          <h2>Add to the pipeline <small>{searchResults.length} results for “the”</small></h2>
          <div className="lp-searchrow">
            <input className="lp-field" defaultValue="the" aria-label="Search" />
            <div className="lp-pills">
              {['All', 'Movie', 'TV Show', 'Audiobook'].map((t, i) => <button key={t} type="button" className={i === 0 ? 'lp-pill on' : 'lp-pill'}>{t}</button>)}
            </div>
          </div>
          <div className="lp-cards">
            {searchResults.map((t) => (
              <div key={t.id} className="lp-card">
                <div className="lp-poster" style={poster(t.hue)} />
                <b>{t.title}</b>
                <small>{t.year} · {t.type}</small>
                <button type="button" className="lp-btn primary">Add</button>
              </div>
            ))}
          </div>
        </section>
        <aside className="lp-panel lp-recent">
          <h2>Recently reached Plex</h2>
          <ul>
            {recentlyAdded.map((t) => (
              <li key={t.id}><i style={poster(t.hue)} /><span><b>{t.title}</b><small>{t.year} · {t.type}</small></span></li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  )
}

/** A Request as a chip on its stage: poster, title, and the percent while it moves. */
function Chip({ r }: { r: MockRequest }) {
  const moving = r.status === 'Downloading' || r.status === 'Importing'
  return (
    <span className={`lp-chip ${r.status.toLowerCase()}`} title={`${r.title.title} · ${r.detail} · ${r.requestedBy}, ${r.requestedAgo}`}>
      <i style={poster(r.title.hue)} /><span>{r.title.title}</span>{moving && <small>{r.progress}%</small>}
    </span>
  )
}
