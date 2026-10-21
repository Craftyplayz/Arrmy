import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSteps, logText, stats, type LogEvent, type LogKind } from '../src/lib/logrules.ts'
import { bookInfo, titleInfo } from '../src/lib/titlerules.ts'

const ev = (kind: LogKind, at: string, detail: object): LogEvent => ({ kind, at: `2026-10-20 ${at}`, detail: JSON.stringify(detail) })
const request = { created_at: '2026-10-20 10:00:00', username: 'Crafty', seasons: [] as number[] }

test('a movie: Requested, Searching, Downloading, Importing, In Plex, and the total', () => {
  const { steps, total } = buildSteps(request, [
    ev('grabbed', '10:05:00', { downloadId: 'a', release: 'Dune.2021.1080p', indexer: '1337x', size: 2e9, quality: 'Bluray-1080p' }),
    ev('downloaded', '10:25:00', { downloadId: 'a', seconds: 1200, size: 2.4e9, seeds: 40, peers: 3 }),
    ev('imported', '10:26:00', { downloadId: 'a', file: 'Dune (2021).mkv', quality: 'Bluray-1080p', resolution: '1080p', videoCodec: 'x265', audioLanguages: ['English', 'English'], subtitles: [] }),
    ev('playable', '10:28:00', { app: 'Plex' }),
  ])
  assert.deepEqual(steps.map((s) => s.name), ['Requested', 'Searching', 'Downloading', 'Importing', 'In Plex'])
  assert.equal(steps[1].end! - steps[1].start, 5 * 60_000, 'searched for 5 minutes')
  assert.deepEqual(steps[2].lines.map((l) => [l.text, !!l.admin]), [
    ['Dune.2021.1080p', true],
    ['1337x · 2.0 GB · Bluray-1080p', true],
    ['1.9 MB/s on average, up to 40 seeders and 3 peers', false],
  ])
  assert.deepEqual(steps[3].lines.map((l) => l.text), ['Dune (2021).mkv', 'Bluray-1080p · 1080p · x265', 'Audio: English', 'Subtitles: none'])
  assert.equal(total, 28 * 60, 'Request to playable')
  const text = logText('Dune (2021)', steps, total, false, Date.parse('2026-10-20T11:00:00Z'))
  assert.ok(!text.includes('1337x') && !text.includes('Dune.2021'), 'a Requester sees no release names or indexers')
  assert.ok(text.endsWith('Request to playable: 28 min'))
})

test('a dead release ends its download and starts Searching again; nothing finished = no total', () => {
  const { steps, total } = buildSteps(request, [
    ev('grabbed', '10:01:00', { downloadId: 'a' }),
    ev('dead', '10:16:00', { downloadId: 'a', reason: 'Nothing downloaded after 15 minutes' }),
    ev('grabbed', '10:17:00', { downloadId: 'b' }),
  ])
  assert.deepEqual(steps.map((s) => [s.name, s.end === undefined]), [
    ['Requested', false],
    ['Searching', false],
    ['Downloading', false],
    ['Searching again', false],
    ['Downloading', true],
  ])
  assert.equal(total, undefined)
})

test('a show: only events for the seasons this Request asked for, and nothing from before it', () => {
  const { steps } = buildSteps({ ...request, seasons: [2] }, [
    { kind: 'grabbed', at: '2026-10-19 09:00:00', detail: JSON.stringify({ downloadId: 'old', seasons: [2] }) },
    ev('grabbed', '10:02:00', { downloadId: 's1', seasons: [1] }),
    ev('grabbed', '10:03:00', { downloadId: 's2', seasons: [2] }),
  ])
  assert.deepEqual(steps.map((s) => s.name), ['Requested', 'Searching', 'Downloading · Season 2'])
})

const rel = (title: string, rejections: string[] = []) => ({ title, indexer: '1337x', size: 2e9, seeders: 9, quality: 'Bluray-1080p', rejections })

