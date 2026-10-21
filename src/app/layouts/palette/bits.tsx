import Link from 'next/link'
import type { MockStatus } from '../data'

/** Stroke icons in a 24px box; `n` picks one. */
const PATHS: Record<string, string> = {
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.3-4.3',
  list: 'M4 6h16M4 12h16M4 18h10',
  shield: 'M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  out: 'M9 4H5v16h4M14 8l4 4-4 4M18 12H9',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5v.5',
  down: 'M12 4v12M6 10l6 6 6-6M4 20h16',
  disk: 'M3 5h18v6H3zM3 13h18v6H3zM7 8h.5M7 16h.5',
  play: 'M7 4l12 8-12 8z',
}
export const Ico = ({ n }: { n: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[n]} /></svg>
)

/** The floating window: the input (with an optional mode chip), the rows the page gives it, and a detail footer. */
export function Pal({ mode, value, placeholder, footer, children }: { mode?: string; value?: string; placeholder?: string; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="pal" aria-label="Command palette">
      <div className="pal-in">
        <Ico n="search" />
        {mode && <span className="pal-mode">{mode}</span>}
        <input defaultValue={value} placeholder={placeholder} aria-label="Search or type a command" />
        <kbd>⌘K</kbd>
      </div>
      <div className="pal-list">{children}</div>
      {footer && <div className="pal-foot">{footer}</div>}
    </section>
  )
}

export const Group = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="pal-group"><h2>{title}</h2>{children}</div>

/** One result row: icon, text, a right-hand hint; `children` adds a bar or editor under the text. A link when it has an href. */
export function Row({ icon, bad, title, sub, right, hot, href, children }: { icon: React.ReactNode; bad?: boolean; title: string; sub?: string; right?: React.ReactNode; hot?: boolean; href?: string; children?: React.ReactNode }) {
  const body = (
    <>
      <span className={bad ? 'pal-ico is-bad' : 'pal-ico'}>{icon}</span>
      <span className="pal-txt"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      <span className="pal-r">{right}</span>
      {children}
    </>
  )
  const cls = hot ? 'pal-row is-hot' : 'pal-row'
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

export const Chip = ({ s }: { s: MockStatus }) => <span className={`pal-chip st-${s.toLowerCase()}`}>{s}</span>
