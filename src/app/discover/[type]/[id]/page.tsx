import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { search, type SearchResult } from '@/lib/arr'
import { cardOf, isDiscoverType, runtimeText, trailerOf, type Raw } from '@/lib/discoverrules'
import { requireUser } from '@/lib/session'
import { tmdb, tmdbEnabled, tmdbImage } from '@/lib/tmdb'
import { RequestButton, TvAction } from '../../../results'
import { requestMovie } from '../../../actions'
import { Badge, day } from '../../../ui'

type Detail = Raw & {
  overview?: string
  tagline?: string
  vote_average?: number
  vote_count?: number
  backdrop_path?: string | null
  genres?: { id: number; name: string }[]
  runtime?: number
  episode_run_time?: number[]
  number_of_seasons?: number
  number_of_episodes?: number
  status?: string
  last_air_date?: string
  credits?: { cast: { id: number; name: string; character?: string; profile_path?: string | null }[] }
  videos?: { results: { key: string; site: string; type: string; official?: boolean }[] }
  similar?: { results: Raw[] }
  external_ids?: { tvdb_id?: number | null }
  release_dates?: { results: { iso_3166_1: string; release_dates: { type: number; release_date: string }[] }[] }
}

const get = (type: string, id: string) =>
  tmdb<Detail>(`/${type}/${id}`, { append_to_response: type === 'movie' ? 'credits,videos,similar,release_dates' : 'credits,videos,similar,external_ids' }).catch((e) => {
    console.error(e)
  })

export async function generateMetadata({ params }: { params: Promise<{ type: string; id: string }> }): Promise<Metadata> {
  const { type, id } = await params
  if (!isDiscoverType(type) || !tmdbEnabled() || !/^\d+$/.test(id)) return { title: 'Discover' }
  const d = await get(type, id)
  return { title: (type === 'movie' ? d?.title : d?.name) ?? 'Discover' }
}

export default async function ItemPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  await requireUser()
  const { type, id } = await params
  if (!isDiscoverType(type) || !/^\d+$/.test(id)) notFound()
  if (!tmdbEnabled()) return <p className="err">Discover is off. The Admin needs to set TMDB_API_KEY.</p>
  const d = await get(type, id)
  if (!d) return <p className="err">TMDB isn't responding, or has no such title. <Link href="/discover">Back to Discover</Link></p>

  const title = (type === 'movie' ? d.title : d.name) ?? ''
  const tvdbId = d.external_ids?.tvdb_id || undefined
  // Arrmy's own view of it: its status and, for a show, the seasons still open to request. Radarr or Sonarr down = no controls.
  const canRequest = type === 'movie' || !!tvdbId
  const mine: SearchResult | undefined = canRequest
    ? await search(type, type === 'movie' ? `tmdb:${id}` : `tvdb:${tvdbId}`).then((r) => r[0], (e) => void console.error(e))
    : undefined

  const trailer = trailerOf(d.videos?.results)
  const cast = (d.credits?.cast ?? []).slice(0, 12)
  const similar = (d.similar?.results ?? []).filter((r) => r.poster_path).slice(0, 12).map((r) => cardOf(type, r, (p) => tmdbImage(p, 'w185')))
  const date = (s?: string) => (s ? day(new Date(s)) : undefined)
  const digital = d.release_dates?.results.flatMap((c) => c.release_dates).filter((r) => r.type === 4 || r.type === 5).map((r) => r.release_date).sort()[0]
  const facts: [string, string | undefined][] =
    type === 'movie'
      ? [
          ['Runtime', d.runtime ? runtimeText(d.runtime) : undefined],
          ['In cinemas', date(d.release_date)],
          ['At home', date(digital)],
        ]
      : [
          ['Seasons', d.number_of_seasons ? `${d.number_of_seasons} (${d.number_of_episodes} episodes)` : undefined],
          ['Episode length', d.episode_run_time?.[0] ? runtimeText(d.episode_run_time[0]) : undefined],
          ['First aired', date(d.first_air_date)],
          ['Last aired', date(d.last_air_date)],
          ['Status', d.status],
        ]

  return (
    <article className="dc-item">
      <Link href="/discover" className="dc-back">&larr; Discover</Link>
      {d.backdrop_path && <img className="dc-backdrop" src={tmdbImage(d.backdrop_path, 'w1280')} alt="" loading="lazy" decoding="async" />}
      <div className="ar-panel">
        <div className="dc-top">
          {d.poster_path && <img className="ar-title-poster dc-poster" src={tmdbImage(d.poster_path, 'w342')} alt="" width={180} height={270} loading="lazy" decoding="async" />}
          <div className="ar-title">
            <h1 className="page-title">
              {title} {d.release_date || d.first_air_date ? <small>({(d.release_date ?? d.first_air_date)!.slice(0, 4)})</small> : null}
            </h1>
            {d.tagline && <p className="muted">{d.tagline}</p>}
            <div className="badges">
              <span className={`ar-type ar-type-${type}`}>{type === 'movie' ? 'Movie' : 'TV Show'}</span>
              {!!d.vote_count && <span className="pill">&#9733; {d.vote_average?.toFixed(1)} ({d.vote_count.toLocaleString('en-GB')} votes)</span>}
              {d.genres?.map((g) => <span key={g.id} className="pill">{g.name}</span>)}
              {mine?.status && <Badge status={mine.status} />}
            </div>
            {d.overview && <p>{d.overview}</p>}
            <dl className="dc-facts">
              {facts.map(([k, v]) => v && <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            <div className="actions">
              {trailer && <a className="btn" href={`https://www.youtube.com/watch?v=${trailer}`} target="_blank" rel="noreferrer">Watch trailer</a>}
              {mine && type === 'movie' && <RequestButton r={mine} action={requestMovie} />}
            </div>
            {type === 'tv' && !tvdbId && <p className="muted">This show has no TheTVDB entry, so it can't be requested.</p>}
            {canRequest && !mine && <p className="muted">Radarr or Sonarr isn't responding, so it can't be requested right now.</p>}
            {mine && type === 'tv' && <TvAction r={mine} q="" mode="tv" />}
          </div>
        </div>
      </div>
      {cast.length > 0 && (
        <section className="ar-panel">
          <h2>Cast</h2>
          <ul className="ar-cast">
            {cast.map((p) => (
              <li key={p.id}>
                {p.profile_path ? <img src={tmdbImage(p.profile_path, 'w92')} alt="" width={36} height={36} loading="lazy" /> : <span className="ar-cast-none" />}
                <span className="grow">
                  <b>{p.name}</b>
                  <small>{p.character}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {similar.length > 0 && (
        <section className="ar-panel">
          <h2>Similar</h2>
          <ul className="dc-row">
            {similar.map((c) => (
              <li key={c.id}>
                <Link href={`/discover/${type}/${c.id}`} className="dc-card">
                  <img src={c.poster} alt="" width={140} height={210} loading="lazy" decoding="async" />
                  <b>{c.title}</b>
                  {c.year && <small>{c.year}</small>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
