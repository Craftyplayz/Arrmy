import type { Metadata } from 'next'
import { admin } from '../../data'

export const metadata: Metadata = { title: 'Streaming · Admin' }

const COUNTS: [label: string, key: keyof typeof admin.counts, hint: string][] = [
  ['Requested', 'requested', 'Not downloading yet'],
  ['Downloading', 'downloading', ''],
  ['Importing', 'importing', 'Moving into Plex'],
  ['Available', 'available', 'In Plex'],
  ['Stuck', 'stuck', 'Needs the Admin'],
]

export default function StreamingAdmin() {
  const down = admin.downloads.reduce((s, d) => s + d.speedMbs, 0).toFixed(1)
  const offline = admin.services.filter((s) => !s.ok)
  return (
    <div className="st-page">
      <h1>Admin</h1>
      <p className="st-lede">What needs fixing, what's downloading and how full the disks are.</p>
      <div className="st-stats">
        {COUNTS.map(([label, key, hint]) => (
          <div key={key} className={`st-stat st-${key}`}>
            <b>{admin.counts[key]}</b>
            <span>{label}</span>
            <small>{key === 'downloading' ? `Down ${down} MB/s` : hint}</small>
          </div>
        ))}
      </div>
      <div className="st-panels">
        <section className="st-panel">
          <h2>Downloading <span className="n">{admin.downloads.length}</span></h2>
          <div className="st-list">
            {admin.downloads.map((d) => (
              <div key={d.title} className="st-item">
                <b>{d.title}</b>
                <span className="st-num">{d.speedMbs} MB/s · {d.eta} left</span>
                <span className="st-track"><i style={{ width: `${d.progress}%` }} /></span>
                <small>{d.progress}% · {d.seeds} seeds</small>
              </div>
            ))}
          </div>
        </section>
        <section className="st-panel">
          <h2>Disks</h2>
          {admin.disks.map((d) => {
            const pct = Math.round((d.usedTb / d.totalTb) * 100)
            return (
              <div key={d.name} className="st-disk">
                <span><b>{d.name}</b><small>{d.usedTb} of {d.totalTb} TB · {pct}%</small></span>
                <span className={pct >= 90 ? 'st-track warn' : pct >= 75 ? 'st-track near' : 'st-track'}><i style={{ width: `${pct}%` }} /></span>
              </div>
            )
          })}
        </section>
        <section className="st-panel">
          <h2>Needs fixing <span className="n">{admin.problems.length}</span></h2>
          <div className="st-list">
            {admin.problems.map((p) => (
              <div key={p.title} className="st-item">
                <b>{p.title}</b>
                <button type="button" className="st-btn small primary">{p.fix}</button>
                <small>{p.what}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="st-panel">
          <h2>Services {offline.length > 0 && <span className="n">{offline.map((s) => s.name).join(', ')} down</span>}</h2>
          <div className="st-services">
            {admin.services.map((s) => (
              <span key={s.name} className="st-svc"><i className={s.ok ? 'st-dot' : 'st-dot off'} />{s.name}<small>{s.version}</small></span>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
