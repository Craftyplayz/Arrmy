import type { Metadata } from 'next'
import { admin, requests } from '../../data'

export const metadata: Metadata = { title: 'Split pane · Admin' }

/** Admin: problems, downloads and services grouped in the list pane; the selected problem and the disks in the detail pane. */
export default function SplitAdmin() {
  const sel = admin.problems[0]
  const r = requests.find((x) => x.title.title === sel.title)
  const down = admin.services.filter((s) => !s.ok).length
  return (
    <>
      <section className="list" aria-label="Admin">
        <div className="list-top">
          <input className="search" type="search" placeholder="Filter…" />
          <div className="chips">
            <button type="button" className="chip on">All</button>
            <button type="button" className="chip">Needs fixing<small>{admin.problems.length}</small></button>
            <button type="button" className="chip">Downloading<small>{admin.downloads.length}</small></button>
            <button type="button" className="chip">Services<small>{down} down</small></button>
          </div>
        </div>
        <p className="group"><span>Needs fixing</span><span>{admin.problems.length}</span></p>
        {admin.problems.map((p) => (
          <button key={p.title} type="button" className={p === sel ? 'row plain is-selected' : 'row plain'} aria-pressed={p === sel}>
            <span className="row-text"><b>{p.title}</b><small>{p.what}</small></span>
            <span className="dot bad" />
          </button>
        ))}
        <p className="group"><span>Downloading</span><span>{admin.downloads.length}</span></p>
        {admin.downloads.map((d) => (
          <button key={d.title} type="button" className="row plain">
            <span className="row-text">
              <b>{d.title}</b>
              <small>{d.speedMbs} MB/s · {d.seeds} seeders · {d.eta} left</small>
              <span className="line"><i style={{ width: `${d.progress}%` }} /></span>
            </span>
            <span className="dot downloading" />
          </button>
        ))}
        <p className="group"><span>Services</span><span>{admin.services.length - down} of {admin.services.length} up</span></p>
        {admin.services.map((s) => (
          <button key={s.name} type="button" className="row plain">
            <span className="row-text"><b>{s.name}</b><small>{s.ok ? `v${s.version}` : 'Not responding'}</small></span>
            <span className={s.ok ? 'dot available' : 'dot bad'} />
          </button>
        ))}
      </section>
      <section className="detail" aria-label="Selected problem">
        <div className="toolbar">
          <span className="crumb">Admin › Needs fixing › {sel.title}</span>
          <button type="button" className="tb primary">{sel.fix}</button>
          <button type="button" className="tb">Ignore</button>
        </div>
        <div className="body">
          <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>{sel.title}</h1>
          <p className="meta">Movie · Requested by {r?.requestedBy} · {r?.requestedAgo} · <b className="status-tag"><span className="dot bad" />Stuck</b></p>
          <p className="overview">{sel.what} Nothing on the indexers fits the size limit yet, so the Request is going nowhere by itself. Searching again asks Radarr to look once more; ignoring it hides it here until something changes.</p>
          <div className="sec">
            <h2 className="lbl">Tried so far</h2>
            <ol className="tl">
              <li><b>Requested</b><small>{r?.requestedAgo} · by {r?.requestedBy}</small></li>
              <li className="grey"><b>Searched 6 times</b><small>Radarr, every 12 hours · last 2 h ago</small></li>
              <li className="grey"><b>2 releases skipped</b><small>Both over the 40 GB Movie limit</small></li>
              <li className="bad"><b>Marked Stuck</b><small>Nothing found in 4 days</small></li>
            </ol>
          </div>
          <div className="sec">
            <h2 className="lbl">Disks</h2>
            <div className="disks">
              {admin.disks.map((d) => {
                const pct = Math.round((d.usedTb / d.totalTb) * 100)
                return (
                  <div key={d.name} className="disk">
                    <span>{d.name}</span>
                    <div className={pct >= 80 ? 'big warn' : 'big'}><i style={{ width: `${pct}%` }} /></div>
                    <small>{d.usedTb} of {d.totalTb} TB · {pct}%</small>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="sec">
            <h2 className="lbl">Requesters</h2>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Role</th><th className="num">Requests</th><th className="num">Size</th></tr></thead>
              <tbody>
                {admin.requesters.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.admin ? 'Admin' : 'Requester'}</td>
                    <td className="num">{p.requests}</td>
                    <td className="num">{requests.filter((x) => x.requestedBy === p.name).reduce((n, x) => n + x.sizeGb, 0).toFixed(1)} GB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  )
}
