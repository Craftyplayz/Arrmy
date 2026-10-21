import type { Metadata } from 'next'
import { admin } from '../../data'

export const metadata: Metadata = { title: 'Phone app · Admin' }

const STATS: [label: string, n: number, tone: string][] = [
  ['Stuck', admin.counts.stuck, 'red'],
  ['Downloading', admin.counts.downloading, 'blue'],
  ['Importing', admin.counts.importing, 'gold'],
  ['Available', admin.counts.available, 'green'],
]
const HUES: Record<string, number> = { Crafty: 200, Sam: 30, Jo: 320, Alex: 140 }

export default function Admin() {
  return (
    <>
      <h1 className="lm-title">Admin</h1>
      <div className="lm-stats">
        {STATS.map(([label, n, tone]) => <div key={label} className={`lm-stat ${tone}`}><b>{n}</b><span>{label}</span></div>)}
      </div>

      <h2 className="lm-h2">Needs fixing <small>{admin.problems.length}</small></h2>
      <div className="lm-group">
        {admin.problems.map((p) => (
          <div key={p.title} className="lm-cell">
            <div className="lm-main"><b>{p.title}</b><span className="lm-what">{p.what}</span></div>
            <button type="button" className="lm-btn soft">{p.fix}</button>
          </div>
        ))}
      </div>

      <h2 className="lm-h2">Downloading <small>{admin.downloads.length}</small></h2>
      <div className="lm-group">
        {admin.downloads.map((d) => (
          <div key={d.title} className="lm-cell">
            <div className="lm-main">
              <b>{d.title}</b>
              <small>{d.speedMbs} MB/s · {d.eta} left · {d.seeds} seeds</small>
              <div className="lm-bar"><i style={{ width: `${d.progress}%` }} /></div>
            </div>
            <span className="lm-chip st-downloading">{d.progress}%</span>
          </div>
        ))}
      </div>

      <h2 className="lm-h2">Disks</h2>
      <div className="lm-group">
        {admin.disks.map((d) => {
          const pct = Math.round((d.usedTb / d.totalTb) * 100)
          return (
            <div key={d.name} className="lm-cell">
              <div className="lm-main">
                <b>{d.name}</b>
                <small>{d.usedTb} of {d.totalTb} TB used</small>
                <div className={pct >= 90 ? 'lm-bar warn' : 'lm-bar accent'}><i style={{ width: `${pct}%` }} /></div>
              </div>
              <span className="lm-val">{pct}%</span>
            </div>
          )
        })}
      </div>

      <h2 className="lm-h2">Services</h2>
      <div className="lm-group">
        {admin.services.map((s) => (
          <div key={s.name} className="lm-cell">
            <i className={s.ok ? 'lm-dot' : 'lm-dot off'} />
            <div className="lm-main"><b>{s.name}</b><small>{s.ok ? 'Responding' : 'Not responding'}</small></div>
            <span className="lm-val">{s.version}</span>
          </div>
        ))}
      </div>

      <h2 className="lm-h2">Requesters</h2>
      <div className="lm-group">
        {admin.requesters.map((p) => (
          <div key={p.name} className="lm-cell">
            <i className="lm-avatar" style={{ background: `hsl(${HUES[p.name] ?? 0} 55% 45%)` }}>{p.name[0]}</i>
            <div className="lm-main"><b>{p.name}</b><small>{p.requests} {p.requests === 1 ? 'Request' : 'Requests'}</small></div>
            {p.admin && <span className="lm-chip accent">Admin</span>}
          </div>
        ))}
      </div>
    </>
  )
}
