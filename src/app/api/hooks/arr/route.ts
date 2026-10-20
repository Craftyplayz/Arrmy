import { requestDetails } from '@/lib/arr'
import { addLog, logItem, markAvailable, waitingRequests } from '@/lib/db'
import type { Grabbed, Imported } from '@/lib/logrules'
import { tellDiscord } from '@/lib/notify'
import { hookToken, safeEqual, sessionSecret } from '@/lib/token'

type MediaInfo = { videoCodec?: string; height?: number; audioLanguages?: string | string[]; subtitles?: string | string[] }
type File = { relativePath?: string; size?: number; quality?: string; mediaInfo?: MediaInfo }

// Radarr and Sonarr send languages as a list, or as one "eng/fre" string in older versions.
const langs = (v?: string | string[]) => (Array.isArray(v) ? v : (v?.split('/') ?? [])).map((s) => s.trim()).filter(Boolean)

/** Radarr and Sonarr call this when they grab a release and after every import (the "Arrmy" webhook the Wiring adds). */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!safeEqual(token, hookToken(sessionSecret()))) return new Response('Forbidden', { status: 403 })

  const event = await request.json()
  const id = Number(event.movie?.tmdbId ?? event.series?.tvdbId)
  if (!id || (event.eventType !== 'Grab' && event.eventType !== 'Download')) return new Response(null, { status: 204 })
  const type = event.movie ? 'movie' : 'tv'
  const seasons: number[] | undefined = event.episodes ? [...new Set<number>(event.episodes.map((e: { seasonNumber: number }) => e.seasonNumber))] : undefined
  const downloadId = event.downloadId?.toLowerCase()

  if (event.eventType === 'Grab') {
    if (downloadId) {
      const r = event.release ?? {}
      addLog(logItem(type, id), 'grabbed', { downloadId, release: r.releaseTitle, indexer: r.indexer, size: r.size, quality: r.quality, seasons } satisfies Grabbed)
    }
    return new Response(null, { status: 204 })
  }

  const file: File = event.movieFile ?? event.episodeFile ?? event.episodeFiles?.[0] ?? {}
  const m = file.mediaInfo ?? {}
  addLog(logItem(type, id), 'imported', {
    downloadId,
    file: file.relativePath,
    size: file.size,
    quality: file.quality,
    videoCodec: m.videoCodec,
    resolution: m.height ? `${m.height}p` : undefined,
    audioLanguages: langs(m.audioLanguages),
    subtitles: langs(m.subtitles),
    seasons,
  } satisfies Imported)

  const waiting = waitingRequests(type, id)
  const details = await requestDetails(waiting)
  for (const [i, r] of waiting.entries()) {
    if (details[i].status?.label !== 'Available') continue
    markAvailable(r.id)
    tellDiscord(r)
  }
  return new Response(null, { status: 204 })
}
