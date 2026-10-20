import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bar, changes, compareVersions, downloadMessage, duration, flatten } from '../src/lib/botrules.ts'

test('download messages: progress, speed and time left, or why it is waiting', () => {
  const t = { hash: 'a', name: 'Dune.2021.1080p', category: 'movies', state: 'downloading', added_on: 0, downloaded: 1, progress: 0.456, size: 4.2e9, dlspeed: 3_355_443, num_seeds: 12, eta: 840 }
  assert.equal(downloadMessage(t), '⬇️ **Dune.2021.1080p** · Movie\n▓▓▓▓▓░░░░░░░ 45% of 4.2 GB · 3.2 MB/s · 14 min left · 12 seeds')
  assert.match(downloadMessage({ ...t, state: 'metaDL', dlspeed: 0, progress: 0 }), /0% of 4\.2 GB · fetching its file list · 12 seeds$/)
  assert.equal(downloadMessage({ ...t, progress: 1, category: 'books' }), '✅ **Dune.2021.1080p** · Audiobook\nDone · 4.2 GB')
  assert.equal(bar(0), '░'.repeat(12))
  assert.equal(duration(7_500), '2 h 5 min')
  assert.equal(duration(8_640_000), 'unknown')
})

test('settings snapshots: provider fields by name, lists by name, secrets hidden, noise dropped', () => {
  const radarr = {
    downloadclient: [{ id: 1, name: 'qBittorrent', enable: true, fields: [{ name: 'host', value: 'gluetun' }, { name: 'password', value: 'hunter2' }, { name: 'movieCategory', value: 'movies' }] }],
    rootfolder: [{ id: 1, path: '/data/media/movies', freeSpace: 123 }],
    tag: [],
  }
  const flat = flatten(radarr)
  assert.equal(flat['downloadclient › qBittorrent › fields › host'], 'gluetun')
  assert.match(flat['downloadclient › qBittorrent › fields › password'], /^\(hidden [0-9a-f]{6}\)$/)
  assert.equal(flat['rootfolder › 1 › path'], '/data/media/movies')
  assert.ok(!Object.keys(flat).some((k) => k.includes('freeSpace')), 'free space changes by itself')

  radarr.downloadclient[0].fields[2].value = 'films'
  radarr.downloadclient[0].fields[1].value = 'correct horse'
  radarr.rootfolder[0].freeSpace = 99
  const lines = changes(flat, flatten(radarr))
  assert.equal(lines.length, 2)
  assert.equal(lines[1], 'downloadclient › qBittorrent › fields › movieCategory: movies → films')
  assert.match(lines[0], /^downloadclient › qBittorrent › fields › password: \(hidden \w+\) → \(hidden \w+\)$/)
  assert.ok(!lines.join().includes('hunter2') && !lines.join().includes('correct horse'))
  assert.deepEqual(changes({ a: '1' }, { b: '2' }), ['b: added (2)', 'a: removed'])
  assert.equal(changes({}, Object.fromEntries([...Array(20)].map((_, i) => [`k${i}`, '1']))).at(-1), '…and 5 more')
})

test('versions compare by their numbers, whatever the prefix', () => {
  assert.equal(compareVersions('v6.5.0.10800', '6.4.4.10685'), 1)
  assert.equal(compareVersions('release-5.2.4', 'v5.2.4'), 0)
  assert.equal(compareVersions('1.43.4.10903-e5521bd8c', '1.43.4.10903-0a1b2c3d4'), 0, 'build hash ignored')
  assert.equal(compareVersions('2.37.1', '2.38.0'), -1)
})
