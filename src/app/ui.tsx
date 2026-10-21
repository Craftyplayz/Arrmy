import type { Status } from '@/lib/status'

/** 1,204 */
export const num = (n: number) => n.toLocaleString('en-GB')
/** 20 Oct 2026 */
export const day = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** 3.20 TB, 14.8 GB */
export const size = (bytes: number) => (bytes >= 1e12 ? `${(bytes / 1e12).toFixed(2)} TB` : `${(bytes / 1e9).toFixed(1)} GB`)

/** The top of a page: its title, one muted line beside it, and any buttons (`children`) on the right. */
export function Hero({ title, lede, children }: { title: string; lede: string; children?: React.ReactNode }) {
  return (
    <header className="ar-head">
      <h1 className="page-title">{title}</h1>
      <p className="page-lede">{lede}</p>
      {children}
    </header>
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
