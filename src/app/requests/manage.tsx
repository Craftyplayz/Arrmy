import type { RequestDetails } from '@/lib/arr'
import { otherRequests, seasonsOf, type RequestRow } from '@/lib/db'
import { editSeasons, removeRequest } from '../actions'
import { SubmitButton } from '../submit-button'

/** Edit seasons and Remove. The server re-checks that the Request is the viewer's own (or that they're the Admin). */
export function Manage({ r, details }: { r: RequestRow; details: RequestDetails }) {
  const requested = seasonsOf(r)
  const shared = otherRequests(r).length > 0
  const started = details.status && details.status.label !== 'Requested'
  return (
    <>
      {r.media_type === 'tv' && details.seasons.length > 0 && (
        <section>
          <form action={editSeasons} className="form">
            <input type="hidden" name="id" value={r.id} />
            <fieldset className="ar-seasons">
              <legend>Edit seasons</legend>
              {details.seasons.map((n) => (
                <label key={n} className="check">
                  <input type="checkbox" name="season" value={n} defaultChecked={requested.includes(n)} /> Season {n}
                </label>
              ))}
            </fieldset>
            <small className="ar-sub">Unticked seasons are deleted from the server, unless someone else requested them.</small>
            <div className="actions">
              <SubmitButton className="btn primary" pending="Saving...">
                Save seasons
              </SubmitButton>
            </div>
          </form>
        </section>
      )}
      <section>
        <details>
          <summary>Remove</summary>
          <form action={removeRequest} className="form">
            <input type="hidden" name="id" value={r.id} />
            <small className="ar-sub">
              {shared
                ? 'Someone else requested this too, so what they asked for stays.'
                : started
                  ? 'Deletes the download and the files from the server.'
                  : 'Cancels the Request. Nothing has downloaded yet.'}
            </small>
            <div className="actions">
              <SubmitButton pending="Removing...">{started && !shared ? 'Delete' : 'Cancel Request'}</SubmitButton>
            </div>
          </form>
        </details>
      </section>
    </>
  )
}
