import type { Metadata } from 'next'
import { poster, recentlyAdded, requests, searchResults } from '../data'

export const metadata: Metadata = { title: 'Search first · Home' }

const TYPES = ['All', 'Movies', 'TV Shows', 'Audiobooks']

export default function Home() {
  return (
    <div className="ls-col">
      <div className="ls-hero">
        <p className="ls-logo">Arrmy</p>
        <div className="ls-search">
          <input className="ls-box" type="search" defaultValue="the" placeholder="Search for a Movie, TV Show or Audiobook" aria-label="Search" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </div>
        <div className="ls-seg" role="group" aria-label="Media Type">
          {TYPES.map((t, i) => <button key={t} type="button" className={i === 0 ? 'on' : undefined}>{t}</button>)}
        </div>
      </div>

      <p className="ls-count">{searchResults.length} results for “the”</p>
      <ul className="ls-results">
        {searchResults.map((t) => (
          <li key={t.id} className="ls-result">
            <div className="ls-poster" style={poster(t.hue)} />
            <div className="ls-main">
              <h3>{t.title}</h3>
              <p className="ls-meta">{t.year} · {t.type} · {t.runtime}</p>
              <p className="ls-over">{t.overview}</p>
              <div className="ls-chips">{t.genres.map((g) => <span key={g} className="ls-chip">{g}</span>)}</div>
            </div>
            <div className="ls-act"><Action id={t.id} /></div>
          </li>
        ))}
      </ul>

      <section className="ls-recent">
        <h2>Recently added to Plex</h2>
        <div className="ls-recent-row">
          {recentlyAdded.map((t) => (
            <div key={t.id}>
              <div className="ls-poster" style={poster(t.hue)} />
              <b>{t.title}</b>
              <small>{t.year} · {t.type}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/** A Request button, or the state of the Request someone already made. */
function Action({ id }: { id: number }) {
  const r = requests.find((x) => x.title.id === id)
  if (!r) return <button type="button" className="ls-btn">Request</button>
  const available = r.status === 'Available'
  return <span className={available ? 'ls-state ok' : 'ls-state'}>{available ? 'Available' : 'Requested'}</span>
}
