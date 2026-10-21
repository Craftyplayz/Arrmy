import type { Metadata } from 'next'
import Form from 'next/form'
import Link from 'next/link'
import { search, type SearchResult } from '@/lib/arr'
import type { MediaType } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { requestAudiobook, requestMovie, requestTv } from './actions'
import { AutoRefresh } from './auto-refresh'
import { SubmitButton } from './submit-button'
import { Badge } from './ui'

export const metadata: Metadata = { title: 'Search' }

const TABS: [MediaType, string][] = [
  ['movie', 'Movies'],
  ['tv', 'TV Shows'],
  ['audiobook', 'Audiobooks'],
]
const TYPE_NAMES = { movie: 'Movie', tv: 'TV Show', audiobook: 'Audiobook' }
/** Who answers the search, the field's label, and an example for its placeholder. */
const LABELS = {
  movie: ['Radarr', 'Search movies', 'Dune'],
  tv: ['Sonarr', 'Search TV shows', 'Breaking Bad'],
  audiobook: ['The book search', 'Search audiobooks', 'Project Hail Mary'],
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; notice?: string }>
}) {
  await requireUser()
  const params = await searchParams
  const type: MediaType = params.type === 'tv' || params.type === 'audiobook' ? params.type : 'movie'
  const q = params.q?.trim() ?? ''

  let results: SearchResult[] | undefined
  let error = ''
  if (q) {
    try {
      results = await search(type, q)
    } catch (e) {
      console.error(e)
      error = `${LABELS[type][0]} isn't responding. Try again in a minute.`
    }
  }

  return (
    <div className="ar-find">
      <div className="ar-find-hero">
        <h1 className="ar-logo">Arrmy</h1>
        <Form action="/" className="ar-find-box">
          <input type="hidden" name="type" value={type} />
          <input
            className="field"
            type="search"
            name="q"
            defaultValue={q}
            placeholder={LABELS[type][2]}
            aria-label={LABELS[type][1]}
            autoFocus
          />
          <button aria-label="Search" title="Search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M11 4a7 7 0 1 0 0 14 7 7 0 1 0 0-14zM20 20l-3.5-3.5" />
            </svg>
          </button>
        </Form>
        <nav className="ar-seg" aria-label="Media Types">
          {TABS.map(([t, label]) => (
            <Link key={t} href={`/?type=${t}&q=${encodeURIComponent(q)}`} aria-current={t === type ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {error && <p className="err">{error}</p>}
      {params.notice && <p className="err">{params.notice}</p>}
      {results?.some((r) => r.status?.label === 'Downloading') && <AutoRefresh seconds={5} />}
      {results?.length === 0 && <p className="ar-count">Nothing found for “{q}”.</p>}
      {results && results.length > 0 && (
        <>
          <p className="ar-count">
            {results.length} {results.length === 1 ? 'result' : 'results'} for “{q}”
          </p>
          {/* keyed on the notice, so a refused Request closes its drawer and the notice above shows */}
          <ul className="ar-results" key={params.notice}>
            {results.map((r, i) => (
              <Result key={r.id} r={r} type={type} q={q} eager={i < 6} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** One search result: poster, title, a line of overview, its status, and what can still be requested. */
function Result({ r, type, q, eager }: { r: SearchResult; type: MediaType; q: string; eager: boolean }) {
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
        <p className="ar-result-meta">{[r.year, TYPE_NAMES[type]].filter(Boolean).join(' · ')}</p>
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
                {type === 'tv' ? <TvAction r={r} q={q} /> : <AudiobookAction r={r} />}
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

/** `q` rides along so a refused Request comes back to the same search. */
function TvAction({ r, q }: { r: SearchResult; q: string }) {
  const unrequested = r.seasons.filter((n) => !r.requestedSeasons.includes(n))
  if (unrequested.length === 0) return null
  return (
    <form action={requestTv} className="form">
      <input type="hidden" name="id" value={r.id} />
      <input type="hidden" name="q" value={q} />
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
