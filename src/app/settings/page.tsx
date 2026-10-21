import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLimits } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { saveLimits } from '../actions'
import { SubmitButton } from '../submit-button'
import { Hero } from '../ui'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser()
  if (!user.is_admin) redirect('/')
  const limits = getLimits()
  const { saved } = await searchParams

  return (
    <>
      <Hero title="Settings" lede="Size Limits apply to everyone's Requests. Leave a box empty for no limit." />
      <section className="ar-panel form-card">
        <h2>Size Limits</h2>
        <form action={saveLimits} className="form">
          {saved && <p className="ok">Saved, and applied to Radarr and Sonarr.</p>}
          <label>
            Movie, in GB (optional)
            <input className="field" name="movieGb" type="number" inputMode="decimal" min="0" max="10000" step="0.1" defaultValue={limits.movieGb || ''} />
            <small>The biggest movie file Radarr may download.</small>
          </label>
          <label>
            Episode, in GB per hour (optional)
            <input className="field" name="episodeGb" type="number" inputMode="decimal" min="0" max="10000" step="0.1" defaultValue={limits.episodeGb || ''} />
            <small>For a 1-hour episode; a 30-minute episode gets half. Season packs are judged per episode.</small>
          </label>
          <label>
            Show, in GB (optional)
            <input className="field" name="showGb" type="number" inputMode="numeric" min="0" max="10000" step="1" defaultValue={limits.showGb || ''} />
            <small>
              A TV Request is refused if all its seasons, every episode at the episode limit, could add up to more than this. Needs an
              episode limit.
            </small>
          </label>
          <div className="actions">
            <SubmitButton className="btn primary" pending="Saving...">
              Save limits
            </SubmitButton>
          </div>
        </form>
      </section>
    </>
  )
}
