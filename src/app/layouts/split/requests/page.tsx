import type { Metadata } from 'next'
import { admin, poster, requests } from '../../data'

export const metadata: Metadata = { title: 'Split pane · Requests' }

const STATUSES = ['Requested', 'Downloading', 'Importing', 'Available', 'Stuck']

/** Made-up files for the selected Request (Severance, Downloading). */
const FILES: [name: string, size: string, done: boolean][] = [
  ['Severance - S01E01 - Good News About Hell.mkv', '1.9 GB', true],
  ['Severance - S01E02 - Half Loop.mkv', '1.8 GB', true],
  ['Severance - S01E03 - In Perpetuity.mkv', '1.8 GB', true],
  ['Severance - S01E09 - The We We Are.mkv', '2.0 GB', true],
  ['Severance - S02E01 - Hello, Ms. Cobel.mkv', '2.1 GB', false],
  ['Severance - S02E02 - Goodbye, Mrs. Selvig.mkv', '2.1 GB', false],
]

/** Requests: every Request as a compact row, the selected one (Severance, Downloading) in full. */
export default function SplitRequests() {
  const sel = requests[1]
  const dl = admin.downloads[0]
  const count = (s: string) => requests.filter((r) => r.status === s).length
  return (
    <>
      <section className="list" aria-label="Requests">
        <div className="list-top">
          <input className="search" type="search" placeholder="Filter Requests…" />
          <div className="chips">
            <button type="button" className="chip on">All<small>{requests.length}</small></button>
            {STATUSES.map((s) => <button key={s} type="button" className="chip">{s}<small>{count(s)}</small></button>)}
          </div>
        </div>
        {requests.map((r) => (
          <button key={r.id} type="button" className={r === sel ? 'row is-selected' : 'row'} aria-pressed={r === sel}>
            <span className="thumb" style={poster(r.title.hue)} />
            <span className="row-text">
              <b>{r.title.title}</b>
              <small>{r.detail} · {r.requestedBy} · {r.requestedAgo}</small>
              {(r.status === 'Downloading' || r.status === 'Importing') && <span className={`line ${r.status.toLowerCase()}`}><i style={{ width: `${r.progress}%` }} /></span>}
            </span>
            <span className={`dot ${r.status.toLowerCase()}`} title={r.status} />
          </button>
        ))}
      </section>
      <section className="detail" aria-label="Selected Request">
        <div className="toolbar">
          <span className="crumb">Requests › {sel.title.title}</span>
          <button type="button" className="tb">Remove</button>
          <button type="button" className="tb">Search again</button>
          <button type="button" className="tb" disabled>Open in Plex</button>
        </div>
        <div className="body">
          <div className="hero small">
            <div className="poster" style={poster(sel.title.hue)} />
            <div>
              <h1>{sel.title.title}</h1>
              <p className="meta">{sel.title.year} · {sel.title.type} · {sel.detail} · <b className="status-tag"><span className={`dot ${sel.status.toLowerCase()}`} />{sel.status}</b></p>
              <div className="genres">{sel.title.genres.map((g) => <span key={g} className="genre">{g}</span>)}</div>
            </div>
          </div>
          <div className="sec">
            <h2 className="lbl">Status</h2>
            <div className="big"><i style={{ width: `${sel.progress}%` }} /></div>
            <p>{sel.status} {sel.progress}%: {(sel.sizeGb * sel.progress / 100).toFixed(1)} GB of {sel.sizeGb} GB at {dl.speedMbs} MB/s from {dl.seeds} seeders, about {dl.eta} left.</p>
          </div>
          <div className="sec">
            <h2 className="lbl">Request log</h2>
            <ol className="tl">
              <li><b>Requested</b><small>{sel.requestedAgo} · by {sel.requestedBy} · {sel.detail}</small></li>
              <li><b>Found 3 releases</b><small>Best fit: Severance.S01-S02.1080p.WEB-DL.H.264, {sel.sizeGb} GB, {dl.seeds} seeders</small></li>
              <li><b>Grabbed</b><small>4 h ago · sent to qBittorrent</small></li>
              <li className="now"><b>Downloading {sel.progress}%</b><small>now · {dl.speedMbs} MB/s · about {dl.eta} left</small></li>
            </ol>
          </div>
          <div className="sec">
            <h2 className="lbl">Files</h2>
            <table className="tbl">
              <thead><tr><th>File</th><th className="num">Size</th><th>State</th></tr></thead>
              <tbody>
                {FILES.map(([name, size, done]) => (
                  <tr key={name} className={done ? undefined : 'pending'}><td className="file">{name}</td><td className="num">{size}</td><td>{done ? 'Downloaded' : 'Waiting'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sec">
            <h2 className="lbl">Details</h2>
            <div className="pairs">
              <span>Requested by</span><span>{sel.requestedBy}</span>
              <span>When</span><span>{sel.requestedAgo}</span>
              <span>Size</span><span>{sel.sizeGb} GB</span>
              <span>Media Type</span><span>{sel.title.type}</span>
              <span>Asked for</span><span>{sel.detail}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
