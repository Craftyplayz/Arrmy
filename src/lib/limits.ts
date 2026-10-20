// Size Limits: applied to Radarr and Sonarr so oversized releases are never grabbed, plus the show check at request time.
import { arr, setCustomFormat } from './arr'
import { getLimits, getSetting, setSetting, type Limits } from './db'
import { seasonLabel } from './status'

type QualityDefinition = { id: number; minSize: number | null; maxSize: number | null; preferredSize: number | null }

/** Movies: a custom format matching any release over the limit, scored so low that no quality profile accepts it. */
const applyMovieLimit = (gb: number) =>
  setCustomFormat('radarr', 'Arrmy size limit', -10_000, gb
    ? [{ implementation: 'SizeSpecification', name: 'Bigger than the limit', values: { min: gb, max: 100_000 } }]
    : [])

/**
 * Episodes: Sonarr's quality sizes are MB per minute and judge season packs per episode, so the limit is per hour of
 * episode. Sonarr's own sizes are saved the first time and put back when the limit is removed.
 */
async function applyEpisodeLimit(gbPerHour: number) {
  const saved = getSetting<QualityDefinition[]>('sonarrSizes')
  if (!gbPerHour && !saved) return
  const current = await arr<QualityDefinition[]>('sonarr', '/qualitydefinition')
  const original = saved ?? current
  const cap = (gbPerHour * 1024) / 60
  const under = (mb: number | null) => (mb === null ? cap : Math.min(mb, cap)) // null = Sonarr's "unlimited"

  const next = current.map((d) => {
    const o = original.find((x) => x.id === d.id) ?? d
    return gbPerHour
      ? { ...d, minSize: Math.min(o.minSize ?? 0, cap), maxSize: under(o.maxSize), preferredSize: under(o.preferredSize) }
      : { ...d, minSize: o.minSize, maxSize: o.maxSize, preferredSize: o.preferredSize }
  })
  await arr('sonarr', '/qualitydefinition/update', 'PUT', next)
  setSetting(
    'sonarrSizes',
    gbPerHour ? original.map(({ id, minSize, maxSize, preferredSize }) => ({ id, minSize, maxSize, preferredSize })) : undefined,
  )
}

export async function applyLimits(limits: Limits) {
  await applyMovieLimit(limits.movieGb)
  await applyEpisodeLimit(limits.episodeGb)
}

/** Worst case for these seasons: every episode at the per-hour limit, using each episode's real length. */
async function worstCaseGb(tvdbId: number, seasons: number[], gbPerHour: number) {
  // Sonarr's own metadata server: it knows every episode before the show is in Sonarr.
  const res = await fetch(`https://skyhook.sonarr.tv/v1/tvdb/shows/en/${tvdbId}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`skyhook → ${res.status}`)
  const show: { runtime?: number; episodes: { seasonNumber: number; runtime?: number }[] } = await res.json()
  const minutes = show.episodes
    .filter((e) => seasons.includes(e.seasonNumber))
    .reduce((n, e) => n + (e.runtime || show.runtime || 60), 0)
  return Math.ceil((minutes / 60) * gbPerHour)
}

/** Why these seasons of a show (all of them, across every Request) can't be requested, or undefined if they can. */
export async function showLimitProblem(tvdbId: number, seasons: number[]) {
  const { episodeGb, showGb } = getLimits()
  if (!episodeGb || !showGb) return
  try {
    const estimate = await worstCaseGb(tvdbId, seasons, episodeGb)
    if (estimate > showGb)
      return `${seasonLabel(seasons)} could take up to ${estimate} GB, over the ${showGb} GB show limit. Pick fewer seasons.`
  } catch (e) {
    // shortcut: when Sonarr's metadata server is down the show limit isn't checked; the per-episode limit still applies.
    console.warn(`[limits] no estimate for TVDB ${tvdbId}: ${(e as Error).message}`)
  }
}
