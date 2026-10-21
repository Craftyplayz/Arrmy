import type { Metadata } from 'next'
import { poster, requests } from '../../data'
import { avatarStyle, dayLabel, dayName, requestedOn, TODAY, tone } from '../events'

export const metadata: Metadata = { title: 'Calendar · Requests' }

const STATUSES = ['Requested', 'Downloading', 'Importing', 'Available', 'Stuck']
const TYPES = ['Movie', 'TV Show', 'Audiobook']
const days = [...new Set(requests.map((r) => requestedOn[r.id]))].sort((a, b) => b - a)
const heading = (d: number) => (d === TODAY ? 'Today' : d === TODAY - 1 ? 'Yesterday' : dayLabel(d))

export default function CalendarRequests() {
  return (
    <>
      <div className="lc-toolbar">
        <h1>Requests</h1>
        <p>Everything asked for this month, newest first.</p>
        <div className="lc-chips right">
          <button type="button" className="lc-chip is-on">Everyone</button>
          <button type="button" className="lc-chip">Only mine</button>
        </div>
      </div>
      <div className="lc-req">
        <section className="lc-agenda">
          {days.map((d) => (
            <div key={d} className={`lc-group${d === TODAY ? ' is-today' : ''}`}>
              <h2><b>{d}</b><span>{d >= TODAY - 1 ? heading(d) : dayName(d)}</span></h2>
              <div className="lc-cards">
                {requests.filter((r) => requestedOn[r.id] === d).map((r) => (
                  <article key={r.id} className={`lc-card ${tone(r.title.type)} st-${r.status.toLowerCase()}`}>
                    <time>{r.requestedAgo}</time>
                    <div className="lc-thumb" style={poster(r.title.hue)} />
                    <div className="lc-card-main">
                      <b>{r.title.title} <small>{r.title.year}</small></b>
                      <span>{r.title.type} · {r.detail}{r.sizeGb > 0 && ` · ${r.sizeGb} GB`}</span>
                      {(r.status === 'Downloading' || r.status === 'Importing') && <div className="lc-bar"><i style={{ width: `${r.progress}%` }} /></div>}
                    </div>
                    <span className="lc-who"><i className="lc-avatar" style={avatarStyle(r.requestedBy)}>{r.requestedBy[0]}</i>{r.requestedBy}</span>
                    <span className="lc-st">{r.status}</span>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
        <aside className="lc-rail">
          <h3>By status</h3>
          {STATUSES.map((s) => (
            <div key={s} className={`lc-count st-${s.toLowerCase()}`}><i className="lc-dot" />{s}<b>{requests.filter((r) => r.status === s).length}</b></div>
          ))}
          <h3>By Media Type</h3>
          {TYPES.map((t) => (
            <div key={t} className={`lc-count ${tone(t)}`}><i className="lc-dot" />{t}<b>{requests.filter((r) => r.title.type === t).length}</b></div>
          ))}
          <h3>Total</h3>
          <div className="lc-count">{requests.length} Requests · {requests.reduce((n, r) => n + r.sizeGb, 0).toFixed(1)} GB</div>
        </aside>
      </div>
    </>
  )
}
