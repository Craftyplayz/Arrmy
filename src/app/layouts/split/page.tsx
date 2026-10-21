import type { Metadata } from 'next'
import { poster, requests, searchResults, trending } from '../data'

export const metadata: Metadata = { title: 'Split pane · Home' }

const TYPES = ['All', 'Movie', 'TV Show', 'Audiobook']

/** Home: search results down the list pane, the selected title filling the detail pane. */
export default function SplitHome() {
  const sel = searchResults[0]
  const seasons = sel.type === 'TV Show' ? parseInt(sel.runtime) : 0
  const status = (id: number) => requests.find((r) => r.title.id === id)?.status
  return (
    <>
      <section className="list" aria-label="Search results">
        <div className="list-top">
          <input className="search" type="search" defaultValue="the" placeholder="Search movies, TV shows and audiobooks…" />
          <div className="chips">{TYPES.map((t, i) => <button key={t} type="button" className={i === 0 ? 'chip on' : 'chip'}>{t}</button>)}</div>
        </div>
        <p className="group"><span>Results</span><span>{searchResults.length}</span></p>
        {searchResults.map((t, i) => {
          const s = status(t.id)
          return (
            <button key={t.id} type="button" className={i === 0 ? 'row is-selected' : 'row'} aria-pressed={i === 0}>
              <span className="thumb" style={poster(t.hue)} />
              <span className="row-text"><b>{t.title}</b><small>{t.year} · {t.type}</small></span>
              <span className={s ? `dot ${s.toLowerCase()}` : 'dot none'} title={s ?? 'Not requested'} />
            </button>
          )
        })}
      </section>
      <section className="detail" aria-label="Selected title">
        <div className="toolbar">
          <span className="crumb">Search › {sel.title}</span>
          <button type="button" className="tb primary">Request</button>
          <button type="button" className="tb">Open on TMDB</button>
        </div>
        <div className="body">
          <div className="hero">
            <div className="poster" style={poster(sel.hue)} />
            <div>
              <h1>{sel.title}</h1>
              <p className="meta">{sel.year} · {sel.type} · {sel.runtime} · <b>★ {sel.rating}</b></p>
              <div className="genres">{sel.genres.map((g) => <span key={g} className="genre">{g}</span>)}</div>
              <p className="overview">{sel.overview}</p>
            </div>
          </div>
          {seasons > 0 && (
            <div className="sec">
              <h2 className="lbl">Seasons</h2>
              <div className="opts">
                <label className="opt"><input type="checkbox" defaultChecked /> All seasons <small>({seasons})</small></label>
                {Array.from({ length: seasons }, (_, i) => <label key={i} className="opt"><input type="checkbox" defaultChecked /> Season {i + 1}</label>)}
              </div>
            </div>
          )}
          <div className="sec">
            <h2 className="lbl">Details</h2>
            <div className="pairs">
              <span>Media Type</span><span>{sel.type}</span>
              <span>Year</span><span>{sel.year}</span>
              <span>{sel.type === 'Movie' ? 'Runtime' : 'Length'}</span><span>{sel.runtime}</span>
              <span>Rating</span><span>{sel.rating}{sel.type === 'Audiobook' ? ' / 5' : ' / 10'}</span>
              <span>Status</span><span>{status(sel.id) ?? 'Not requested yet'}</span>
            </div>
          </div>
          <div className="sec">
            <h2 className="lbl">Similar</h2>
            <div className="strip">
              {trending.filter((t) => t.id !== sel.id).slice(0, 6).map((t) => (
                <a key={t.id} href="/layouts/split"><div className="poster" style={poster(t.hue)} /><span>{t.title}</span><small>{t.year} · {t.type}</small></a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
