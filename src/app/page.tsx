import Form from 'next/form'
import Link from 'next/link'
import { search, type SearchResult } from '@/lib/arr'
import type { MediaType } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { requestMovie, requestTv } from './actions'
import { AutoRefresh } from './auto-refresh'
import { Badge, Card } from './ui'

const TABS: [MediaType, string][] = [
  ['movie', 'Movies'],
  ['tv', 'TV Shows'],
]

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; notice?: string }>
}) {
  await requireUser()
  const params = await searchParams
  const type: MediaType = params.type === 'tv' ? 'tv' : 'movie'
  const q = params.q?.trim() ?? ''

  let results: SearchResult[] | undefined
  let error = ''
  if (q) {
    try {
      results = await search(type, q)
    } catch (e) {
      console.error(e)
      error = `${type === 'movie' ? 'Radarr' : 'Sonarr'} isn't responding. Try again in a minute.`
    }
  }

  return (
    <>
      <nav className="tabs">
        {TABS.map(([t, label]) => (
          <Link key={t} href={`/?type=${t}&q=${encodeURIComponent(q)}`} className={t === type ? 'tab on' : 'tab'}>
            {label}
          </Link>
        ))}
      </nav>
      <Form action="/" className="search">
        <input type="hidden" name="type" value={type} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={type === 'movie' ? 'Search movies' : 'Search TV shows'}
          aria-label="Search"
          autoFocus
        />
        <button>Search</button>
      </Form>
      {error && <p className="error">{error}</p>}
      {params.notice && <p className="error">{params.notice}</p>}
      {results?.some((r) => r.status?.label === 'Downloading') && <AutoRefresh seconds={5} />}
      {results?.length === 0 && <p className="muted">Nothing found for “{q}”.</p>}
      <ul className="results">
        {results?.map((r) => (
          <Card key={r.id} title={r.title} year={r.year} poster={r.poster}>
            <p className="overview">{r.overview}</p>
            {type === 'movie' ? <MovieAction r={r} /> : <TvAction r={r} q={q} />}
          </Card>
        ))}
      </ul>
    </>
  )
}

function MovieAction({ r }: { r: SearchResult }) {
  if (r.status) return <Badge status={r.status} />
  return (
    <form action={requestMovie}>
      <input type="hidden" name="id" value={r.id} />
      <button>Request</button>
    </form>
  )
}

/** `q` rides along so a refused Request comes back to the same search. */
function TvAction({ r, q }: { r: SearchResult; q: string }) {
  const unrequested = r.seasons.filter((n) => !r.requestedSeasons.includes(n))
  return (
    <>
      {r.status && <Badge status={r.status} />}
      {unrequested.length > 0 && (
        <details>
          <summary>{r.status ? 'Request more seasons' : 'Choose seasons'}</summary>
          <form action={requestTv} className="seasons">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="q" value={q} />
            {r.seasons.map((n) => {
              const requested = r.requestedSeasons.includes(n)
              return (
                <label key={n}>
                  <input type="checkbox" name="season" value={n} defaultChecked={requested} disabled={requested} /> Season {n}
                </label>
              )
            })}
            <button>Request</button>
          </form>
        </details>
      )}
    </>
  )
}
