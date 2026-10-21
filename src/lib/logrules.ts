// Request Log rules: the steps of one Request, from the events Arrmy recorded for its title. No I/O here, so they can be
// unit-tested.
import { duration, size } from './botrules.ts'
import { speed } from './embeds.ts'

/** What happened, recorded as it happened (see requestlog.ts). Times are SQLite UTC ("2026-10-20 21:57:29"). */
export type LogEvent = { kind: LogKind; detail: string; at: string }
export type LogKind = 'searched' | 'grabbed' | 'dead' | 'downloaded' | 'imported' | 'playable' | 'note'

/** detail, by kind. seasons: which seasons of a show the event is about (none for movies and books). */
/** One release a search returned. No rejections = acceptable. */
export type Release = { title: string; indexer: string; size: number; seeders?: number; quality?: string; score?: number; rejections: string[] }
/** How one indexer answered a search: ms = its slowest query, results = how many it returned. */
export type IndexerHealth = { name: string; ms: number; results: number; ok: boolean }
/** Arrmy's own search (movies): every release, best first, and which one it grabbed. */
export type Searched = { releases: Release[]; indexers: IndexerHealth[]; picked?: string; error?: string }
/** Something a person did: an edit (only in that Request's log), or a one-click fix (for every Request of the title). */
export type Note = { text: string; by?: string; seasons?: number[]; request?: number }
export type Grabbed = { downloadId: string; release?: string; indexer?: string; size?: number; quality?: string; seasons?: number[] }
/** by: the person who clicked Try another release; none = Arrmy swapped it by itself. */
export type Dead = { downloadId: string; reason: string; by?: string; seasons?: number[] }
export type Downloaded = { downloadId: string; seconds: number; size: number; seeds: number; peers: number; seasons?: number[] }
export type Imported = {
  downloadId?: string
  file?: string
  size?: number
  quality?: string
  videoCodec?: string
  resolution?: string
  audioLanguages?: string[]
  subtitles?: string[]
  seasons?: number[]
}
export type Playable = { app: string; seasons?: number[] }

/** One step of the log. No end = still running. Lines marked admin are only for the Admin's eyes. */
export type Step = { name: string; start: number; end?: number; lines: { text: string; admin?: boolean }[]; releases?: Release[] }

export const utc = (sqlite: string) => Date.parse(`${sqlite.replace(' ', 'T')}Z`)
const list = (xs?: string[]) => (xs?.length ? [...new Set(xs)].join(', ') : undefined)

