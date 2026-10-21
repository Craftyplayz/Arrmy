import type { Metadata } from 'next'
import { admin } from '../../data'
import { dayName, TODAY } from '../events'

export const metadata: Metadata = { title: 'Calendar · Admin' }

/** Mon 19 to Sun 25 Oct: what happened (or is due) each day, as dot classes. */
const WEEK: [day: number, dots: string[]][] = [
  [19, ['st-available', 'st-available']],
  [20, ['st-available']],
  [21, ['st-available', 'st-available', 'st-stuck', 'st-stuck', 'st-importing']],
  [22, []],
  [23, ['tv']],
  [24, ['mv']],
  [25, []],
]

export default function CalendarAdmin() {
  return (
    <>
      <div className="lc-toolbar">
        <h1>Admin</h1>
        <p>What needs fixing, what&apos;s downloading and how full the disks are.</p>
      </div>
      <div className="lc-week">
        {WEEK.map(([d, dots]) => (
          <div key={d} className={d === TODAY ? 'is-today' : undefined}>
            <small>{dayName(d)}</small>
            <b>{d}</b>
            <div className="lc-dots">{dots.map((c, i) => <i key={i} className={`lc-dot ${c}`} />)}</div>
          </div>
        ))}
      </div>
      <ul className="lc-key">
        <li className="st-available"><i className="lc-dot" />Download finished</li>
        <li className="st-stuck"><i className="lc-dot" />Problem</li>
        <li className="st-importing"><i className="lc-dot" />Stuck</li>
        <li className="tv"><i className="lc-dot" />Release date (Media Type colour)</li>
      </ul>
      <div className="lc-admin">
        <div>
          <section className="lc-sec">
            <h2><i className="lc-dot st-stuck" />Needs fixing <span className="n">{admin.problems.length}</span></h2>
            {admin.problems.map((p) => (
              <div key={p.title} className="lc-op st-stuck">
                <div><b>{p.title}</b><small>{p.what}</small></div>
                <button type="button" className="lc-btn">{p.fix}</button>
              </div>
            ))}
          </section>
          <section className="lc-sec">
            <h2><i className="lc-dot st-downloading" />Downloading now <span className="n">{admin.downloads.length}</span></h2>
            {admin.downloads.map((d) => (
              <div key={d.title} className="lc-op st-downloading">
                <div>
                  <b>{d.title}</b>
                  <small>{d.speedMbs} MB/s · {d.eta} left · {d.seeds} seeds</small>
                  <div className="lc-bar"><i style={{ width: `${d.progress}%` }} /></div>
                </div>
                <b className="lc-pct">{d.progress}%</b>
              </div>
            ))}
          </section>
          <section className="lc-sec">
            <h2>Requesters <span className="n">{admin.requesters.length}</span></h2>
            <table className="lc-table">
              <thead><tr><th>Name</th><th className="num">Requests</th><th>Role</th></tr></thead>
              <tbody>
                {admin.requesters.map((r) => (
                  <tr key={r.name}><td>{r.name}</td><td className="num">{r.requests}</td><td>{r.admin ? 'Admin' : 'Requester'}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        <div>
          <section className="lc-sec">
            <h2>Disks</h2>
            {admin.disks.map((d) => {
              const pct = Math.round((d.usedTb / d.totalTb) * 100)
              return (
                <div key={d.name} className={`lc-disk ${pct >= 80 ? 'st-importing' : 'st-downloading'}`}>
                  <span>{d.name}<small>{d.usedTb} of {d.totalTb} TB · {pct}%</small></span>
                  <div className="lc-bar"><i style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
          </section>
          <section className="lc-sec">
            <h2>Services <span className="n">{admin.services.filter((s) => s.ok).length} of {admin.services.length} up</span></h2>
            <ul className="lc-svc">
              {admin.services.map((s) => (
                <li key={s.name} className={s.ok ? 'st-available' : 'st-stuck'}><i className="lc-dot" />{s.name}<small>{s.ok ? s.version : 'not responding'}</small></li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
