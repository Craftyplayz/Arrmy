import type { Metadata } from 'next'
import Form from 'next/form'
import Link from 'next/link'
import { searchMany, type Found } from '@/lib/arr'
import { searchBy } from '@/lib/searchby'
import { SEARCH_BY, searchByOf, type SearchBy } from '@/lib/searchrules'
import { requireUser } from '@/lib/session'
import { tmdbEnabled } from '@/lib/tmdb'
import { AutoRefresh } from './auto-refresh'
import { Result, type Mode } from './results'
import { SuggestField } from './suggest'

export const metadata: Metadata = { title: 'Search' }

const TABS: [Mode, string][] = [
  ['all', 'All'],
  ['movie', 'Movies'],
  ['tv', 'TV Shows'],
  ['audiobook', 'Audiobooks'],
]
/** Who answers the search, the field's label, and an example for its placeholder. */
const LABELS = {
  all: ['', 'Search movies, TV shows and audiobooks', 'Dune, Breaking Bad or Project Hail Mary'],
  movie: ['Radarr', 'Search movies', 'Dune'],
  tv: ['Sonarr', 'Search TV shows', 'Breaking Bad'],
  audiobook: ['The book search', 'Search audiobooks', 'Project Hail Mary'],
}
/** What the field asks for when searching by something other than a title, and an example. */
const BY_LABELS: Record<Exclude<SearchBy, 'title'>, [string, string]> = {
  actor: ['actor', 'Tom Hanks'],
  director: ['director', 'Christopher Nolan'],
  company: ['studio or company', 'Marvel'],
  series: ['series', 'Discworld'],
  author: ['author', 'Andy Weir'],
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; by?: string; q?: string; notice?: string }>
}) {
  await requireUser()
  const params = await searchParams
  const type: Mode = params.type === 'movie' || params.type === 'tv' || params.type === 'audiobook' ? params.type : 'all'
  const by = searchByOf(type, params.by, tmdbEnabled())
  const q = params.q?.trim() ?? ''

  let results: Found[] | undefined
  let error = ''
  if (q && type !== 'all' && by !== 'title') {
    try {
      results = (await searchBy(type, by, q)).map((r) => ({ r, type }))
    } catch (e) {
      console.error(e)
      error = `${type === 'audiobook' ? 'The book search' : `TMDB or ${LABELS[type][0]}`} isn't responding. Try again in a minute.`
    }
  } else if (q) {
    const { found, down } = await searchMany(type, q)
    results = found
    if (down.length) {
      const names = `${down.map((t) => LABELS[t][0]).join(' and ')} ${down.length === 1 ? "isn't" : "aren't"} responding`
      error = results ? `${names}, so some results are missing. Try again in a minute.` : `${names}. Try again in a minute.`
    }
  }

  return (
    <div className="ar-find">
      <div className="ar-find-hero">
        <h1 className="ar-logo">Arrmy</h1>
        <Form action="/" className="ar-find-box">
          <input type="hidden" name="type" value={type} />
          {by !== 'title' && <input type="hidden" name="by" value={by} />}
          {/* keyed on the tab, so switching tabs drops the last tab's suggestions */}
          <SuggestField
            key={`${type}-${by}`}
            type={type}
            by={by}
            q={q}
            placeholder={by === 'title' ? LABELS[type][2] : BY_LABELS[by][1]}
            label={by === 'title' ? LABELS[type][1] : `${LABELS[type][1]} by ${BY_LABELS[by][0]}`}
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
        {type !== 'all' && (type === 'audiobook' || tmdbEnabled()) && (
          <nav className="ar-seg ar-seg-by" aria-label="Search by">
            {SEARCH_BY[type].map(([b, label]) => (
              <Link key={b} href={`/?type=${type}&by=${b}&q=${encodeURIComponent(q)}`} aria-current={b === by ? 'page' : undefined}>
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {error && <p className="err">{error}</p>}
      {params.notice && <p className="err">{params.notice}</p>}
      {results?.some(({ r }) => r.status?.label === 'Downloading') && <AutoRefresh seconds={5} />}
      {results?.length === 0 && <p className="ar-count">Nothing found for “{q}”.</p>}
      {results && results.length > 0 && (
        <>
          <p className="ar-count">
            {results.length} {results.length === 1 ? 'result' : 'results'} for “{q}”
          </p>
          {/* keyed on the notice, so a refused Request closes its drawer and the notice above shows */}
          <ul className="ar-results" key={params.notice}>
            {results.map(({ r, type: t }, i) => (
              <Result key={`${t}-${r.id}`} r={r} type={t} mode={type} q={q} eager={i < 6} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
