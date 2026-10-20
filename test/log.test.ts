import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSteps, logText, type LogEvent, type LogKind } from '../src/lib/logrules.ts'

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
