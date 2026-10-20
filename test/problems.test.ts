import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ago as agoText, byDownload, deadReason, missingProblems, movieStuck, queueProblem, seasonStuck, stateLabel, torrentStuck } from '../src/lib/problems.ts'

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()
const record = (over: object) => ({ id: 1, title: 'Release.1080p', size: 100, sizeleft: 50, ...over })

test('a season pack is one download, whatever Sonarr lists per episode', () => {
  const groups = byDownload([record({ id: 1, downloadId: 'A' }), record({ id: 2, downloadId: 'A' }), record({ id: 3, downloadId: 'B' })])
  assert.deepEqual(groups.map((g) => g.map((r) => r.id)), [[1, 2], [3]])
})

test('queue states become the right Problem, with every queue id of the download', () => {
  const ok = [record({ trackedDownloadStatus: 'ok', trackedDownloadState: 'downloading' })]
  assert.equal(queueProblem('radarr', ok), undefined)

  const stalled = [record({ id: 4, trackedDownloadStatus: 'warning', trackedDownloadState: 'downloading', statusMessages: [{ title: 'x', messages: ['The download is stalled with no connections'] }], movie: { title: 'Dune', year: 2021 } })]
  assert.deepEqual(queueProblem('radarr', stalled), {
    kind: 'Failed Download', service: 'radarr', title: 'Dune (2021)', detail: 'The download is stalled with no connections', fix: 'retry', ids: [4], poster: undefined,
  })

  const blocked = [5, 6].map((id) => record({ id, trackedDownloadStatus: 'warning', trackedDownloadState: 'importBlocked', statusMessages: [{ title: 'x', messages: ['No files found are eligible for import'] }], series: { title: 'Bluey' }, seasonNumber: 2 }))
  const problem = queueProblem('sonarr', blocked)
  assert.equal(problem?.kind, 'Failed Import')
  assert.equal(problem?.title, 'Bluey · Season 2')
  assert.deepEqual(problem?.ids, [5, 6])

  assert.equal(queueProblem('radarr', [record({ trackedDownloadStatus: 'warning', trackedDownloadState: 'importPending' })])?.kind, 'Failed Import')
  assert.equal(queueProblem('radarr', [record({ trackedDownloadStatus: 'ok', trackedDownloadState: 'importPending' })]), undefined, 'importing normally')
  assert.equal(queueProblem('radarr', [record({ trackedDownloadState: 'failedPending' })])?.kind, 'Failed Download')
})

test('dead releases: no file list after 5 minutes, or nothing downloaded after 15', () => {
  const now = Date.now()
  const torrent = (state: string, minutes: number, downloaded = 0) => ({
    hash: 'a', name: 'x', category: 'movies', state, downloaded, added_on: (now - minutes * 60_000) / 1000,
    progress: 0, size: 1, dlspeed: 0, num_seeds: 0, num_leechs: 0, eta: 8_640_000, completion_on: -1, last_activity: 0,
  })
  assert.equal(deadReason(torrent('metaDL', 4), now), undefined, 'still fetching its file list')
  assert.equal(deadReason(torrent('metaDL', 6), now), 'No file list after 5 minutes')
  assert.equal(deadReason(torrent('forcedMetaDL', 6), now), 'No file list after 5 minutes')
  assert.equal(deadReason(torrent('stalledDL', 14), now), undefined)
  assert.equal(deadReason(torrent('stalledDL', 16), now), 'Nothing downloaded after 15 minutes')
  assert.equal(deadReason(torrent('downloading', 16), now), 'Nothing downloaded after 15 minutes', 'connected, but nothing arrives')
  assert.equal(deadReason(torrent('stalledDL', 60, 1), now), undefined, 'slow but alive')
  assert.equal(deadReason(torrent('stoppedDL', 60), now), undefined, 'paused by hand')
  assert.equal(deadReason(torrent('queuedDL', 60), now), undefined)
})

test('Missing skips fresh Requests, unreleased titles and anything downloading', () => {
  const movies = [
    { id: 1, title: 'Old', year: 1999, isAvailable: true, added: ago(5) },
    { id: 2, title: 'Just requested', isAvailable: true, added: ago(0.2) },
    { id: 3, title: 'In cinemas', isAvailable: false, added: ago(5) },
    { id: 4, title: 'Downloading', isAvailable: true, added: ago(5) },
  ]
  const series = { title: 'Bluey', added: ago(100) }
  const episodes = [
    { id: 10, seriesId: 7, seasonNumber: 1, airDateUtc: ago(48), series },
    { id: 11, seriesId: 7, seasonNumber: 1, airDateUtc: ago(48), series },
    { id: 12, seriesId: 7, seasonNumber: 2, airDateUtc: ago(2), series }, // aired today: still within the grace day
    { id: 13, seriesId: 7, seasonNumber: 3, airDateUtc: ago(48), series }, // downloading
  ]
  const problems = missingProblems(movies, episodes, [record({ movieId: 4 })], [record({ episodeId: 13 })])
  assert.deepEqual(problems.map((p) => [p.title, p.ids, p.detail]), [
    ['Old (1999)', [1], 'No release found yet.'],
    ['Bluey · Season 1', [10, 11], '2 episodes with no release found yet.'],
  ])
})

