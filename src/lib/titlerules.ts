// What a Request's page says about the title itself, from Radarr's and Sonarr's lookups (which carry TMDB's and TheTVDB's
// data). No I/O here, so it can be unit-tested.

type Rating = { value?: number }
export type Lookup = {
  overview?: string
  genres?: string[]
  runtime?: number
  certification?: string
  studio?: string
  network?: string
  status?: string
  firstAired?: string
  inCinemas?: string
  digitalRelease?: string
  youTubeTrailerId?: string
  imdbId?: string
  tmdbId?: number
  tvdbId?: number
  /** Radarr: {imdb, tmdb, rottenTomatoes}. Sonarr: {value}, out of 10. */
  ratings?: { imdb?: Rating; tmdb?: Rating; rottenTomatoes?: Rating } & Rating
  images?: { coverType: string; remoteUrl?: string }[]
  /** Sonarr's cast, when its version has one. */
  actors?: Credit[]
}

/** One person in the cast: Radarr's /credit rows (personName) or Sonarr's actors (name). */
export type Credit = { name?: string; personName?: string; character?: string; type?: string; images?: { coverType: string; remoteUrl?: string }[] }
export type CastMember = { name: string; character?: string; photo?: string }

export type TitleInfo = { overview?: string; backdrop?: string; cast: CastMember[]; facts: [string, string][]; links: { label: string; href: string }[] }

const date = (iso?: string) => iso?.slice(0, 10)
const runtime = (min?: number) => (min ? (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`) : undefined)

/** The first 12 actors. Radarr's credits mix in the crew (type "crew"); those are left out. */
export const castOf = (credits: Credit[] = []): CastMember[] =>
  credits
    .filter((c) => c.type !== 'crew' && (c.name ?? c.personName))
    .slice(0, 12)
    .map((c) => ({ name: (c.name ?? c.personName)!, character: c.character || undefined, photo: c.images?.find((i) => i.coverType === 'headshot')?.remoteUrl ?? c.images?.[0]?.remoteUrl }))

export function titleInfo(type: 'movie' | 'tv', m: Lookup, credits?: Credit[]): TitleInfo {
  const r = m.ratings ?? {}
  const rating = [
    r.imdb?.value && `IMDb ${r.imdb.value.toFixed(1)}`,
    r.tmdb?.value && `TMDB ${r.tmdb.value.toFixed(1)}`,
    r.rottenTomatoes?.value && `Rotten Tomatoes ${Math.round(r.rottenTomatoes.value)}%`,
    r.value && `${r.value.toFixed(1)} / 10`,
  ].filter(Boolean)
  const facts: [string, string | undefined][] = [
    ['Rating', rating.join(' · ') || undefined],
    ['Genres', m.genres?.join(', ') || undefined],
    ['Runtime', runtime(m.runtime)],
    ['Certification', m.certification],
    [type === 'movie' ? 'Studio' : 'Network', type === 'movie' ? m.studio : m.network],
    ['In cinemas', date(m.inCinemas)],
    ['Digital release', date(m.digitalRelease)],
    ['First aired', date(m.firstAired)],
    ['Show status', m.status],
  ]
  const links = [
    m.imdbId && { label: 'IMDb', href: `https://www.imdb.com/title/${m.imdbId}/` },
    type === 'movie' && m.tmdbId && { label: 'TMDB', href: `https://www.themoviedb.org/movie/${m.tmdbId}` },
    type === 'tv' && m.tvdbId && { label: 'TheTVDB', href: `https://www.thetvdb.com/?tab=series&id=${m.tvdbId}` },
    m.youTubeTrailerId && { label: 'Trailer', href: `https://www.youtube.com/watch?v=${m.youTubeTrailerId}` },
  ].filter((l): l is { label: string; href: string } => !!l)
  return {
    overview: m.overview,
    cast: castOf(credits ?? m.actors),
    backdrop: m.images?.find((i) => i.coverType === 'fanart')?.remoteUrl,
    facts: facts.filter((f): f is [string, string] => !!f[1]),
    links,
  }
}

/** OpenLibrary's work record: description is text or {value}; the rating comes from its ratings endpoint. */
export type OpenLibraryWork = { description?: string | { value?: string }; subjects?: string[]; first_publish_date?: string }

export function bookInfo(bookId: string, work: OpenLibraryWork, author?: string, rating?: number, edition?: string): TitleInfo {
  const facts: [string, string | undefined][] = [
    ['Author', author],
    ['Edition', edition],
    ['First published', work.first_publish_date],
    ['Rating', rating ? `${rating.toFixed(1)} / 5` : undefined],
    ['Subjects', work.subjects?.slice(0, 6).join(', ')],
  ]
  return {
    overview: typeof work.description === 'string' ? work.description : work.description?.value,
    cast: [],
    facts: facts.filter((f): f is [string, string] => !!f[1]),
    links: [{ label: 'OpenLibrary', href: `https://openlibrary.org/works/${bookId}` }],
  }
}
