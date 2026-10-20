import { redirect } from 'next/navigation'
import { adminOverview, type Problem } from '@/lib/admin'
import { requestDetails } from '@/lib/arr'
import { listRequests } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { fixProblem } from '../actions'
import { AutoRefresh } from '../auto-refresh'

const size = (bytes: number) => (bytes >= 1e12 ? `${(bytes / 1e12).toFixed(2)} TB` : `${(bytes / 1e9).toFixed(1)} GB`)
const speed = (bytesPerSecond: number) => `${(bytesPerSecond / 1048576).toFixed(1)} MB/s`

export default async function AdminPage() {
  const user = await requireUser()
  if (!user.is_admin) redirect('/')

  let overview: Awaited<ReturnType<typeof adminOverview>> | undefined
  try {
    overview = await adminOverview()
  } catch (e) {
    console.error(e)
  }
  if (!overview) {
    return (
      <>
        <h1>Admin</h1>
        <p className="error">Radarr or Sonarr isn't responding. Check their containers in Portainer.</p>
      </>
    )
  }

  const requests = listRequests()
  const details = await requestDetails(requests).catch(() => undefined)
  const people = new Map<string, { count: number; bytes: number }>()
  requests.forEach((r, i) => {
    const p = people.get(r.username) ?? { count: 0, bytes: 0 }
    people.set(r.username, { count: p.count + 1, bytes: p.bytes + (details?.[i].bytes ?? 0) })
  })

  const { problems, downloads, speeds, library, disks } = overview
  return (
    <>
      <h1>Admin</h1>
      {downloads.length > 0 && <AutoRefresh seconds={5} />}

      <h2>Problems{problems.length > 0 && ` (${problems.length})`}</h2>
      {problems.length === 0 ? (
        <p className="muted">Nothing needs fixing.</p>
      ) : (
        <ul className="results">
          {problems.map((p) => (
            <ProblemRow key={`${p.service}-${p.kind}-${p.ids.join('-')}`} p={p} />
          ))}
        </ul>
      )}

      <h2>Downloading</h2>
      {downloads.length === 0 ? (
        <p className="muted">Nothing downloading.</p>
      ) : (
        <ul className="downloads">
          {downloads.map((d, i) => {
            const percent = d.size ? Math.round(((d.size - d.sizeleft) / d.size) * 100) : 0
            return (
              <li key={i}>
                <span>{d.title}</span>
                <progress max={100} value={percent} aria-label={`${d.title} progress`} />
                <span className="muted">
                  {percent}% of {size(d.size)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {speeds && (
        <p className="muted">
          Down {speed(speeds.down)} · Up {speed(speeds.up)}
        </p>
      )}

      <h2>Library</h2>
      <div className="tiles">
        <Tile label="Movies" value={String(library.movies)} sub={size(library.movieBytes)} />
        <Tile label="Shows" value={String(library.shows)} sub={`${library.episodes} episodes · ${size(library.showBytes)}`} />
        {disks.media && <DiskTile label="Media disk" disk={disks.media} />}
        {disks.settings && <DiskTile label="Settings disk" disk={disks.settings} />}
      </div>

      <h2>Requests by person</h2>
      {people.size === 0 ? (
        <p className="muted">No Requests yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Requests</th>
              <th>Space used</th>
            </tr>
          </thead>
          <tbody>
            {[...people].sort((a, b) => b[1].bytes - a[1].bytes).map(([name, p]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{p.count}</td>
                <td>{size(p.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function ProblemRow({ p }: { p: Problem }) {
  return (
    <li className="card">
      <div className="info">
        <h3>
          {p.title} <span className={p.kind === 'Missing' ? 'badge' : 'badge bad'}>{p.kind}</span>
        </h3>
        <p className="muted">{p.detail}</p>
        <form action={fixProblem}>
          <input type="hidden" name="service" value={p.service} />
          <input type="hidden" name="fix" value={p.fix} />
          {p.ids.map((id) => (
            <input key={id} type="hidden" name="id" value={id} />
          ))}
          <button>{p.fix === 'retry' ? 'Try another release' : 'Search again'}</button>
        </form>
      </div>
    </li>
  )
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className={warn ? 'tile warn' : 'tile'}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <span className="muted">{sub}</span>
    </div>
  )
}

/** Turns red under 10% free. */
function DiskTile({ label, disk }: { label: string; disk: { freeSpace: number; totalSpace: number } }) {
  return (
    <Tile
      label={label}
      value={`${size(disk.freeSpace)} free`}
      sub={`of ${size(disk.totalSpace)}`}
      warn={disk.freeSpace < disk.totalSpace * 0.1}
    />
  )
}