test("Arrmy's search: what was found for everyone, the indexers and every release for the Admin", () => {
  const { steps } = buildSteps(request, [
    ev('searched', '10:00:10', {
      releases: [rel('Dune.2021.1080p'), rel('Dune.2021.2160p', ['Over the size limit'])],
      indexers: [{ name: '1337x', ms: 1200, results: 2, ok: true }, { name: 'EZTV', ms: 30000, results: 0, ok: false }],
      picked: 'Dune.2021.1080p',
    }),
    ev('grabbed', '10:00:11', { downloadId: 'a' }),
  ])
  assert.deepEqual(steps[1].lines.map((l) => [l.text, !!l.admin]), [
    ['2 releases found, 1 acceptable', false],
    ['Indexers: 1337x 2 in 1.2 s, EZTV failed', true],
    ['Picked Dune.2021.1080p', true],
  ])
  assert.equal(steps[1].releases?.length, 2)
  const text = logText('Dune', steps, undefined, true)
  assert.ok(text.includes('- Dune.2021.2160p · 1337x · 2.0 GB · Bluray-1080p · 9 seeders · Over the size limit'))
  assert.ok(!logText('Dune', steps, undefined, false).includes('2160p'), 'a Requester sees no releases')
})

test('nothing acceptable: why, then Waiting for a release until Search again or a grab', () => {
  const nothing = { releases: [rel('a', ['Over the size limit']), rel('b', ['Over the size limit', 'Not enough seeders'])], indexers: [] }
  const { steps } = buildSteps(request, [
    ev('searched', '10:00:10', nothing),
    ev('note', '11:00:00', { text: 'Search again', by: 'Crafty' }),
    ev('searched', '11:00:10', nothing),
    ev('grabbed', '12:00:00', { downloadId: 'a' }),
  ])
  assert.deepEqual(steps.map((s) => [s.name, s.end === undefined]), [
    ['Requested', false],
    ['Searching', false],
    ['Waiting for a release', false],
    ['Search again', false],
    ['Searching again', false],
    ['Waiting for a release', false],
    ['Downloading', true],
  ])
  assert.equal(steps[1].lines[0].text, 'None of 2 releases was acceptable: Over the size limit (2); Not enough seeders (1).')
})

test("an edit shows only in its own Request's log; Try another release says who", () => {
  const { steps } = buildSteps({ ...request, id: 7, seasons: [1] }, [
    ev('note', '10:01:00', { text: 'Added Season 2', by: 'Mum', request: 8 }),
    ev('note', '10:02:00', { text: 'Removed Season 3', by: 'Crafty', request: 7 }),
    ev('grabbed', '10:03:00', { downloadId: 'a', seasons: [1] }),
    ev('dead', '10:04:00', { downloadId: 'a', reason: 'Try another release', by: 'Crafty', seasons: [1] }),
  ])
  assert.deepEqual(steps.map((s) => s.name), ['Requested', 'Searching', 'Removed Season 3', 'Downloading · Season 1', 'Searching again'])
  assert.deepEqual(steps[3].lines.map((l) => l.text), ['Crafty chose Try another release.'])
})

test('an audiobook: filed with no subtitles line, then In Audiobookshelf', () => {
  const { steps, total } = buildSteps({ ...request, app: 'Audiobookshelf' }, [
    ev('grabbed', '10:01:00', { downloadId: 'a', release: 'Dune - Frank Herbert' }),
    ev('downloaded', '10:11:00', { downloadId: 'a', seconds: 600, size: 1e9, seeds: 5, peers: 1 }),
    ev('imported', '10:15:00', { downloadId: 'a', file: 'Dune.m4b' }),
    ev('playable', '10:17:00', { app: 'Audiobookshelf' }),
  ])
  assert.deepEqual(steps.map((s) => s.name), ['Requested', 'Searching', 'Downloading', 'Importing', 'In Audiobookshelf'])
  assert.deepEqual(steps[3].lines.map((l) => l.text), ['Dune.m4b'])
  assert.equal(total, 17 * 60)
})

