import type { Metadata } from 'next'
import { requests, type MockStatus } from '../../data'
import { bar, Hints, tone, TYPE } from '../bits'

export const metadata: Metadata = { title: 'Terminal · Requests' }

const count = (s: MockStatus) => requests.filter((r) => r.status === s).length

export default function Requests() {
  return (
    <>
      <p className="lt-prompt">
        <b>&gt;</b> filter: status=<input className="lt-in" defaultValue="*" size={2} aria-label="Status" /> type=<input className="lt-in" defaultValue="*" size={2} aria-label="Media Type" /> by=
        <input className="lt-in" defaultValue="*" size={2} aria-label="Requester" />
      </p>
      <table className="lt-grid">
        <thead>
          <tr><th>ID</th><th>TITLE</th><th>TYPE</th><th>DETAIL</th><th>BY</th><th>AGE</th><th className="lt-num">SIZE</th><th>STATUS</th><th>PROGRESS</th></tr>
        </thead>
        <tbody>
          {requests.map((r, i) => (
            <tr key={r.id} className={i === 1 ? 'is-sel' : undefined}>
              <td>{r.id}</td>
              <td>{r.title.title}</td>
              <td>{TYPE[r.title.type]}</td>
              <td>{r.detail.toLowerCase()}</td>
              <td>{r.requestedBy}</td>
              <td>{r.requestedAgo}</td>
              <td className="lt-num">{r.sizeGb ? `${r.sizeGb.toFixed(1)}G` : '—'}</td>
              <td><span className={tone(r.status)}>{r.status.toLowerCase()}</span></td>
              <td className={tone(r.status)}>{bar(r.progress)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lt-sum">{requests.length} requests · {count('Downloading')} downloading · {count('Stuck')} stuck</p>
      <Hints keys={[['[x]', 'remove'], ['[enter]', 'details'], ['[j/k]', 'move'], ['[/]', 'filter'], ['[s]', 'sort: age']]} />
    </>
  )
}
