// Kometa's files, built from Arrmy's Requests: its config.yml, a "Requested by <name>" collection per person and
// Arrmy's own overlays. Pure, so it's tested (test/kometa.test.ts); kometa.ts writes them into Kometa's folder.
import type { RequestRow } from './db'

type Request = Pick<RequestRow, 'username' | 'media_type' | 'external_id' | 'status'>

/** Plex's library names (plex.ts LIBRARIES) and the Kometa builder that finds a Request's id in each. */
const LIBRARIES = [
  { type: 'movie', name: 'Movies', file: 'movies', builder: 'tmdb_movie' },
  { type: 'tv', name: 'TV Shows', file: 'tv', builder: 'tvdb_show' },
] as const

const key = (k: string) => (/^[A-Za-z_][\w -]*$/.test(k) && !k.endsWith(' ') ? k : JSON.stringify(k))
const scalar = (v: unknown) => (typeof v === 'string' ? JSON.stringify(v) : String(v)) // JSON strings are YAML strings
const isScalar = (v: unknown) => v === null || typeof v !== 'object'

/** Block YAML for plain objects, arrays and scalars; lists of scalars go on one line. */
export function yaml(value: object, indent = ''): string {
  const entries = Array.isArray(value) ? value.map((v) => ['-', v]) : Object.entries(value).map(([k, v]) => [`${key(k)}:`, v])
  return entries
    .map(([head, v]) => {
      if (isScalar(v)) return `${indent}${head} ${scalar(v)}\n`
      if (Array.isArray(v) && v.every(isScalar)) return `${indent}${head} [${v.map(scalar).join(', ')}]\n`
      if (!Object.keys(v).length) return `${indent}${head} {}\n`
      if (head === '-') return `${indent}- ${yaml(v, `${indent}  `).slice(indent.length + 2)}`
      return `${indent}${head}\n${yaml(v, `${indent}  `)}`
    })
    .join('')
}

const ids = (requests: Request[]) => [...new Set(requests.map((r) => r.external_id))]

// Bottom left, clear of Kometa's resolution (top left), audio (top centre) and show status (left, lower) overlays.
// One group, so a poster shows only the heaviest: Leaving soon, then More coming, then New.
const badge = (text: string, weight: number) => ({
  name: `text(${text})`,
  group: 'arrmy',
  weight,
  horizontal_align: 'left',
  horizontal_offset: 15,
  vertical_align: 'bottom',
  vertical_offset: 30,
  font_size: 55,
  font_color: '#FFFFFF',
  back_color: '#000000B3',
  back_radius: 30,
  back_padding: 20,
})

/**
 * Every file Kometa needs, by path inside its config folder. Kometa gets no Radarr or Sonarr, so a title missing from
 * a collection can never be downloaded by itself; it lands in Kometa's missing report (`<library>_report.yml`) instead.
 * `leaving` are the Unwatched Requests (watchrules.ts), shown as Leaving soon.
 */
export function kometaFiles(o: { plexUrl: string; plexToken: string; tmdbKey: string; requests: Request[]; leaving: Request[] }) {
  const files: Record<string, string> = {}
  const libraries: Record<string, object> = {}
  for (const lib of LIBRARIES) {
    const requests = o.requests.filter((r) => r.media_type === lib.type)
    const people = [...new Set(requests.map((r) => r.username))].sort()
    const collections = Object.fromEntries(
      people.map((name) => [
        `Requested by ${name}`,
        {
          [lib.builder]: ids(requests.filter((r) => r.username === name)),
          sync_mode: 'sync', // a deleted Request leaves the collection
          save_report: false, // Requests not in Plex yet are Arrmy's to download, not "missing"
          summary: `What ${name} asked for in Arrmy.`,
        },
      ]),
    )
    const more = ids(requests.filter((r) => lib.type === 'tv' && r.status === 'requested')) // seasons still to come
    const leaving = ids(o.leaving.filter((r) => r.media_type === lib.type))
    const overlays = {
      New: { plex_all: true, filters: { added: 14 }, overlay: badge('NEW', 10) },
      ...(more.length ? { 'More coming': { [lib.builder]: more, overlay: badge('MORE COMING', 20) } } : {}),
      ...(leaving.length ? { 'Leaving soon': { [lib.builder]: leaving, overlay: badge('LEAVING SOON', 30) } } : {}),
    }
    if (people.length) files[`arrmy/${lib.file}-collections.yml`] = yaml({ collections })
    files[`arrmy/${lib.file}-overlays.yml`] = yaml({ overlays })
    libraries[lib.name] = {
      collection_files: [{ default: 'franchise' }, ...(people.length ? [{ file: `config/arrmy/${lib.file}-collections.yml` }] : [])],
      overlay_files: [
        { default: 'resolution' }, // 4K and 1080p, with HDR, HDR10+ and Dolby Vision
        { default: 'audio_codec' }, // Atmos, DTS-HD MA, TrueHD…
        ...(lib.type === 'tv' ? [{ default: 'status' }] : []), // Airing, Returning, Canceled, Ended
        { file: `config/arrmy/${lib.file}-overlays.yml` },
      ],
      // A "Requested by" collection whose person has no Requests left is deleted; only Kometa's own collections.
      operations: { delete_collections: { configured: false, managed: true } },
    }
  }
  files['config.yml'] = `# Written by Arrmy every 30 minutes; edits here are overwritten.\n${yaml({
    plex: { url: o.plexUrl, token: o.plexToken, timeout: 60 },
    tmdb: { apikey: o.tmdbKey, language: 'en' },
    libraries,
    settings: { save_report: true, show_missing: true },
  })}`
  return files
}
