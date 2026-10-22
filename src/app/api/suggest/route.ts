import { searchMany, type Suggestion } from '@/lib/arr'
import { suggestBy } from '@/lib/searchby'
import { searchByOf } from '@/lib/searchrules'
import { currentUser } from '@/lib/session'
import { tmdbEnabled } from '@/lib/tmdb'

/**
 * Titles for the search field's suggestions as a person types, only of the Media Type tab they are on (or All). When
 * searching by person, company or author, their names instead.
 */
export async function GET(req: Request) {
  if (!(await currentUser())) return new Response('Not signed in', { status: 401 })
  const params = new URL(req.url).searchParams
  const type = params.get('type')
  const mode = type === 'movie' || type === 'tv' || type === 'audiobook' ? type : 'all'
  const q = params.get('q')?.trim().slice(0, 100) ?? ''
  if (q.length < 2) return Response.json([])
  const by = searchByOf(mode, params.get('by'), tmdbEnabled())
  if (mode !== 'all' && by !== 'title') {
    try {
      return Response.json(await suggestBy(mode, by, q))
    } catch (e) {
      console.error(e)
      return new Response("The search isn't responding", { status: 502 })
    }
  }
  const { found } = await searchMany(mode, q)
  if (!found) return new Response("The search isn't responding", { status: 502 })
  return Response.json(
    found.slice(0, 8).map(({ r, type }): Suggestion => ({
      type,
      id: r.id,
      title: r.title,
      year: r.year,
      poster: r.poster,
      status: r.status?.label,
    })),
  )
}
