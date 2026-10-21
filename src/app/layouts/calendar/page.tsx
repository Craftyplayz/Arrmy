import type { Metadata } from 'next'
import { poster } from '../data'
import { cells, dayNumber, events, isOther, label, TODAY, tone } from './events'

export const metadata: Metadata = { title: 'Calendar · Home' }

const TYPES = ['Movie', 'TV Show', 'Audiobook']
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarHome() {
  const today = events.filter((e) => e.day === TODAY)
  return (
    <>
      <div className="lc-toolbar">
        <label className="lc-search"><span aria-hidden="true">⌕</span><input placeholder="Search to request…" /></label>
        <div className="lc-chips">
          <button type="button" className="lc-chip is-on">All</button>
          {TYPES.map((t) => <button key={t} type="button" className="lc-chip"><i className={tone(t)} />{t}</button>)}
        </div>
      </div>
      <div className="lc-home">
        <div className="lc-month">
          <div className="lc-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="lc-days">
            {cells.map((d) => (
              <div key={d} className={`lc-day${d === TODAY ? ' is-today is-selected' : ''}${isOther(d) ? ' is-other' : ''}`}>
                <span className="lc-num">{dayNumber(d)}</span>
                {events.filter((e) => e.day === d).map((e) => (
                  <span key={label(e)} className={`lc-pill ${tone(e.title.type)} ${e.kind}`} title={label(e)}>{label(e)}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <aside className="lc-daypanel">
          <h2>Wednesday 21 October</h2>
          <p className="lc-sub">Today · {today.length} events</p>
          {today.map((e) => (
            <div key={label(e)} className={`lc-ev ${tone(e.title.type)}`}>
              <div className="lc-thumb" style={poster(e.title.hue)} />
              <div>
                <b>{label(e)}</b>
                <small>{e.request ? `${e.request.detail} · by ${e.request.requestedBy} · ${e.request.requestedAgo}` : e.note}</small>
              </div>
              {e.request && <span className={`lc-st st-${e.request.status.toLowerCase()}`}>{e.request.status}</span>}
            </div>
          ))}
          <ul className="lc-legend">
            {TYPES.map((t) => <li key={t} className={tone(t)}><i />{t}</li>)}
            <li>Solid pill: now on Plex. Dashed: release date.</li>
          </ul>
        </aside>
      </div>
    </>
  )
}
