import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inflateSync } from 'node:zlib'
import { allCells, cellName, drawCell, progressBar } from '../src/lib/barart.ts'
import { changes, compareVersions, duration, flatten } from '../src/lib/botrules.ts'
import { COLOUR, downloadEmbed, embed, removedEmbed } from '../src/lib/embeds.ts'

const torrent = { hash: 'a', name: 'Dune.2021.1080p.BluRay', category: 'movies', state: 'downloading', added_on: 0, downloaded: 1, progress: 0.456, size: 4.2e9, dlspeed: 3_355_443, num_seeds: 1234, eta: 840 }
const meta = { app: 'Radarr', appUrl: 'https://radarr.example.com/movie/438631', title: 'Dune (2021)', url: 'https://www.themoviedb.org/movie/438631', art: 'https://image.tmdb.org/p.jpg', by: ['Sam', 'Mum'] }

test('download cards: art, the media page, the bar, then speed, time left, seeders and who asked', () => {
  const card = downloadEmbed(torrent, meta, {})
  assert.equal(card.color, COLOUR.info, 'Downloading is --info')
  assert.deepEqual(card.author, { name: 'Radarr', url: meta.appUrl, icon_url: card.author?.icon_url })
  assert.match(card.author?.icon_url ?? '', /^https:\/\/raw\.githubusercontent\.com\/selfhst\/icons\/[0-9a-f]{40}\/png\/radarr\.png$/)
  assert.equal(card.title, 'Dune (2021)')
  assert.equal(card.url, meta.url)
  assert.deepEqual(card.thumbnail, { url: meta.art })
  assert.equal(card.description, '▰▰▰▰▰▱▱▱▱▱  **45.6%**')
  assert.deepEqual(card.fields?.map((f) => [f.name, f.value]), [
    ['Downloaded', '1.9 GB of 4.2 GB'],
    ['Speed', '3.2 MB/s'],
    ['Time left', '14 min'],
    ['Seeders', '1,234'],
    ['Requested by', 'Sam and Mum'],
  ])
  assert.equal(card.footer?.text, 'Dune.2021.1080p.BluRay', 'the release name, small')

  const waiting = downloadEmbed({ ...torrent, state: 'metaDL', dlspeed: 0, progress: 0 }, undefined, {})
  assert.equal(waiting.title, 'Dune.2021.1080p.BluRay', 'no meta yet: the release name')
  assert.equal(waiting.author?.name, 'Radarr')
  assert.match(waiting.description ?? '', /\*\*0\.0%\*\*\nFetching its file list\.$/)
  assert.deepEqual(waiting.fields?.map((f) => f.name), ['Downloaded', 'Seeders'], 'no speed or time left while nothing moves')

  const done = downloadEmbed({ ...torrent, progress: 1 }, meta, {}, Date.now() - 7_500_000)
  assert.equal(done.color, COLOUR.ok)
  assert.equal(done.description, 'Downloaded 4.2 GB in 2 h 5 min. Requested by Sam and Mum.')
  assert.equal(removedEmbed('x', meta).color, COLOUR.neutral)
  assert.equal(duration(8_640_000), 'unknown')
})

test('embeds: empty fields and non-https art are left out, and long text is cut to fit', () => {
  const e = embed({ colour: 'danger', app: 'Arrmy', title: 'x'.repeat(300), art: 'http://plex:32400/thumb', fields: [['Shown', 'yes'], ['Hidden', undefined], ['Also hidden', false]], at: false })
  assert.equal(e.color, 0x8a3a3a)
  assert.deepEqual(e.author, { name: 'Arrmy' }, 'Arrmy has no icon')
  assert.equal(e.title?.length, 256)
  assert.equal(e.thumbnail, undefined, 'Discord can only show art it can reach')
  assert.deepEqual(e.fields, [{ name: 'Shown', value: 'yes', inline: true }])
  assert.equal(e.timestamp, undefined)
})

test('the progress bar: 10 cells in quarters, as emoji once they are uploaded', () => {
  const emoji = Object.fromEntries(allCells().map(([name], i) => [name, String(1000 + i)]))
  assert.equal(Object.keys(emoji).length, 50)
  const bar = progressBar(0.375, emoji)
  assert.deepEqual(bar.match(/arrmy_bar_v1_\d_\d/g), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => cellName(c, c < 3 ? 4 : c === 3 ? 3 : 0)))
  assert.equal(progressBar(1, {}), '▰'.repeat(10))
  assert.equal(progressBar(-1, {}), '▱'.repeat(10))
})

test('bar cells are 128 px PNGs: the fill runs --btn to --accent, the track is a white overlay', () => {
  const pixels = (png: Buffer) => {
    assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47])
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [128, 128])
    const raw = inflateSync(png.subarray(41, png.length - 12 - 4 + 4 - 4)) // the one IDAT chunk
    return (x: number, y: number) => [...raw.subarray(y * 513 + 1 + x * 4, y * 513 + 5 + x * 4)]
  }
  // --btn #2a6e9e to --accent #66c0f4, across the whole bar
  const at = (x: number) => [0x2a, 0x6e, 0x9e].map((c, i) => Math.round(c + ([0x66, 0xc0, 0xf4][i] - c) * (x / 1280)))
  const first = pixels(drawCell(0, 4))
  assert.deepEqual(first(0, 64).slice(0, 3), at(0), 'starts at --btn')
  assert.deepEqual(first(64, 64), [...at(64), 255])
  assert.deepEqual(first(64, 10), [0, 0, 0, 0], 'transparent outside the band')
  assert.equal(first(2, 48)[3], 0, 'the rounded end leaves its corner empty')
  assert.equal(first(64, 48)[3], 255, 'the straight part does not')
  const last = pixels(drawCell(9, 4))
  assert.deepEqual(last(100, 64), [...at(9 * 128 + 100), 255], 'ends near --accent')
  assert.deepEqual(pixels(drawCell(5, 0))(64, 64), [255, 255, 255, 36], 'track')
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
