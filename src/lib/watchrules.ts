// Watch history from Tautulli: which plays belong to a Request, what nobody watches, and the weekly summary. Pure,
// so it's tested (test/watch.test.ts); tautulli.ts does the fetching.

/** One play in Tautulli's history (get_history), grouped so a resumed play counts once. */
export type Play = {
  /** Unix seconds. */
  date: number
  user_id: number
  friendly_name: string
  full_title: string
  title: string
  grandparent_title: string
  media_type: string
  parent_media_index: number | null
  media_index: number | null
  rating_key: number
  grandparent_rating_key: number | null
  percent_complete: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
/** A Request nobody has watched this long after it became Available shows under Unwatched on the Admin view. */
export const UNWATCHED_AFTER_MS = 8 * WEEK_MS

/** A Request's plays: the movie, or the show's episodes in the requested seasons (every season if none are listed). */
export function playsOf(type: string, seasons: number[], plexKey: number | undefined, plays: Play[]) {
  if (plexKey === undefined) return []
  if (type === 'movie') return plays.filter((p) => p.media_type === 'movie' && p.rating_key === plexKey)
  return plays.filter((p) => p.grandparent_rating_key === plexKey && (!seasons.length || seasons.includes(p.parent_media_index ?? -1)))
}

/** `S1E3` for an episode, nothing for a movie. */
export const episodeCode = (p: Play) => (p.media_type === 'episode' && p.parent_media_index !== null ? `S${p.parent_media_index}E${p.media_index}` : '')

export const isUnwatched = (availableMs: number, plays: Play[], now: number) => !plays.length && now - availableMs >= UNWATCHED_AFTER_MS

/** The most played movies, shows and people since `fromMs`, `count` of each. */
export function topPlays(plays: Play[], fromMs: number, count = 5) {
  const recent = plays.filter((p) => p.date * 1000 >= fromMs)
  const top = (name: (p: Play) => string | undefined) => {
    const n = new Map<string, number>()
    for (const p of recent) {
      const k = name(p)
      if (k) n.set(k, (n.get(k) ?? 0) + 1)
    }
    return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, count)
  }
  return {
    movies: top((p) => (p.media_type === 'movie' ? p.title : undefined)),
    shows: top((p) => (p.media_type === 'episode' ? p.grandparent_title : undefined)),
    people: top((p) => p.friendly_name),
  }
}

/**
 * One line per person for #weekly-summary: `**Sam**: Dune · Severance (4 episodes)`, busiest first. `url` links each
 * title (its Activity thread) when it has somewhere to go.
 */
export function weekSummary(plays: Play[], fromMs: number, url: (p: Play) => string | undefined = () => undefined) {
  const people = new Map<string, Map<string, { eps: number; url?: string }>>()
  for (const p of plays.filter((p) => p.date * 1000 >= fromMs).sort((a, b) => a.date - b.date)) {
    const titles = people.get(p.friendly_name) ?? new Map<string, { eps: number; url?: string }>()
    const title = p.media_type === 'episode' ? p.grandparent_title : p.title
    const t = titles.get(title) ?? { eps: 0, url: url(p) }
    if (p.media_type === 'episode') t.eps++
    titles.set(title, t)
    people.set(p.friendly_name, titles)
  }
  const shown = (title: string, link?: string) => (link ? `[${title}](<${link}>)` : title)
  return [...people]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([name, titles]) => `**${name}**: ${[...titles].map(([t, { eps, url }]) => shown(t, url) + (eps ? ` (${eps} ${eps === 1 ? 'episode' : 'episodes'})` : '')).join(' · ')}`)
}

/** The week's id (that Sunday's date) once it's Sunday from 18:00 in the server's time zone and the week isn't sent yet. */
export function summaryDue(now: Date, lastSent: string | undefined) {
  if (now.getDay() !== 0 || now.getHours() < 18) return undefined
  const week = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return week === lastSent ? undefined : week
}
