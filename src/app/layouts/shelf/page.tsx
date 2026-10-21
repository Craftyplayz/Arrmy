import type { Metadata } from 'next'
import { poster, recentlyAdded, requests, searchResults, titles, trending, user } from '../data'

export const metadata: Metadata = { title: 'Shelf · Home' }

const MEDIA = ['All', 'Movie', 'TV Show', 'Audiobook']
const flow = trending.slice(0, 7)
const star = flow[3] // the cover facing forward in the middle of the row
const mine = requests.filter((r) => r.requestedBy === user.username)
const books = titles.filter((t) => t.type === 'Audiobook')
const narrator = (overview: string) => overview.match(/Narrated by ([^.]+)/)?.[1] ?? ''

export default function ShelfHome() {
  return (
    <>
      <section className="hero">
        <h2>Now showing</h2>
        <div className="flow">
          {flow.map((t) => <div key={t.id} className="cover" style={poster(t.hue)}><b>{t.title}</b></div>)}
        </div>
        <div className="plank" />
        <div className="star">
          <h1>{star.title} <small>{star.year}</small></h1>
          <p className="meta">{star.type} · {star.runtime} · ★ {star.rating} · {star.genres.join(', ')}</p>
          <p>{star.overview}</p>
          <button type="button" className="btn primary">Request</button>
        </div>
      </section>

      <section className="shelf">
        <h2>Search <small>{searchResults.length} results for “the”</small></h2>
        <div className="search">
          <div className="tabs">{MEDIA.map((m, i) => <button key={m} type="button" className={i === 0 ? 'tab is-active' : 'tab'}>{m}</button>)}</div>
          <input className="field" type="search" defaultValue="the" aria-label="Search" />
        </div>
        <div className="row">
          {searchResults.map((t) => {
            const r = requests.find((x) => x.title.id === t.id)
            return (
              <div key={t.id} className="item">
                <div className="cover" style={poster(t.hue)}><b>{t.title}</b></div>
                <div className="plank" />
                <div className="cap">
                  <b>{t.title}</b>
                  <span>{t.year} · {t.type}</span>
                  {r ? <span className={`pill-st st-${r.status.toLowerCase()}`}>{r.status}</span> : <button type="button" className="btn primary small">Request</button>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="shelf">
        <h2>Your Requests <small>{mine.length}</small></h2>
        <div className="row">
          {mine.map((r) => (
            <div key={r.id} className="item">
              <div className="cover" style={poster(r.title.hue)}>
                <i className="corner"><span className={`ribbon st-${r.status.toLowerCase()}`}>{r.status}</span></i>
                <b>{r.title.title}</b>
              </div>
              <div className="plank" />
              <div className="cap"><b>{r.title.title}</b><span>{r.detail} · {r.requestedAgo}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="shelf">
        <h2>Recently added <small>new on Plex</small></h2>
        <div className="row">
          {recentlyAdded.map((t) => (
            <div key={t.id} className="item">
              <div className="cover" style={poster(t.hue)}><i className="new">New</i><b>{t.title}</b></div>
              <div className="plank" />
              <div className="cap"><b>{t.title}</b><span>{t.year} · {t.type}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="shelf">
        <h2>Audiobooks</h2>
        <div className="row books">
          {books.map((t) => (
            <div key={t.id} className="item">
              <div className="cover book" style={poster(t.hue)}><b>{t.title}</b></div>
              <div className="plank" />
              <div className="cap"><b>{t.title}</b><span>Narrated by {narrator(t.overview)}</span><span>{t.runtime} · ★ {t.rating}</span></div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
