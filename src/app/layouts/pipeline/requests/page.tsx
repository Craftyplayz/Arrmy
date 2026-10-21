import type { Metadata } from 'next'
import { poster, requests, user, type MockStatus } from '../../data'

export const metadata: Metadata = { title: 'Pipeline · Requests' }

const COLS = ['Request', 'Indexer', 'Download', 'Import', 'Plex']
/** Which stage column each status sits in. Stuck shows at Indexer: the one Stuck Request has nothing found yet. */
const STAGE: Record<MockStatus, number> = { Requested: 0, Stuck: 1, Downloading: 2, Importing: 3, Available: 4 }
const HUE: Record<string, number> = { Crafty: user.avatarHue, Sam: 120, Jo: 320, Alex: 40 }

export default function PipelineRequests() {
  return (
    <>
      <div className="lp-head"><h1>Requests</h1><p>One lane per Request. The track fills up to the stage it is at.</p></div>
      <div className="lp-filters">
        <div className="lp-pills">
          {['All', 'Moving', 'Stuck', 'Available'].map((t, i) => <button key={t} type="button" className={i === 0 ? 'lp-pill on' : 'lp-pill'}>{t}</button>)}
        </div>
        <input className="lp-field" placeholder="Filter by title or Requester" />
      </div>
      <div className="lp-lanes">
        <div className="lp-lane-head"><span>Request</span>{COLS.map((c) => <span key={c}>{c}</span>)}<span>Action</span></div>
        {requests.map((r) => {
          const at = STAGE[r.status]
          const moving = r.status === 'Downloading' || r.status === 'Importing'
          return (
            <div key={r.id} className="lp-lane">
              <div className="lp-who">
                <i style={poster(r.title.hue)} />
                <div>
                  <b>{r.title.title}</b>
                  <small>{r.title.year} · {r.detail} · <i className="lp-avatar" style={{ background: `hsl(${HUE[r.requestedBy]} 50% 45%)` }}>{r.requestedBy[0]}</i>{r.requestedBy} · {r.requestedAgo}</small>
                </div>
              </div>
              {COLS.map((c, i) => (
                <div key={c} className={i < at ? 'lp-cell done' : i === at ? `lp-cell now${i === 0 ? ' first' : i === 4 ? ' last' : ''}` : 'lp-cell'}>
                  {i === at && <b className={r.status.toLowerCase()} />}
                  {i === at && moving && <small>{r.progress}%</small>}
                  {i === at && r.status === 'Stuck' && <small className="stuck">Stuck</small>}
                </div>
              ))}
              <div className="lp-act">
                {r.status === 'Available' ? <button type="button" className="lp-btn ok">Open in Plex</button>
                  : r.status === 'Stuck' ? <button type="button" className="lp-btn danger">Fix</button>
                  : <button type="button" className="lp-btn">Remove</button>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
