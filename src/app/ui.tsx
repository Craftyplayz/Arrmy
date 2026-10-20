import type { Status } from '@/lib/status'

/** 1,204 */
export const num = (n: number) => n.toLocaleString('en-GB')
/** 20 Oct 2026 */
export const day = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** The top of an art-led page. Arrmy's heroes have no art, so they are the plain --sunken kind. */
export function Hero({ title, lede, children }: { title: string; lede: string; children?: React.ReactNode }) {
  return (
    <header className="ar-hero">
      <div className="ar-hero-body">
        <div className="grow">
          <h1 className="page-title">{title}</h1>
          <p className="page-lede">{lede}</p>
        </div>
      </div>
      {children}
    </header>
  )
}

/** A percentage ring; `label` says it in words for screen readers. */
export function Ring({ p, label }: { p: number; label: string }) {
  return (
    <span className="ar-ring" style={{ '--p': p } as React.CSSProperties} role="img" aria-label={label}>
      <b>
        {p}
        <small>%</small>
      </b>
    </span>
  )
}

/**
 * A poster that opens a drawer with `children` under the title. The drawer is a native popover, so it needs no client JS.
 * `status` undefined shows nothing on the poster; null is a title removed from Radarr/Sonarr (see Badge).
 */
export function Cover(props: {
  id: string
  title: string
  sub?: string
  poster?: string | null
  status?: Status | null
  eager?: boolean
  children: React.ReactNode
}) {
  const drawer = `d-${props.id}`
  const { status } = props
  return (
    <li>
      <button className="ar-cap" popoverTarget={drawer}>
        {props.poster && (
          <img src={props.poster} alt="" width={300} height={450} loading={props.eager ? undefined : 'lazy'} decoding="async" />
        )}
        {status === undefined ? null : status?.label === 'Downloading' ? (
          <Ring p={status.progress ?? 0} label={`Downloading ${status.progress ?? 0}%`} />
        ) : (
          <Badge status={status} />
        )}
        <span className="ar-cap-info">
          <b>{props.title}</b>
          {props.sub && <small>{props.sub}</small>}
        </span>
      </button>
      <aside className="drawer" id={drawer} popover="auto" aria-label={props.title}>
        <button className="close" popoverTarget={drawer} popoverTargetAction="hide" aria-label="Close" title="Close">
          &times;
        </button>
        <h2>{props.title}</h2>
        {props.children}
      </aside>
    </li>
  )
}

/** null = the title was removed from Radarr/Sonarr after it was requested. */
export function Badge({ status }: { status: Status | null }) {
  if (!status) return <span className="badge">Removed</span>
  const tone = status.label === 'Available' ? ' g' : status.label === 'Downloading' ? ' b' : ''
  return (
    <span className={`badge${tone}`}>
      {status.label}
      {status.progress !== undefined && ` ${status.progress}%`}
    </span>
  )
}
