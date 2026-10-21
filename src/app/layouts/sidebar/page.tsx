import type { Metadata } from 'next'
import { admin, poster, recentlyAdded, requests, searchResults } from '../data'

export const metadata: Metadata = { title: 'Sidebar · Home' }

const COUNTS: [key: keyof typeof admin.counts, label: string][] = [
  ['requested', 'Requested'],
  ['downloading', 'Downloading'],
  ['importing', 'Importing'],
  ['available', 'Available'],
  ['stuck', 'Stuck'],
]

export default function HomePage() {
  return (
    <>
      <div className="head">
        <h1>Home</h1>
        <span className="sub">Search for something to Request</span>
      </div>

      <div className="panel search-panel">
        <input className="field big" type="search" defaultValue="the" placeholder="Title, or a TMDB or TheTVDB link" />
        <div className="chips">
          {['All', 'Movie', 'TV Show', 'Audiobook'].map((c, i) => (
            <button key={c} type="button" className={i === 0 ? 'chip on' : 'chip'}>{c}</button>
          ))}
        </div>
        <button type="button" className="b p">Search</button>
      </div>

      <div className="tiles">
        {COUNTS.map(([key, label]) => (
          <div key={key} className={`tile tone-${key}`}><b>{admin.counts[key]}</b><span>{label}</span></div>
        ))}
      </div>

      <section className="panel">
        <h2>Search results <span className="n">{searchResults.length} for “the”</span></h2>
        <table className="tbl">
          <thead>
            <tr><th></th><th>Title</th><th className="num">Year</th><th>Media Type</th><th className="num">Rating</th><th>Genres</th><th>Runtime</th><th></th></tr>
          </thead>
          <tbody>
            {searchResults.map((t) => {
              const r = requests.find((x) => x.title.id === t.id) // already a Request: show its status instead of a button
              return (
                <tr key={t.id}>
                  <td><div className="thumb" style={poster(t.hue)} /></td>
                  <td><b>{t.title}</b><small className="over">{t.overview}</small></td>
                  <td className="num">{t.year}</td>
                  <td>{t.type}</td>
                  <td className="num">{t.rating}</td>
                  <td>{t.genres.join(', ')}</td>
                  <td>{t.runtime}</td>
                  <td className="act">{r ? <span className={`st tone-${r.status.toLowerCase()}`}>{r.status}</span> : <button type="button" className="b p">Request</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Recently added <span className="n">Available on Plex</span></h2>
        <div className="strip">
          {recentlyAdded.map((t) => (
            <div key={t.id} className="mini">
              <div className="poster" style={poster(t.hue)} />
              <b>{t.title}</b>
              <small>{t.year} · {t.type}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