/** Why a search grabbed nothing, in a line: the commonest reasons its releases were turned down. */
export function whyNothing(releases: Release[]) {
  if (!releases.length) return 'The indexers returned no releases.'
  const counts = new Map<string, number>()
  for (const r of releases) for (const why of new Set(r.rejections)) counts.set(why, (counts.get(why) ?? 0) + 1)
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3)
  return `None of ${releases.length} release${releases.length > 1 ? 's' : ''} was acceptable: ${top.map(([why, n]) => `${why} (${n})`).join('; ')}.`
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`

/**
 * The Request's steps, oldest first: Requested, Searching, then per release Downloading and Importing, and finally
 * In Plex (or Audiobookshelf). A dead release ends its Downloading step and starts Searching again.
 */
export function buildSteps(request: { id?: number; created_at: string; username: string; seasons: number[]; app?: string }, events: LogEvent[]) {
  const app = request.app ?? 'Plex'
  const created = utc(request.created_at)
  const label = (name: string, seasons?: number[]) => (seasons?.length ? `${name} · Season${seasons.length > 1 ? 's' : ''} ${seasons.join(', ')}` : name)
  // A show's events count when they're about a season this Request asked for.
  const mine = (seasons?: number[]) => !request.seasons.length || !seasons?.length || seasons.some((s) => request.seasons.includes(s))

  const steps: Step[] = [{ name: 'Requested', start: created, end: created, lines: [{ text: `By ${request.username}` }] }]
  let searching: Step | undefined = { name: 'Searching', start: created, lines: [] }
  steps.push(searching)
  const downloads = new Map<string, Step>()
  const imports = new Map<string, Step>()
  let landing: Step | undefined // waiting to show up in Plex or Audiobookshelf

  for (const e of events.filter((e) => utc(e.at) >= created - 60_000)) {
    const at = utc(e.at)
    const d = JSON.parse(e.detail)
    if (e.kind === 'note' && d.request !== undefined ? d.request !== request.id : !mine(d.seasons)) continue
    if (e.kind === 'searched') {
      const x = d as Searched
      if (searching?.name === 'Waiting for a release') {
        searching.end = at
        searching = undefined
      }
      if (!searching) steps.push((searching = { name: 'Searching again', start: at, lines: [] }))
      const ok = x.releases.filter((r) => !r.rejections.length).length
      if (x.error) searching.lines.push({ text: 'The search failed, so Radarr searched by itself.' }, { text: x.error, admin: true })
      else if (ok) searching.lines.push({ text: `${x.releases.length} releases found, ${ok} acceptable` })
      else searching.lines.push({ text: whyNothing(x.releases) })
      if (x.indexers.length)
        searching.lines.push({
          text: `Indexers: ${x.indexers.map((i) => `${i.name} ${i.ok ? `${i.results} in ${seconds(i.ms)}` : 'failed'}`).join(', ')}`,
          admin: true,
        })
      if (x.picked) searching.lines.push({ text: `Picked ${x.picked}`, admin: true })
      if (x.releases.length) searching.releases = x.releases
      if (!x.picked && !x.error) {
        // Nothing to grab: Radarr keeps checking new releases, and the log waits for one.
        searching.end = at
        steps.push((searching = { name: 'Waiting for a release', start: at, lines: [] }))
      }
    } else if (e.kind === 'note') {
      const x = d as Note
      steps.push({ name: label(x.text, x.seasons), start: at, end: at, lines: x.by ? [{ text: `By ${x.by}` }] : [] })
    } else if (e.kind === 'grabbed') {
      const g = d as Grabbed
      if (searching) searching.end = at
      searching = undefined
      const step: Step = { name: label('Downloading', g.seasons), start: at, lines: [] }
      if (g.release) step.lines.push({ text: g.release, admin: true })
      const facts = [g.indexer, g.size ? size(g.size) : undefined, g.quality].filter(Boolean).join(' · ')
      if (facts) step.lines.push({ text: facts, admin: true })
      downloads.set(g.downloadId, step)
      steps.push(step)
    } else if (e.kind === 'dead') {
      const x = d as Dead
      const step = downloads.get(x.downloadId)
      if (step) {
        step.end = at
        if (x.by) step.lines.push({ text: `${x.by} chose Try another release.` })
        else step.lines.push({ text: 'Never started, so Arrmy tried another release.' }, { text: x.reason, admin: true })
      }
      searching = { name: 'Searching again', start: at, lines: [] }
      steps.push(searching)
    } else if (e.kind === 'downloaded') {
      const x = d as Downloaded
      const step = downloads.get(x.downloadId)
      if (step) {
        step.end = at
        const average = x.seconds > 0 ? `${speed(x.size / x.seconds)} on average` : undefined
        step.lines.push({ text: [average, `up to ${x.seeds} seeders and ${x.peers} peers`].filter(Boolean).join(', ') })
      }
      const importing: Step = { name: 'Importing', start: at, lines: [] }
      imports.set(x.downloadId, importing)
      steps.push(importing)
    } else if (e.kind === 'imported') {
      const x = d as Imported
      // A download Arrmy didn't see finish (grabbed before the log existed) gets its Importing step here.
      let step = x.downloadId ? imports.get(x.downloadId) : undefined
      if (!step) steps.push((step = { name: label('Imported', x.seasons), start: at, lines: [] }))
      step.end = at
      const downloading = x.downloadId ? downloads.get(x.downloadId) : undefined
      if (downloading && !downloading.end) downloading.end = at
      if (x.file) step.lines.push({ text: x.file, admin: true })
      const facts = [x.quality, x.resolution, x.videoCodec, x.size ? size(x.size) : undefined].filter(Boolean).join(' · ')
      if (facts) step.lines.push({ text: facts })
      if (list(x.audioLanguages)) step.lines.push({ text: `Audio: ${list(x.audioLanguages)}` })
      if (x.subtitles) step.lines.push({ text: `Subtitles: ${list(x.subtitles) ?? 'none'}` }) // audiobooks have none to list
      if (!landing) steps.push((landing = { name: `Showing up in ${app}`, start: at, lines: [] }))
    } else if (e.kind === 'playable') {
      const x = d as Playable
      if (searching) searching.end ??= at // already there, nothing was downloaded
      searching = undefined
      if (!landing) steps.push((landing = { name: `Showing up in ${x.app}`, start: at, lines: [] }))
      landing.name = `In ${x.app}`
      landing.end = at
      landing = undefined
    }
  }
  const last = steps.at(-1)!
  const done = steps.every((s) => s.end !== undefined) && last.name.startsWith('In ')
  return { steps, total: done ? (last.end! - created) / 1000 : undefined }
}

const clock = (ms: number) => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** How long a step took, or has been running. */
export const took = (step: Step, now = Date.now()) => (step.end === step.start ? '' : duration(((step.end ?? now) - step.start) / 1000))

/** One release on a line: acceptable ones start with +, rejected ones end with why. */
export const releaseText = (r: Release) =>
  [`${r.rejections.length ? '-' : '+'} ${r.title}`, r.indexer, size(r.size), r.quality, r.seeders !== undefined && `${r.seeders} seeders`, r.rejections.join('; ')]
    .filter(Boolean)
    .join(' · ')

/** The whole log as plain text, for the Copy log button. */
export function logText(title: string, steps: Step[], total: number | undefined, admin: boolean, now = Date.now()) {
  const lines = [`Request Log: ${title}`, '']
  for (const s of steps) {
    const time = took(s, now)
    lines.push(`${clock(s.start)}  ${s.name}${time ? ` (${time}${s.end === undefined ? ' so far' : ''})` : ''}`)
    for (const l of s.lines.filter((l) => admin || !l.admin)) lines.push(`    ${l.text}`)
    if (admin) for (const r of s.releases ?? []) lines.push(`      ${releaseText(r)}`)
  }
  if (total !== undefined) lines.push('', `Request to playable: ${duration(total)}`)
  return lines.join('\n')
}
