import { getDeadLimits } from '@/lib/db'
import { saveDeadLimits } from '../actions'
import { SubmitButton } from '../submit-button'

/** When a torrent counts as dead and how many dead releases in a row make a Problem (see dead.ts). */
export function DeadReleases({ saved }: { saved: boolean }) {
  const limits = getDeadLimits()
  return (
    <section className="ar-panel" id="dead">
      <h2>Dead releases</h2>
      <form action={saveDeadLimits} className="form">
        {saved && <p className="ok">Saved.</p>}
        <p className="ar-sub">A torrent nobody is sharing is swapped for another release. Arrmy checks every minute.</p>
        <label>
          Minutes without a file list
          <input className="field" name="metaMinutes" type="number" inputMode="numeric" min="1" max="1440" step="1" required defaultValue={limits.metaMinutes} />
          <small>A torrent still fetching its file list after this long is dead.</small>
        </label>
        <label>
          Minutes with nothing downloaded
          <input className="field" name="idleMinutes" type="number" inputMode="numeric" min="1" max="1440" step="1" required defaultValue={limits.idleMinutes} />
          <small>A torrent with not a byte downloaded this long after it was added is dead.</small>
        </label>
        <label>
          Dead releases in a row
          <input className="field" name="strikes" type="number" inputMode="numeric" min="1" max="20" step="1" required defaultValue={limits.strikes} />
          <small>After this many for one title, Arrmy stops swapping and it becomes a Problem.</small>
        </label>
        <div className="actions">
          <SubmitButton className="btn primary" pending="Saving...">
            Save
          </SubmitButton>
        </div>
      </form>
    </section>
  )
}
