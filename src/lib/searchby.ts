// Searching by actor, director or studio: TMDB finds the person's or company's titles (Radarr's and Sonarr's lookups
// only know titles), then Radarr and Sonarr give each its status, as a title search does.
import { search, searchIds, type SearchResult, type Suggestion } from './arr'
import { findAuthors, searchAudiobooks } from './books'
import type { MediaType } from './db'
import { creditsOf, pickCompanies, pickPerson, type SearchBy } from './searchrules'
import { tmdb, tmdbImage } from './tmdb'

type Page<T> = { results: T[] }
type Person = { id: number; name: string; known_for_department?: string; profile_path?: string | null }
type Company = { id: number; name: string }
type Title = { id: number; popularity?: number; job?: string; genre_ids?: number[] }

export const findPeople = async (q: string) => (await tmdb<Page<Person>>('/search/person', { query: q })).results
export const findCompanies = async (q: string) => (await tmdb<Page<Company>>('/search/company', { query: q })).results

/** TMDB ids of the titles, most popular first, at most 20. */
async function tmdbIds(type: 'movie' | 'tv', by: SearchBy, q: string): Promise<number[]> {
  if (by === 'company') {
    const companies = pickCompanies(await findCompanies(q), q)
    if (!companies.length) return []
    const params = { with_companies: companies.map((c) => c.id).join('|'), sort_by: 'popularity.desc' }
    return (await tmdb<Page<Title>>(`/discover/${type}`, params)).results.map((t) => t.id)
  }
  // shortcut: a name goes to TMDB's best match for it, so of two people with one name only the better known is
  // searchable; pass the person's TMDB id from the suggestions if that comes up.
  const person = pickPerson(await findPeople(q), by)
  if (!person) return []
  const credits = await tmdb<{ cast?: Title[]; crew?: Title[] }>(`/person/${person.id}/${type}_credits`)
  return creditsOf(credits, by).map((t) => t.id)
}

/** A search by something other than a title. Throws when TMDB, Radarr, Sonarr or OpenLibrary can't be reached. */
export async function searchBy(type: MediaType, by: SearchBy, q: string): Promise<SearchResult[]> {
  if (type === 'audiobook') return searchAudiobooks(q, by)
  if (by === 'title') return search(type, q)
  const ids = await tmdbIds(type, by, q)
  if (type === 'movie') return searchIds('movie', ids)
  // Sonarr knows shows by TVDB id; a show TMDB has no TVDB id for can't be Requested, so it's left out
  const external = await Promise.all(ids.map((id) => tmdb<{ tvdb_id?: number | null }>(`/tv/${id}/external_ids`).catch(() => undefined)))
  return searchIds('tv', external.flatMap((e) => (e?.tvdb_id ? [e.tvdb_id] : [])))
}

/** Names to suggest as a person types: people, companies or authors, never titles. Series have nothing to suggest from. */
export async function suggestBy(type: MediaType, by: SearchBy, q: string): Promise<Suggestion[]> {
  if (by === 'author') return (await findAuthors(q)).map((a) => ({ type, id: a.key, title: a.name, status: a.top_work }))
  if (by === 'company') {
    const names = new Set<string>() // TMDB has many companies of one name; picking the name searches them all
    return (await findCompanies(q)).filter((c) => !names.has(c.name) && names.add(c.name)).slice(0, 8).map((c) => ({ type, id: c.id, title: c.name }))
  }
  if (by !== 'actor' && by !== 'director') return []
  return (await findPeople(q)).slice(0, 8).map((p) => ({
    type,
    id: p.id,
    title: p.name,
    poster: tmdbImage(p.profile_path, 'w92'),
    status: p.known_for_department,
  }))
}
