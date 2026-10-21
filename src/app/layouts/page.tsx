import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import './layouts.css'

export const metadata: Metadata = { title: 'Layouts' }

// Made-up titles: these mockups only show shape, nothing here is live.
const TITLES: [title: string, year: number, hue: number, status: string][] = [
  ['Dune: Part Two', 2024, 30, 'Available'],
  ['Severance', 2022, 200, 'Downloading'],
  ['The Bear', 2022, 10, 'Requested'],
  ['Arrival', 2016, 220, 'Available'],
  ['Shōgun', 2024, 350, 'Importing'],
  ['Project Hail Mary', 2021, 140, 'Downloading'],
  ['Andor', 2022, 260, 'Available'],
  ['Past Lives', 2023, 300, 'Requested'],
]

const poster = (hue: number) => ({ background: `linear-gradient(160deg, hsl(${hue} 55% 42%), hsl(${hue + 40} 45% 18%))` })
const tone = (status: string) => `mk-st mk-st-${status.toLowerCase()}`

const LAYOUTS: [id: string, name: string, how: string, mock: React.ReactNode][] = [
  ['streaming', 'A. Streaming', 'Looks like Plex or Netflix. A big banner up top, then rows of posters you scroll sideways: your Requests, what is trending, what just became Available.', <Streaming key="a" />],
  ['sidebar', 'B. Sidebar dashboard', 'A fixed menu down the left, search across the top, and the Requests as a table with counts above it. Fast to scan, feels like the *arr apps.', <Sidebar key="b" />],
  ['search', 'C. Search first', 'One big search box and nothing else until you type. Results come as a plain list with a Request button on each. Requests live on their own page.', <SearchFirst key="c" />],
  ['board', 'D. Board', 'Every Request is a card that moves across columns as it goes from Requested to Available. You see where everything is stuck at a glance.', <Board key="d" />],
  ['phone', 'E. Phone app', 'Built for phones first: tabs along the bottom, big tap targets, one column of cards. On a computer it stays a narrow centred column.', <Phone key="e" />],
]

export default async function LayoutsPage() {
  const user = await requireUser()
  if (!user.is_admin) redirect('/')
  return (
    <>
      <h1 className="page-title">Layouts</h1>
      <p className="page-lede">Five ways Arrmy could look. They are pictures only: nothing on them works. Pick one and say what to change.</p>
      <nav className="mk-jump" aria-label="Layouts">
        {LAYOUTS.map(([id, name]) => <a key={id} href={`#${id}`}>{name}</a>)}
      </nav>
      {LAYOUTS.map(([id, name, how, mock]) => (
        <section key={id} id={id} className="mk-section">
          <h2>{name}</h2>
          <p className="mk-how">{how}</p>
          <div className="mk-frame" aria-hidden="true" inert>{mock}</div>
        </section>
      ))}
    </>
  )
}

function Streaming() {
  return (
    <div className="mk mk-a">
      <div className="mk-a-top"><b>Arrmy</b><span>Home</span><span>Movies</span><span>TV Shows</span><span>Audiobooks</span><span className="mk-a-search">Search</span></div>
      <div className="mk-a-hero" style={poster(25)}>
        <small>Just became Available</small>
        <h3>Dune: Part Two</h3>
        <p>2024 · Movie · 2h 46m</p>
        <span className="mk-btn">Open in Plex</span>
      </div>
      {['Your Requests', 'Trending this week'].map((row, r) => (
        <div key={row} className="mk-a-row">
          <h4>{row}</h4>
          <div className="mk-a-strip">
            {TITLES.slice(r * 2).concat(TITLES.slice(0, r * 2)).map(([t, , hue, s]) => (
              <div key={t} className="mk-a-card"><div className="mk-poster" style={poster(hue)} />{r === 0 && <span className={tone(s)}>{s}</span>}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Sidebar() {
  return (
    <div className="mk mk-b">
      <aside><b>Arrmy</b>{['Search', 'Requests', 'Downloads', 'Admin', 'Settings'].map((l, i) => <span key={l} className={i === 1 ? 'on' : ''}>{l}</span>)}</aside>
      <div className="mk-b-main">
        <div className="mk-b-bar"><span className="mk-field">Search movies, shows, audiobooks…</span><span className="mk-b-user">Crafty</span></div>
        <div className="mk-b-tiles">
          {[['Requested', 2], ['Downloading', 2], ['Importing', 1], ['Available', 3]].map(([l, n]) => <div key={l}><b>{n}</b><small>{l}</small></div>)}
        </div>
        <table>
          <thead><tr><th>Title</th><th>Year</th><th>Status</th><th>Progress</th></tr></thead>
          <tbody>
            {TITLES.map(([t, y, , s], i) => (
              <tr key={t}><td>{t}</td><td>{y}</td><td><span className={tone(s)}>{s}</span></td><td><div className="mk-bar"><i style={{ width: s === 'Available' ? '100%' : s === 'Requested' ? '0%' : `${30 + i * 8}%` }} /></div></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SearchFirst() {
  return (
    <div className="mk mk-c">
      <div className="mk-c-top"><span>Requests</span><span>Crafty</span></div>
      <b className="mk-c-logo">Arrmy</b>
      <div className="mk-c-box">project hail</div>
      <div className="mk-c-tabs"><span className="on">All</span><span>Movies</span><span>TV Shows</span><span>Audiobooks</span></div>
      <ul>
        {TITLES.slice(4, 8).map(([t, y, hue, s]) => (
          <li key={t}><div className="mk-poster" style={poster(hue)} /><div><b>{t}</b><small>{y} · {hue > 200 ? 'TV Show' : 'Movie'}</small></div>{s === 'Requested' ? <span className="mk-btn">Request</span> : <span className={tone(s)}>{s}</span>}</li>
        ))}
      </ul>
    </div>
  )
}

function Board() {
  const cols = ['Requested', 'Downloading', 'Importing', 'Available']
  return (
    <div className="mk mk-d">
      <div className="mk-d-top"><b>Arrmy</b><span className="mk-field">Search to add a Request…</span></div>
      <div className="mk-d-cols">
        {cols.map(c => (
          <div key={c} className="mk-d-col">
            <h4>{c} <small>{TITLES.filter(t => t[3] === c).length}</small></h4>
            {TITLES.filter(t => t[3] === c).map(([t, y, hue]) => (
              <div key={t} className="mk-d-card"><div className="mk-poster" style={poster(hue)} /><div><b>{t}</b><small>{y}</small>{c === 'Downloading' && <div className="mk-bar"><i style={{ width: '55%' }} /></div>}</div></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Phone() {
  return (
    <div className="mk mk-e">
      <div className="mk-e-phone">
        <div className="mk-e-head"><b>Requests</b><small>8 this month</small></div>
        <div className="mk-e-list">
          {TITLES.slice(0, 5).map(([t, y, hue, s]) => (
            <div key={t} className="mk-e-card"><div className="mk-poster" style={poster(hue)} /><div><b>{t}</b><small>{y}</small><span className={tone(s)}>{s}</span></div></div>
          ))}
        </div>
        <div className="mk-e-tabs">{['Search', 'Requests', 'Downloads', 'Me'].map((l, i) => <span key={l} className={i === 1 ? 'on' : ''}><i />{l}</span>)}</div>
      </div>
    </div>
  )
}
