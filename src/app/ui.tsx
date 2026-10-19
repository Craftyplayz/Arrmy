import type { Status } from '@/lib/status'

export function Card(props: { title: string; year?: number | null; poster?: string | null; children: React.ReactNode }) {
  return (
    <li className="card">
      {props.poster ? <img src={props.poster} alt="" loading="lazy" /> : <div className="noposter" />}
      <div className="info">
        <h3>
          {props.title} {props.year ? <span className="muted">({props.year})</span> : null}
        </h3>
        {props.children}
      </div>
    </li>
  )
}

/** null = the title was removed from Radarr/Sonarr after it was requested. */
export function Badge({ status }: { status: Status | null }) {
  if (!status) return <span className="badge">Removed</span>
  const tone = status.label === 'Available' ? ' ok' : status.label === 'Downloading' ? ' busy' : ''
  return (
    <span className={`badge${tone}`}>
      {status.label}
      {status.progress !== undefined && ` ${status.progress}%`}
    </span>
  )
}
