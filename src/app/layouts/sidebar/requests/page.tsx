import type { Metadata } from 'next'
import { poster, requests } from '../../data'

export const metadata: Metadata = { title: 'Sidebar · Requests' }

const COLS = ['Title', 'Media Type', 'Requested by', 'When', 'Detail', 'Size', 'Status', 'Progress']

export default function RequestsPage() {
  return (
    <>
      <div className="head">
        <h1>Requests</h1>
        <span className="sub">{requests.length} Requests, newest first</span>
        <button type="button" className="b p">New Request</button>
      </div>

      <section className="panel">
        <div className="toolbar">
          <label>Status
            <select className="field" defaultValue="all">
              <option value="all">All</option><option>Requested</option><option>Downloading</option><option>Importing</option><option>Available</option><option>Stuck</option>
            </select>
          </label>
          <label>Media Type
            <select className="field" defaultValue="all">
              <option value="all">All</option><option>Movie</option><option>TV Show</option><option>Audiobook</option>
            </select>
          </label>
          <label>Requester
            <select className="field" defaultValue="all">
              <option value="all">Everyone</option><option>Crafty</option><option>Sam</option><option>Jo</option><option>Alex</option>
            </select>
          </label>
          <span className="count">Showing 1–{requests.length} of {requests.length}</span>
        </div>

        <table className="tbl">
          <thead>
            <tr>{COLS.map((c) => <th key={c} className={c === 'When' ? 'sorted' : c === 'Size' ? 'num' : undefined}>{c}<i>{c === 'When' ? '▼' : '↕'}</i></th>)}</tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td><div className="t"><div className="thumb" style={poster(r.title.hue)} /><span><b>{r.title.title}</b><small>{r.title.year}</small></span></div></td>
                <td>{r.title.type}</td>
                <td>{r.requestedBy}</td>
                <td>{r.requestedAgo}</td>
                <td>{r.detail}</td>
                <td className="num">{r.sizeGb ? `${r.sizeGb.toFixed(1)} GB` : '—'}</td>
                <td><span className={`st tone-${r.status.toLowerCase()}`}>{r.status}</span></td>
                <td><div className="prog"><div className="bar"><i style={{ width: `${r.progress}%` }} /></div><small>{r.progress}%</small></div></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pager">
          <label>Rows per page
            <select className="field" defaultValue="25"><option>25</option><option>50</option><option>100</option></select>
          </label>
          <span className="count">1–{requests.length} of {requests.length}</span>
          <button type="button" className="b" disabled>‹ Previous</button>
          <button type="button" className="b" disabled>Next ›</button>
        </div>
      </section>
    </>
  )
}
