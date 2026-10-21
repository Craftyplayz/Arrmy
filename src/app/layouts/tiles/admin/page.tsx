import type { Metadata } from 'next'
import { admin } from '../../data'
import { Avatar } from '../bits'

export const metadata: Metadata = { title: 'Tiles · Admin' }

const COUNTS: [label: string, n: number][] = [
  ['Downloading', admin.counts.downloading],
  ['Importing', admin.counts.importing],
  ['Requested', admin.counts.requested],
  ['Available', admin.counts.available],
]
const most = Math.max(...admin.requesters.map(r => r.requests))

export default function TilesAdmin() {
  return (
    <>
      <h1 className="t-page">Admin</h1>
      <div className="t-admin">
        <section className="tile t-fix">
          <h2 className="t-h">Needs fixing <span className="n">{admin.problems.length}</span></h2>
          <div className="t-rows">
            {admin.problems.map(p => (
              <div key={p.title} className="t-prob"><span className="grow"><b>{p.title}</b><span>{p.what}</span></span><button type="button" className="t-btn">{p.fix}</button></div>
            ))}
          </div>
          <p className="t-dim">Stuck Requests land here with a one-click fix. Missing shows go to Discord instead.</p>
        </section>

        {COUNTS.map(([label, n], i) => (
          <div key={label} className={`tile t-stat ${label.toLowerCase()}`} style={{ gridArea: `c${i + 1}` }}><b>{n}</b><span>{label}</span></div>
        ))}

        {admin.disks.map((d, i) => {
          const p = Math.round((d.usedTb / d.totalTb) * 100)
          return (
            <section key={d.name} className="tile t-disk" style={{ gridArea: `d${i + 1}` }}>
              <Gauge p={p} warn={p >= 90} />
              <b>{d.name}</b>
              <small>{(d.totalTb - d.usedTb).toFixed(1)} TB free of {d.totalTb} TB</small>
            </section>
          )
        })}

        <section className="tile t-dl">
          <h2 className="t-h">Downloading now <span className="n">{admin.downloads.length}</span></h2>
          {admin.downloads.map(d => (
            <div key={d.title} className="t-dl-row">
              <div className="t-dl-head"><b>{d.title}</b><small>{d.speedMbs} MB/s · {d.eta} left · {d.seeds} seeds</small><span className="pct">{d.progress}%</span></div>
              <div className="t-bar big"><i style={{ width: `${d.progress}%` }} /></div>
            </div>
          ))}
        </section>

        <section className="tile t-svc">
          <h2 className="t-h">Services</h2>
          <div className="t-svc-grid">
            {admin.services.map(s => (
              <div key={s.name} className="t-svc-item"><span className={s.ok ? 't-dot' : 't-dot down'} /><span><b>{s.name}</b><small>{s.ok ? s.version : 'Not responding'}</small></span></div>
            ))}
          </div>
        </section>

        <section className="tile t-people">
          <h2 className="t-h">Requesters <span className="n">{admin.requesters.length}</span></h2>
          {admin.requesters.map(r => (
            <div key={r.name} className="t-person">
              <Avatar name={r.name} big />
              <span className="grow"><b>{r.name} {r.admin && <span className="t-tag">Admin</span>}</b><span className="t-bar"><i style={{ width: `${(r.requests / most) * 100}%` }} /></span></span>
              <span className="t-num">{r.requests}<small>Requests</small></span>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}

/** A percentage ring, like the site's Ring but drawn in SVG so the arc can glow. */
function Gauge({ p, warn }: { p: number; warn?: boolean }) {
  const r = 54
  const c = 2 * Math.PI * r
  return (
    <svg className="t-gauge" viewBox="0 0 128 128" role="img" aria-label={`${p}% used`}>
      <circle className="t-gauge-track" cx="64" cy="64" r={r} />
      <circle className={warn ? 't-gauge-arc warn' : 't-gauge-arc'} cx="64" cy="64" r={r} strokeDasharray={`${(p / 100) * c} ${c}`} />
      <text className="t-gauge-txt" x="64" y="64">{p}<tspan>%</tspan></text>
    </svg>
  )
}
