import type { Metadata } from 'next'
import Link from 'next/link'
import { admin, poster, recentlyAdded, requests, searchResults, titles, trending } from '../data'
import { Avatar, Magnifier, StatusPill } from './bits'

export const metadata: Metadata = { title: 'Tiles · Home' }

const featured = titles[0]
const STATS: [label: string, n: number, sub: string][] = [
  ['Downloading', admin.counts.downloading, 'Moving right now'],
  ['Stuck', admin.counts.stuck, 'Needs the Admin'],
  ['Available', admin.counts.available, 'In Plex already'],
]

export default function TilesHome() {
  return (
    <div className="t-home">
      <section className="tile t-hero" style={poster(featured.hue)} aria-label="Featured">
        <div className="t-hero-in">
          <span className="t-kicker">Featured · New this week</span>
          <h2>{featured.title}</h2>
          <div className="t-meta"><span>{featured.year}</span><span>{featured.type}</span><span>{featured.runtime}</span><span>★ {featured.rating}</span><span>{featured.genres.join(' · ')}</span></div>
          <p>{featured.overview}</p>
          <div className="t-actions"><button type="button" className="t-btn primary">Request</button><button type="button" className="t-btn">Open in Plex</button></div>
          <div className="t-poster t-hero-poster" style={poster(featured.hue)} />
        </div>
      </section>

      <section className="tile t-find">
        <h2 className="t-h">Search</h2>
        <label className="t-input"><Magnifier /><input type="search" placeholder="Movies, TV shows, audiobooks…" defaultValue="the" /></label>
        <p className="t-sub">Media Type</p>
        <div className="t-pills">{['All', 'Movie', 'TV Show', 'Audiobook'].map((m, i) => <button key={m} type="button" className={i === 0 ? 't-pill on' : 't-pill'}>{m}</button>)}</div>
        <p className="t-sub">Results</p>
        <div className="t-rows">
          {searchResults.slice(0, 4).map(t => (
            <div key={t.id} className="t-row"><div className="t-poster" style={poster(t.hue)} /><span className="grow"><b>{t.title}</b><small>{t.year} · {t.type}</small></span><button type="button" className="t-btn small primary">Request</button></div>
          ))}
        </div>
      </section>

      <section className="tile t-trend">
        <h2 className="t-h">Trending this week</h2>
        <div className="t-strip">{trending.map(t => <div key={t.id} className="t-cap"><div className="t-poster" style={poster(t.hue)} /><b>{t.title}</b><small>{t.year} · {t.type}</small></div>)}</div>
      </section>

      <section className="tile t-recent">
        <h2 className="t-h">Recently added</h2>
        <div className="t-strip">{recentlyAdded.map(t => <div key={t.id} className="t-cap"><div className="t-poster" style={poster(t.hue)}><span className="t-st available">Available</span></div><b>{t.title}</b><small>{t.year} · {t.type}</small></div>)}</div>
      </section>

      <section className="tile t-mine">
        <h2 className="t-h">Your Requests <span className="n">{requests.length}</span><Link className="more" href="/layouts/tiles/requests">See all →</Link></h2>
        <div className="t-rows">
          {requests.slice(0, 3).map(r => (
            <div key={r.id} className="t-row">
              <div className="t-poster" style={poster(r.title.hue)} />
              <span className="grow"><b>{r.title.title}</b><small>{r.detail} · {r.requestedAgo}</small></span>
              <Avatar name={r.requestedBy} />
              <StatusPill status={r.status} progress={r.status === 'Downloading' ? r.progress : undefined} />
            </div>
          ))}
        </div>
      </section>

      {STATS.map(([label, n, sub], i) => (
        <div key={label} className={`tile t-stat ${label.toLowerCase()}`} style={{ gridArea: `s${i + 1}` }}><b>{n}</b><span>{label}</span><small>{sub}</small></div>
      ))}
    </div>
  )
}
