import type { Metadata } from 'next'
import { admin } from '../../data'

export const metadata: Metadata = { title: 'Search first · Admin' }

export default function Admin() {
  const c = admin.counts
  return (
    <div className="ls-col">
      <h1 className="ls-h1">Admin</h1>
      <p className="ls-sum">{c.downloading} downloading, {c.importing} importing, {c.requested} waiting, {c.stuck} stuck · {c.available} Available</p>

      <section className="ls-group">
        <h2>Needs fixing <span>{admin.problems.length}</span></h2>
        {admin.problems.map((p) => (
          <div key={p.title} className="ls-row">
            <div className="ls-main"><b>{p.title}</b><p className="ls-sub">{p.what}</p></div>
            <button type="button" className="ls-btn quiet">{p.fix}</button>
          </div>
        ))}
      </section>

      <section className="ls-group">
        <h2>Downloading now <span>{admin.downloads.length}</span></h2>
        {admin.downloads.map((d) => (
          <div key={d.title} className="ls-row">
            <div className="ls-main">
              <b>{d.title}</b>
              <p className="ls-sub">{d.speedMbs} MB/s · {d.eta} left · {d.seeds} seeds</p>
              <div className="ls-line"><i style={{ width: `${d.progress}%` }} /></div>
            </div>
            <span className="ls-pct">{d.progress}%</span>
          </div>
        ))}
      </section>

      <section className="ls-group">
        <h2>Disks</h2>
        <div className="ls-disks">
          {admin.disks.map((d) => {
            const pct = Math.round((d.usedTb / d.totalTb) * 100)
            return (
              <div key={d.name} className="ls-disk">
                <b>{d.name}</b>
                <small>{d.usedTb} of {d.totalTb} TB · {pct}% full</small>
                <div className="ls-line"><i style={{ width: `${pct}%` }} /></div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="ls-group">
        <h2>Services</h2>
        {admin.services.map((s) => (
          <div key={s.name} className="ls-row">
            <i className={s.ok ? 'ls-dot ok' : 'ls-dot bad'} />
            <b>{s.name}</b>
            <span className="ls-sub">{s.ok ? s.version : 'Not responding'}</span>
          </div>
        ))}
      </section>

      <section className="ls-group">
        <h2>Requesters</h2>
        {admin.requesters.map((p) => (
          <div key={p.name} className="ls-row">
            <span className="ls-avatar">{p.name[0]}</span>
            <b>{p.name}{p.admin && <span className="ls-tag">Admin</span>}</b>
            <span className="ls-sub">{p.requests} {p.requests === 1 ? 'Request' : 'Requests'}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
