// Request Log rules: the steps of one Request, from the events Arrmy recorded for its title. No I/O here, so they can be
// unit-tested.
import { duration, size } from './botrules.ts'
import { speed } from './embeds.ts'

/** What happened, recorded as it happened (see requestlog.ts). Times are SQLite UTC ("2026-10-20 21:57:29"). */
export type LogEvent = { kind: LogKind; detail: string; at: string }
export type LogKind = 'grabbed' | 'dead' | 'downloaded' | 'imported' | 'playable'

/** detail, by kind. seasons: which seasons of a show the event is about (none for movies and books). */
export type Grabbed = { downloadId: string; release?: string; indexer?: string; size?: number; quality?: string; seasons?: number[] }
export type Dead = { downloadId: string; reason: string; seasons?: number[] }
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
export type Step = { name: string; start: number; end?: number; lines: { text: string; admin?: boolean }[] }

export const utc = (sqlite: string) => Date.parse(`${sqlite.replace(' ', 'T')}Z`)
const list = (xs?: string[]) => (xs?.length ? [...new Set(xs)].join(', ') : undefined)

/**
 * The Request's steps, oldest first: Requested, Searching, then per release Downloading and Importing, and finally
 * In Plex (or Audiobookshelf). A dead release ends its Downloading step and starts Searching again.
 */
export function buildSteps(request: { created_at: string; username: string; seasons: number[] }, events: LogEvent[]) {
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
    if (!mine(d.seasons)) continue
    if (e.kind === 'grabbed') {
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
        step.lines.push({ text: 'Never started, so Arrmy tried another release.' }, { text: x.reason, admin: true })
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
      step.lines.push({ text: `Subtitles: ${list(x.subtitles) ?? 'none'}` })
      if (!landing) steps.push((landing = { name: 'Showing up in Plex', start: at, lines: [] }))
    } else if (e.kind === 'playable') {
      const x = d as Playable
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

/** The whole log as plain text, for the Copy log button. */
export function logText(title: string, steps: Step[], total: number | undefined, admin: boolean, now = Date.now()) {
  const lines = [`Request Log: ${title}`, '']
  for (const s of steps) {
    const time = took(s, now)
    lines.push(`${clock(s.start)}  ${s.name}${time ? ` (${time}${s.end === undefined ? ' so far' : ''})` : ''}`)
    for (const l of s.lines.filter((l) => admin || !l.admin)) lines.push(`    ${l.text}`)
  }
  if (total !== undefined) lines.push('', `Request to playable: ${duration(total)}`)
  return lines.join('\n')
}