test('already in Audiobookshelf: Searching ends there, and the log is complete', () => {
  const { steps, total } = buildSteps({ ...request, app: 'Audiobookshelf' }, [
    ev('note', '10:02:00', { text: 'Already in Audiobookshelf, so nothing to download' }),
    ev('playable', '10:02:00', { app: 'Audiobookshelf' }),
  ])
  assert.deepEqual(steps.map((s) => s.name), ['Requested', 'Searching', 'Already in Audiobookshelf, so nothing to download', 'In Audiobookshelf'])
  assert.equal(total, 2 * 60)
})

test('stats: totals and the average speed over finished downloads', () => {
  const s = stats([
    ev('downloaded', '10:25:00', { downloadId: 'a', seconds: 100, size: 1e9, seeds: 40, peers: 3 }),
    ev('downloaded', '10:45:00', { downloadId: 'b', seconds: 100, size: 3e9, seeds: 9, peers: 12 }),
  ])
  assert.deepEqual([s.downloads, s.bytes, s.bps, s.seeds, s.peers], [2, 4e9, 2e7, 40, 12])
  assert.equal(stats([]).bps, undefined)
})

test('titleInfo: facts, links and the backdrop, skipping what is missing', () => {
  const movie = titleInfo('movie', {
    overview: 'x', genres: ['Sci-Fi'], runtime: 155, studio: 'Legendary', inCinemas: '2021-10-22T00:00:00Z', imdbId: 'tt1160419', tmdbId: 438631,
    ratings: { imdb: { value: 8.0 }, rottenTomatoes: { value: 83 } }, images: [{ coverType: 'fanart', remoteUrl: 'http://f' }],
  })
  assert.deepEqual(movie.facts, [['Rating', 'IMDb 8.0 · Rotten Tomatoes 83%'], ['Genres', 'Sci-Fi'], ['Runtime', '2h 35m'], ['Studio', 'Legendary'], ['In cinemas', '2021-10-22']])
  assert.deepEqual(movie.links.map((l) => l.label), ['IMDb', 'TMDB'])
  assert.equal(movie.backdrop, 'http://f')
  assert.deepEqual(titleInfo('tv', { network: 'HBO', ratings: { value: 9.1 }, tvdbId: 1 }).facts, [['Rating', '9.1 / 10'], ['Network', 'HBO']])
})

test('cast: Radarr credits without the crew, Sonarr actors, at most 12; a book from OpenLibrary', () => {
  const credits = [
    { personName: 'Timothée Chalamet', character: 'Paul', type: 'cast', images: [{ coverType: 'headshot', remoteUrl: 'http://p' }] },
    { personName: 'Denis Villeneuve', type: 'crew' },
    ...Array.from({ length: 20 }, (_, i) => ({ personName: `A${i}`, type: 'cast' })),
  ]
  const movie = titleInfo('movie', {}, credits)
  assert.equal(movie.cast.length, 12)
  assert.deepEqual(movie.cast[0], { name: 'Timothée Chalamet', character: 'Paul', photo: 'http://p' })
  assert.deepEqual(titleInfo('tv', { actors: [{ name: 'Pedro Pascal', character: 'Joel' }] }).cast, [{ name: 'Pedro Pascal', character: 'Joel', photo: undefined }])
  const book = bookInfo('OL1W', { description: { value: 'A desert planet.' }, subjects: ['Sci-Fi'], first_publish_date: '1965' }, 'Frank Herbert', 4.4, 'Full Cast')
  assert.equal(book.overview, 'A desert planet.')
  assert.deepEqual(book.facts.map((f) => f[0]), ['Author', 'Edition', 'First published', 'Rating', 'Subjects'])
  assert.equal(book.links[0].href, 'https://openlibrary.org/works/OL1W')
})
