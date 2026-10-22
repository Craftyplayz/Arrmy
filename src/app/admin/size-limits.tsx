import { getLimits } from '@/lib/db'
import { saveLimits } from '../actions'
import { SubmitButton } from '../submit-button'

/** Size Limits apply to everyone's Requests; saving pushes them to Radarr and Sonarr. */
export function SizeLimits({ saved }: { saved: boolean }) {
  const limits = getLimits()
  return (
    <section className="ar-panel" id="limits">
      <h2>Size Limits</h2>
      <form action={saveLimits} className="form">
        {saved && <p className="ok">Saved, and applied to Radarr and Sonarr.</p>}
        <p className="ar-sub">They apply to everyone&apos;s Requests. Leave a box empty for no limit.</p>
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
            A TV Request is refused if all its seasons, every episode at the episode limit, could add up to more than this. Needs an episode
            limit.
          </small>
        </label>
        <div className="actions">
          <SubmitButton className="btn primary" pending="Saving...">
            Save limits
          </SubmitButton>
        </div>
      </form>
    </section>
  )
}
