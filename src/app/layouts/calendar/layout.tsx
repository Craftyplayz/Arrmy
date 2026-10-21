import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { avatarStyle, cells, dayName, dayNumber, events, isOther, label, TODAY, tone, upcoming } from './events'
import { Tabs } from './tabs'
import './calendar.css'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** The Calendar mockup's chrome: a calendar app's top bar, and a thin left column with what's coming up and a mini-month. */
export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-calendar">
      <header className="lc-top">
        <Link href="/layouts/calendar" className="lc-brand"><i />Arrmy</Link>
        <Tabs />
        <button type="button" className="lc-btn">Today</button>
        <button type="button" className="lc-btn icon" aria-label="Previous month">‹</button>
        <button type="button" className="lc-btn icon" aria-label="Next month">›</button>
        <span className="lc-when">October 2026</span>
        <i className="lc-avatar" style={avatarStyle(user.username)} title={user.username}>{user.username[0]}</i>
      </header>
      <div className="lc-body">
        <aside className="lc-side">
          <h3>Upcoming</h3>
          <ul className="lc-up">
            {upcoming.map((e) => (
              <li key={label(e)}>
                <time><b>{e.day}</b><small>{dayName(e.day)}</small></time>
                <span className={tone(e.title.type)}>{label(e)}</span>
              </li>
            ))}
          </ul>
          <h3>October 2026</h3>
          <div className="lc-mini">
            {DOW.map((d, i) => <span key={i} className="dow">{d}</span>)}
            {cells.map((d) => {
              const ev = events.find((e) => e.day === d)
              const cls = [d === TODAY && 'is-today', isOther(d) && 'is-other', ev && `has-ev ${tone(ev.title.type)}`].filter(Boolean).join(' ')
              return <span key={d} className={cls}>{dayNumber(d)}</span>
            })}
          </div>
          <p className="l-note">Mockup: nothing here works.</p>
        </aside>
        <div className="lc-main">{children}</div>
      </div>
    </div>
  )
}
