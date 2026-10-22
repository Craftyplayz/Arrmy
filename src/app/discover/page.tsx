import type { Metadata } from 'next'
import Link from 'next/link'
import { cardsFrom, genresOf, statusesFor, type Genre } from '@/lib/discover'
import { isDiscoverType, type Card, type DiscoverType } from '@/lib/discoverrules'
import { requireUser } from '@/lib/session'
import { tmdbEnabled } from '@/lib/tmdb'
import { Hero } from '../ui'
import { Row } from './row'

export const metadata: Metadata = { title: 'Discover' }

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ genre?: string }> }) {
  await requireUser()
  const lede = 'What is popular and coming soon. Open a title to request it.'
  if (!tmdbEnabled())
    return (
      <>
        <Hero title="Discover" lede={lede} />
        <p className="err">Discover is off. The Admin needs to set TMDB_API_KEY (a free key from themoviedb.org).</p>
      </>
    )

  const [kind, rawId] = (await searchParams).genre?.split('-') ?? []
  const genreType: DiscoverType | undefined = kind && isDiscoverType(kind) && Number(rawId) > 0 ? kind : undefined
  const settled = await Promise.allSettled([
    cardsFrom('movie', '/trending/movie/week'),
    cardsFrom('tv', '/trending/tv/week'),
    cardsFrom('movie', '/movie/upcoming'),
    genresOf('movie'),
    genresOf('tv'),
    genreType ? cardsFrom(genreType, `/discover/${genreType}`, { with_genres: rawId, sort_by: 'popularity.desc' }) : Promise.resolve([] as Card[]),
  ])
  settled.forEach((r) => r.status === 'rejected' && console.error(r.reason))
  const [trendingMovies, trendingShows, upcoming, movieGenres, tvGenres, inGenre] = settled.map((r) => (r.status === 'fulfilled' ? r.value : []))
  if (settled.every((r) => r.status === 'rejected'))
    return (
      <>
        <Hero title="Discover" lede={lede} />
        <p className="err">TMDB isn't responding. Try again in a minute.</p>
      </>
    )

  const cards = [...trendingMovies, ...trendingShows, ...upcoming, ...inGenre] as Card[]
  const statuses = await statusesFor(cards)
  const genres: [DiscoverType, string, Genre[]][] = [
    ['movie', 'Movie genres', movieGenres as Genre[]],
    ['tv', 'TV genres', tvGenres as Genre[]],
  ]
  const picked = genres.find(([t]) => t === genreType)?.[2].find((g) => g.id === Number(rawId))

  return (
    <>
      <Hero title="Discover" lede={lede} />
      <Row title="Trending movies" cards={trendingMovies as Card[]} statuses={statuses} />
      <Row title="Trending shows" cards={trendingShows as Card[]} statuses={statuses} />
      <Row title="Upcoming movies" cards={upcoming as Card[]} statuses={statuses} />
      <section className="ar-panel" id="genres">
        <h2>Genres</h2>
        {genres.map(([t, label, list]) => (
          <nav key={t} className="dc-genres" aria-label={label}>
            <span>{label}</span>
            {list.map((g) => (
              <Link key={g.id} href={`/discover?genre=${t}-${g.id}#genres`} scroll={false} aria-current={t === genreType && g.id === Number(rawId) ? 'page' : undefined}>
                {g.name}
              </Link>
            ))}
          </nav>
        ))}
      </section>
      {genreType && picked && <Row title={`Popular ${genreType === 'movie' ? 'movies' : 'shows'}: ${picked.name}`} cards={inGenre as Card[]} statuses={statuses} />}
    </>
  )
}
