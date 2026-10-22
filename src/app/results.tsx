import type { SearchResult } from '@/lib/arr'
import type { MediaType } from '@/lib/db'
import { requestAudiobook, requestMovie, requestTv } from './actions'
import { SubmitButton } from './submit-button'
import { Badge } from './ui'

/** All searches every Media Type at once; the others are for finer control. */
export type Mode = MediaType | 'all'
const TYPE_NAMES = { movie: 'Movie', tv: 'TV Show', audiobook: 'Audiobook' }

/** One search result: poster, title, its Media Type, a line of overview, its status, and what can still be requested. */
export function Result({ r, type, mode, q, eager }: { r: SearchResult; type: MediaType; mode: Mode; q: string; eager: boolean }) {
  // TV: seasons not yet requested; Audiobooks: another Edition can always be asked for
  const more = type === 'tv' ? r.seasons.some((n) => !r.requestedSeasons.includes(n)) : type === 'audiobook'
  const drawer = `d-${type}-${r.id}`
  return (
    <li className="ar-result">
      {r.poster ? (
        <img className="ar-result-poster" src={r.poster} alt="" width={56} height={84} loading={eager ? undefined : 'lazy'} decoding="async" />
      ) : (
        <span className="ar-result-poster" />
      )}
      <div className="grow">
        <h3>{r.title}</h3>
        <p className="ar-result-meta">
          <span className={`ar-type ar-type-${type}`}>{TYPE_NAMES[type]}</span>
          {r.year}
        </p>
        {r.overview && <p className="ar-result-over">{r.overview}</p>}
      </div>
      <div className="ar-result-act">
        {r.status && <Badge status={r.status} />}
        {type === 'movie' ? (
          <RequestButton r={r} action={requestMovie} />
        ) : (
          more && (
            <>
              <button className={r.status ? 'btn small' : 'btn primary'} popoverTarget={drawer}>
                {!r.status ? 'Request' : type === 'tv' ? 'More seasons' : 'Another edition'}
              </button>
              <aside className="drawer" id={drawer} popover="auto" aria-label={r.title}>
                <button className="close" popoverTarget={drawer} popoverTargetAction="hide" aria-label="Close" title="Close">
                  &times;
                </button>
                <h2>{r.title}</h2>
                <div className="badges">
                  {r.year && <span className="pill">{r.year}</span>}
                  {r.status && <Badge status={r.status} />}
                </div>
                {r.overview && <p>{r.overview}</p>}
                {type === 'tv' ? <TvAction r={r} q={q} mode={mode} /> : <AudiobookAction r={r} />}
              </aside>
            </>
          )
        )}
      </div>
    </li>
  )
}

/** Audiobooks: the book, or one Edition of it (a narrator, or Full Cast), also once the book itself is requested. */
function AudiobookAction({ r }: { r: SearchResult }) {
  return (
    <form action={requestAudiobook} className="form">
      <input type="hidden" name="id" value={r.id} />
      <label>
        Edition{r.status ? '' : ' (optional)'}
        <input className="field" name="edition" maxLength={40} placeholder="Stephen Fry, Full Cast" required={!!r.status} />
        <small>A narrator, or Full Cast for a dramatised one.</small>
      </label>
      <div className="actions">
        <SubmitButton className="btn primary" pending="Requesting...">
          {r.status ? 'Request this edition' : 'Request'}
        </SubmitButton>
      </div>
    </form>
  )
}

/** Movies: one thing to request, so a Request button until it's requested. */
function RequestButton({ r, action }: { r: SearchResult; action: (form: FormData) => Promise<void> }) {
  if (r.status) return null
  return (
    <form action={action} className="actions">
      <input type="hidden" name="id" value={r.id} />
      <SubmitButton className="btn primary" pending="Requesting...">
        Request
      </SubmitButton>
    </form>
  )
}

/** `q` and `mode` ride along so a refused Request comes back to the same search. */
function TvAction({ r, q, mode }: { r: SearchResult; q: string; mode: Mode }) {
  const unrequested = r.seasons.filter((n) => !r.requestedSeasons.includes(n))
  if (unrequested.length === 0) return null
  return (
    <form action={requestTv} className="form">
      <input type="hidden" name="id" value={r.id} />
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="type" value={mode} />
      <fieldset className="ar-seasons">
        <legend>{r.status ? 'Request more seasons' : 'Choose seasons'}</legend>
        {r.seasons.map((n) => {
          const requested = r.requestedSeasons.includes(n)
          return (
            <label key={n} className="check">
              <input type="checkbox" name="season" value={n} defaultChecked={requested} disabled={requested} /> Season {n}
            </label>
          )
        })}
      </fieldset>
      <div className="actions">
        <SubmitButton className="btn primary" pending="Requesting...">
          Request
        </SubmitButton>
      </div>
    </form>
  )
}
