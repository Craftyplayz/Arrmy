import type { Metadata } from 'next'
import { poster, recentlyAdded, requests, searchResults, trending, type MockTitle } from '../data'

export const metadata: Metadata = { title: 'Phone app · Home' }

const TYPES = ['All', 'Movie', 'TV Show', 'Audiobook']
const status = (t: MockTitle) => requests.find((r) => r.title.id === t.id)?.status

export default function Home() {
  return (
    <>
      <h1 className="lm-title">Search</h1>
      <div className="lm-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input className="lm-field" type="search" defaultValue="the" placeholder="Movies, TV Shows, Audiobooks" aria-label="Search" />
      </div>
      <div className="lm-seg" role="group" aria-label="Media Type">
        {TYPES.map((t, i) => <button key={t} type="button" className={i === 0 ? 'on' : ''} aria-pressed={i === 0}>{t}</button>)}
      </div>

      <div className="lm-group">
        {searchResults.map((t) => {
          const s = status(t)
          return (
            <div key={t.id} className="lm-cell">
              <div className="lm-poster" style={poster(t.hue)} />
              <div className="lm-main"><b>{t.title}</b><small>{t.year} · {t.type}</small></div>
              {s ? <span className={`lm-chip st-${s.toLowerCase()}`}>{s}</span> : <button type="button" className="lm-btn">Request</button>}
            </div>
          )
        })}
      </div>

      <h2 className="lm-h2">Trending <small>this week</small></h2>
      <Strip items={trending} />
      <h2 className="lm-h2">Recently added <small>now Available</small></h2>
      <Strip items={recentlyAdded} />

      <button type="button" className="lm-fab" aria-label="New Request">+</button>
    </>
  )
}

function Strip({ items }: { items: MockTitle[] }) {
  return (
    <div className="lm-row">
      {items.map((t) => (
        <div key={t.id} className="lm-card">
          <div className="lm-poster" style={poster(t.hue)} />
          <b>{t.title}</b>
          <small>{t.year} · {t.type}</small>
        </div>
      ))}
    </div>
  )
}