test("a torrent's state reads as a word or two", () => {
  assert.equal(stateLabel('downloading'), 'Downloading')
  assert.equal(stateLabel('forcedDL'), 'Downloading')
  assert.equal(stateLabel('stalledDL'), 'Stalled')
  assert.equal(stateLabel('metaDL'), 'Fetching file list')
  assert.equal(stateLabel('queuedDL'), 'Queued')
  assert.equal(stateLabel('stoppedDL'), 'Paused')
  assert.equal(stateLabel('checkingResumeData'), 'Checking')
  assert.equal(stateLabel('missingFiles'), 'Error')
})

test('Stuck: why a movie Radarr wants isn’t downloading', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')
  const movie = (over: object) => ({ id: 7, title: 'Dune', year: 2021, isAvailable: true, added: '2026-10-19T12:00:00Z', ...over })
  const unreleased = movieStuck(movie({ isAvailable: false, inCinemas: '2026-10-01T00:00:00Z', digitalRelease: '2026-12-03T00:00:00Z' }), now)
  assert.equal(unreleased.reason, 'Not released yet')
  assert.equal(unreleased.detail, 'Digital release 3 Dec')
  assert.equal(unreleased.fix, undefined)
  assert.equal(movieStuck(movie({ isAvailable: false, inCinemas: '2027-01-05T00:00:00Z' }), now).detail, 'In cinemas 5 Jan 2027')
  assert.equal(movieStuck(movie({ isAvailable: false }), now).detail, 'No release date yet')
  assert.deepEqual([movieStuck(movie({}), now).reason, movieStuck(movie({}), now).fix], ['Searching', 'search'], 'never searched')
  assert.equal(movieStuck(movie({ added: '2026-10-20T11:30:00Z', lastSearchTime: '2026-10-20T11:31:00Z' }), now).reason, 'Searching', 'added under an hour ago')
  const nothing = movieStuck(movie({ lastSearchTime: '2026-10-20T10:00:00Z' }), now)
  assert.deepEqual([nothing.reason, nothing.detail, nothing.ids], ['Nothing found', 'No release found. Last searched 2 h ago', [7]])
})

test('Stuck: a season with aired episodes and no release', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')
  const ep = (id: number, aired: string, searched?: string) => ({
    id,
    seriesId: 1,
    seasonNumber: 2,
    airDateUtc: aired,
    lastSearchTime: searched,
    series: { title: 'Bluey', added: '2026-10-01T00:00:00Z' },
  })
  const fresh = seasonStuck([ep(1, '2026-10-20T02:00:00Z')], now)
  assert.equal(fresh.reason, 'Searching')
  const old = seasonStuck([ep(1, '2026-10-01T00:00:00Z', '2026-10-20T09:00:00Z'), ep(2, '2026-10-08T00:00:00Z', '2026-10-20T11:00:00Z')], now)
  assert.deepEqual(
    [old.reason, old.title, old.detail, old.ids],
    ['Nothing found', 'Bluey · Season 2', '2 episodes with no release found. Last searched 1 h ago', [1, 2]],
  )
})

test('Stuck: why a torrent isn’t downloading', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')
  const t = (over: object) => ({
    hash: 'a',
    name: 'x',
    category: 'movies',
    state: 'downloading',
    added_on: now / 1000 - 600,
    downloaded: 0,
    progress: 0.345,
    size: 1,
    dlspeed: 0,
    num_seeds: 0,
    num_leechs: 0,
    eta: 0,
    completion_on: -1,
    last_activity: now / 1000 - 1500,
    ...over,
  })
  assert.equal(torrentStuck(t({}), now), undefined, 'downloading')
  assert.equal(torrentStuck(t({ state: 'checkingDL' }), now), undefined, 'checking ends by itself')
  assert.deepEqual(torrentStuck(t({ state: 'stalledDL' }), now), { reason: 'Stalled', detail: '34% done, last moved 25 min ago, 0 seeders' })
  assert.equal(torrentStuck(t({ state: 'stalledDL', last_activity: 0 }), now)?.detail, '34% done, never moved, 0 seeders')
  assert.deepEqual(torrentStuck(t({ state: 'metaDL' }), now), { reason: 'Fetching file list', detail: 'No file list yet, added 10 min ago' })
  assert.equal(torrentStuck(t({ state: 'stoppedDL' }), now)?.detail, 'Paused at 34%')
  assert.equal(torrentStuck(t({ state: 'queuedDL' }), now)?.reason, 'Queued')
})

test('ago reads in minutes, hours, then days', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')
  assert.equal(agoText(now - 20_000, now), '1 min ago')
  assert.equal(agoText(now - 3 * 3_600_000, now), '3 h ago')
  assert.equal(agoText(now - 3 * 86_400_000, now), '3 days ago')
})
