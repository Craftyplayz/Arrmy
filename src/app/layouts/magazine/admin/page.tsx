import type { Metadata } from 'next'
import { admin } from '../../data'

export const metadata: Metadata = { title: 'Magazine · Admin' }

export default function MagazineAdmin() {
  return (
    <>
      <h1 className="lm-title">Editor&rsquo;s desk</h1>
      <p className="lm-lede">What needs fixing, what the presses are running and how much stock is left.</p>

      <div className="lm-counts">
        {Object.entries(admin.counts).map(([label, n]) => (
          <div key={label}><b>{n}</b><span>{label}</span></div>
        ))}
      </div>

      <div className="lm-desk">
        <div>
          <section className="lm-box">
            <h2 className="lm-kicker">Corrections needed <span className="n">{admin.problems.length}</span></h2>
            {admin.problems.map((p) => (
              <div key={p.title} className="lm-problem">
                <div><b>{p.title}</b><span>{p.what}</span></div>
                <button type="button" className="lm-btn small">{p.fix}</button>
              </div>
            ))}
          </section>

          <section className="lm-section">
            <h2 className="lm-kicker">Presses running <span className="n">{admin.downloads.length}</span></h2>
            <table className="lm-table">
              <thead>
                <tr><th>Title</th><th className="num">Speed</th><th className="num">Seeds</th><th>Time left</th><th>Progress</th></tr>
              </thead>
              <tbody>
                {admin.downloads.map((d) => (
                  <tr key={d.title}>
                    <td>{d.title}</td>
                    <td className="num">{d.speedMbs} MB/s</td>
                    <td className="num">{d.seeds}</td>
                    <td>{d.eta}</td>
                    <td><div className="lm-rule st-downloading"><i style={{ width: `${d.progress}%` }} /></div><small>{d.progress}%</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <aside>
          <h2 className="lm-kicker">Stock</h2>
          <div className="lm-section">
            {admin.disks.map((d) => {
              const used = Math.round((d.usedTb / d.totalTb) * 100)
              return (
                <div key={d.name} className="lm-disk">
                  <b>{d.name}<small>{d.usedTb} of {d.totalTb} TB</small></b>
                  <div className={used >= 90 ? 'lm-rule low' : 'lm-rule'}><i style={{ width: `${used}%` }} /></div>
                </div>
              )
            })}
          </div>

          <h2 className="lm-kicker">Contributors</h2>
          <ul className="lm-people">
            {admin.requesters.map((p) => (
              <li key={p.name}>{p.name}{p.admin && <small>Admin</small>}<span>{p.requests} {p.requests === 1 ? 'Request' : 'Requests'}</span></li>
            ))}
          </ul>
        </aside>
      </div>

      <p className="lm-wire">
        <b>Wire services</b>
        {admin.services.map((s) => (
          <span key={s.name}><i className={s.ok ? 'lm-dot' : 'lm-dot off'} />{s.name} <small>{s.ok ? s.version : 'not responding'}</small></span>
        ))}
      </p>
    </>
  )
}
