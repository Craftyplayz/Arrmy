import assert from 'node:assert/strict'
import { test } from 'node:test'
import { byDownload, deadReason, missingProblems, queueProblem } from '../src/lib/problems.ts'

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
    progress: 0, size: 1, dlspeed: 0, num_seeds: 0, eta: 8_640_000,
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
