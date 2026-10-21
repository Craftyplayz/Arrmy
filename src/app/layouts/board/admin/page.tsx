import type { Metadata } from 'next'
import Link from 'next/link'
import { admin } from '../../data'
import { Avatar } from '../bits'

export const metadata: Metadata = { title: 'Board · Admin' }

const TILES: [label: string, n: number][] = [
  ['Requested', admin.counts.requested],
  ['Downloading', admin.counts.downloading],
  ['Importing', admin.counts.importing],
  ['Available', admin.counts.available],
  ['Stuck', admin.counts.stuck],
]

export default function BoardAdmin() {
  const up = admin.services.filter((s) => s.ok).length
  return (
    <>
      <div className="lb-toolbar">
        <h1>Operations board</h1>
        <span className="lb-hint">Refreshes every 30 s · <kbd>R</kbd> refresh now</span>
      </div>

      <div className="lb-stats">
        {TILES.map(([label, n]) => (
          <Link key={label} href="/layouts/board/requests" className={`lb-stat st-${label.toLowerCase()}`}><i /><b>{n}</b><span>{label}</span></Link>
        ))}
        {admin.disks.map((d) => {
          const pct = Math.round((d.usedTb / d.totalTb) * 100)
          return (
            <div key={d.name} className={pct > 90 ? 'lb-stat disk warn' : 'lb-stat disk'}>
              <span>{d.name} disk</span>
              <div className="lb-bar"><i style={{ width: `${pct}%` }} /></div>
              <small>{d.usedTb} of {d.totalTb} TB used</small>
            </div>
          )
        })}
      </div>

      <div className="lb-board ops">
        <section className="lb-col st-stuck">
          <header className="lb-col-head"><i /><h2>Needs fixing</h2><span className="lb-count">{admin.problems.length}</span></header>
          <div className="lb-col-body">
            {admin.problems.map((p) => (
              <article key={p.title} className="lb-card">
                <b>{p.title}</b>
                <p className="lb-meta">{p.what}</p>
                <footer className="lb-card-foot"><button type="button" className="lb-btn danger">{p.fix}</button></footer>
              </article>
            ))}
          </div>
        </section>

        <section className="lb-col st-downloading">
          <header className="lb-col-head"><i /><h2>Downloading now</h2><span className="lb-count">{admin.downloads.length}</span></header>
          <div className="lb-col-body">
            {admin.downloads.map((d) => (
              <article key={d.title} className="lb-card">
                <b>{d.title}</b>
                <div className="lb-progress">
                  <div className="lb-bar"><i style={{ width: `${d.progress}%` }} /></div>
                  <span>{d.progress}% · {d.speedMbs} MB/s · ETA {d.eta} · {d.seeds} seeds</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="lb-col st-services">
          <header className="lb-col-head"><i /><h2>Services</h2><span className="lb-count">{up}/{admin.services.length}</span></header>
          <div className="lb-col-body">
            {admin.services.map((s) => (
              <article key={s.name} className="lb-card service">
                <i className={s.ok ? 'lb-dot' : 'lb-dot bad'} />
                <b>{s.name}</b>
                <span className="lb-meta">{s.ok ? `v${s.version}` : 'No connection'}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="lb-panel">
        <div className="lb-panel-head"><h2>Requesters</h2><span className="lb-hint">{admin.requesters.length} people</span></div>
        <table className="lb-table">
          <thead><tr><th>Requester</th><th className="num">Requests</th><th>Role</th><th /></tr></thead>
          <tbody>
            {admin.requesters.map((p) => (
              <tr key={p.name}>
                <td><Avatar name={p.name} />{p.name}</td>
                <td className="num">{p.requests}</td>
                <td>{p.admin ? 'Admin' : 'Requester'}</td>
                <td className="num"><Link href="/layouts/board/requests" className="lb-btn">Open Requests</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
