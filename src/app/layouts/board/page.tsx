import type { Metadata } from 'next'
import Link from 'next/link'
import { admin, requests, searchResults } from '../data'
import { Chip, Thumb } from './bits'

export const metadata: Metadata = { title: 'Board · Home' }

const TYPES = ['All', 'Movie', 'TV Show', 'Audiobook']
const GLANCE: [label: string, n: number][] = [
  ['Requested', admin.counts.requested],
  ['Downloading', admin.counts.downloading],
  ['Importing', admin.counts.importing],
  ['Available', admin.counts.available],
  ['Stuck', admin.counts.stuck],
]

export default function BoardHome() {
  return (
    <>
      <section className="lb-panel">
        <div className="lb-panel-head">
          <h1>Add a Request</h1>
          <span className="lb-hint">Pick a title and press <kbd>Enter</kbd>: it lands as a card in Requested</span>
        </div>
        <div className="lb-searchrow">
          <input className="lb-field" defaultValue="the" placeholder="Search Movies, TV Shows and Audiobooks…" />
          <div className="lb-chips">
            {TYPES.map((t, i) => <button key={t} type="button" className={i === 0 ? 'lb-chipbtn on' : 'lb-chipbtn'}>{t}</button>)}
          </div>
        </div>
        <ul className="lb-results">
          {searchResults.map((t) => {
            const on = requests.find((r) => r.title.id === t.id)
            return (
              <li key={t.id} className="lb-result">
                <Thumb hue={t.hue} />
                <div className="lb-result-main">
                  <b>{t.title}</b>
                  <span className="lb-meta">{t.year} · <Chip type={t.type} /> · ★ {t.rating} · {t.runtime} · {t.genres.join(', ')}</span>
                </div>
                {on ? (
                  <span className={`lb-onboard st-${on.status.toLowerCase()}`}><i />On the board · {on.status}</span>
                ) : (
                  <button type="button" className="lb-btn primary">Request<small>→ Requested</small></button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="lb-glance">
        <h2>Board at a glance</h2>
        <div className="lb-stats five">
          {GLANCE.map(([label, n]) => (
            <Link key={label} href="/layouts/board/requests" className={`lb-stat st-${label.toLowerCase()}`}><i /><b>{n}</b><span>{label}</span></Link>
          ))}
        </div>
      </section>
    </>
  )
}
