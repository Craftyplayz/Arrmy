import { redirect } from 'next/navigation'
import { getLimits } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { saveLimits } from '../actions'

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser()
  if (!user.is_admin) redirect('/')
  const limits = getLimits()
  const { saved } = await searchParams

  return (
    <>
      <h1>Size limits</h1>
      <p className="muted">They apply to everyone's Requests. Leave a box empty for no limit.</p>
      {saved && <p className="ok">Saved, and applied to Radarr and Sonarr.</p>}
      <form action={saveLimits} className="limits">
        <label>
          <span>Movie</span>
          <input name="movieGb" type="number" min="0" max="10000" step="0.1" defaultValue={limits.movieGb || ''} /> GB
        </label>
        <p className="muted">The biggest movie file Radarr may download.</p>
        <label>
          <span>Episode</span>
          <input name="episodeGb" type="number" min="0" max="10000" step="0.1" defaultValue={limits.episodeGb || ''} /> GB per
          hour
        </label>
        <p className="muted">For a 1-hour episode; a 30-minute episode gets half. Season packs are judged per episode.</p>
        <label>
          <span>Show</span>
          <input name="showGb" type="number" min="0" max="10000" step="1" defaultValue={limits.showGb || ''} /> GB
        </label>
        <p className="muted">
          A TV Request is refused if all its seasons, every episode at the episode limit, could add up to more than this.
          Needs an episode limit.
        </p>
        <button>Save</button>
      </form>
    </>
  )
}
