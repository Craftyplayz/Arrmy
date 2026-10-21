import type { Metadata } from 'next'
import { admin, requests } from '../../data'

export const metadata: Metadata = { title: 'Sidebar · Admin' }

export default function AdminPage() {
  const { counts, disks, downloads, problems, services, requesters } = admin
  const speed = downloads.reduce((sum, d) => sum + d.speedMbs, 0).toFixed(1)
  return (
    <>
      <div className="head">
        <h1>Admin</h1>
        <span className="sub">What needs fixing, what is downloading and how full the disks are · refreshes every 30 s</span>
      </div>

      <div className="two">
        <div>
          <div className="tiles">
            <div className="tile tone-stuck"><b>{problems.length}</b><span>Problems</span><small>Need a hand</small></div>
            <div className="tile tone-stuck"><b>{counts.stuck}</b><span>Stuck</span><small>Not downloading yet</small></div>
            <div className="tile tone-downloading"><b>{counts.downloading}</b><span>Downloading</span><small>{speed} MB/s in total</small></div>
            <div className="tile tone-importing"><b>{counts.importing}</b><span>Importing</span><small>Nearly there</small></div>
            <div className="tile tone-available"><b>{counts.available}</b><span>Available</span><small>of {requests.length} Requests</small></div>
          </div>

          <section className="panel">
            <h2>Live downloads <span className="n">{downloads.length}</span></h2>
            <table className="tbl">
              <thead>
                <tr><th>Title</th><th className="num">Speed</th><th>ETA</th><th className="num">Seeds</th><th>Progress</th></tr>
              </thead>
              <tbody>
                {downloads.map((d) => (
                  <tr key={d.title}>
                    <td><b>{d.title}</b></td>
                    <td className="num">{d.speedMbs.toFixed(1)} MB/s</td>
                    <td>{d.eta}</td>
                    <td className="num">{d.seeds}</td>
                    <td><div className="prog"><div className="bar"><i style={{ width: `${d.progress}%` }} /></div><small>{d.progress}%</small></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div>
          <section className="panel">
            <h2>Disk usage</h2>
            {disks.map((d) => {
              const pct = Math.round((d.usedTb / d.totalTb) * 100)
              return (
                <div key={d.name} className="disk">
                  <span>{d.name}</span>
                  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                  <small>{d.usedTb} / {d.totalTb} TB · {pct}%</small>
                </div>
              )
            })}
          </section>

          <section className="panel">
            <h2>Needs fixing <span className="n">{problems.length}</span></h2>
            <ul className="fixes">
              {problems.map((p) => (
                <li key={p.title}>
                  <span><b>{p.title}</b><small>{p.what}</small></span>
                  <button type="button" className="b">{p.fix}</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Services</h2>
            <div className="services">
              {services.map((s) => (
                <div key={s.name} className={s.ok ? 'svc' : 'svc down'}>
                  <i /><b>{s.name}</b><small>{s.ok ? s.version : 'Not responding'}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Requesters <span className="n">{requesters.length}</span></h2>
            <table className="tbl">
              <thead>
                <tr><th>Name</th><th className="num">Requests</th><th>Role</th></tr>
              </thead>
              <tbody>
                {requesters.map((r) => (
                  <tr key={r.name}><td><b>{r.name}</b></td><td className="num">{r.requests}</td><td>{r.admin ? 'Admin' : 'Requester'}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </>
  )
}
