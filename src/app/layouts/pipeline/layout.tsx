import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { user } from '../data'
import { Tabs } from './tabs'
import './pipeline.css'

const LEGEND: [cls: string, label: string][] = [['requested', 'Requested'], ['downloading', 'Downloading'], ['importing', 'Importing'], ['available', 'Available'], ['stuck', 'Stuck']]

/** The Pipeline mockup's own chrome: a top bar with brand, tabs, search and the signed-in name, then a legend bar. */
export default async function PipelineLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  if (!u.is_admin) redirect('/')
  return (
    <div className="l-pipeline">
      <header className="lp-top">
        <Link href="/layouts/pipeline" className="lp-brand"><i />Arrmy</Link>
        <Tabs />
        <input className="lp-field" placeholder="Search movies, TV shows, audiobooks…" />
        <span className="lp-me"><i className="lp-avatar" style={{ background: `hsl(${user.avatarHue} 50% 45%)` }}>{user.username[0]}</i>{user.username}</span>
      </header>
      <div className="lp-legend">
        {LEGEND.map(([cls, label]) => <span key={cls}><i className={`lp-dot ${cls}`} />{label}</span>)}
        <p className="l-note">Mockup: nothing here works.</p>
      </div>
      <div className="lp-body">{children}</div>
    </div>
  )
}
