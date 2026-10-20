import type { Metadata } from 'next'
import Form from 'next/form'
import Link from 'next/link'
import { search, type SearchResult } from '@/lib/arr'
import type { MediaType } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { requestAudiobook, requestMovie, requestTv } from './actions'
import { AutoRefresh } from './auto-refresh'
import { SubmitButton } from './submit-button'
import { Badge, Cover, Hero } from './ui'

export const metadata: Metadata = { title: 'Search' }

const TABS: [MediaType, string][] = [
  ['movie', 'Movies'],
  ['tv', 'TV Shows'],
  ['audiobook', 'Audiobooks'],
]
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
    <>
      <Hero title="Search" lede="Find a movie, show or audiobook and request it.">
        <nav className="ar-tabs" aria-label="Media types">
          {TABS.map(([t, label]) => (
            <Link key={t} href={`/?type=${t}&q=${encodeURIComponent(q)}`} aria-current={t === type ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </Hero>
      <Form action="/" className="bar ar-bar">
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
        <button className="btn primary">Search</button>
      </Form>
      {error && <p className="err">{error}</p>}
      {params.notice && <p className="err">{params.notice}</p>}
      {results?.some((r) => r.status?.label === 'Downloading') && <AutoRefresh seconds={5} />}
      {results?.length === 0 && <p className="muted">Nothing found for “{q}”.</p>}
      {results && results.length > 0 && (
        <>
          <h2 className="ar-h">
            Results <span className="n">{results.length}</span>
          </h2>
          {/* keyed on the notice, so a refused Request closes its drawer and the notice above shows */}
          <ul className="ar-caps" key={params.notice}>
            {results.map((r, i) => (
              <Cover
                key={r.id}
                id={`${type}-${r.id}`}
                title={r.title}
                sub={r.year ? String(r.year) : undefined}
                poster={r.poster}
                status={r.status ?? undefined}
                eager={i < 6}
              >
                <div className="badges">
                  {r.year && <span className="pill">{r.year}</span>}
                  {r.status && <Badge status={r.status} />}
                </div>
                {r.overview && <p>{r.overview}</p>}
                {type === 'tv' ? <TvAction r={r} q={q} /> : type === 'audiobook' ? <AudiobookAction r={r} /> : <RequestButton r={r} action={requestMovie} />}
              </Cover>
            ))}
          </ul>
        </>
      )}
    </>
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
