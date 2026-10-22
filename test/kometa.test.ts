import assert from 'node:assert/strict'
import { test } from 'node:test'
import { kometaFiles, yaml } from '../src/lib/kometarules.ts'

const request = (username: string, media_type: 'movie' | 'tv', external_id: number, status: 'requested' | 'available' = 'available') => ({ username, media_type, external_id, status })
const files = (requests: ReturnType<typeof request>[], leaving: ReturnType<typeof request>[] = []) =>
  kometaFiles({ plexUrl: 'http://plex:32400', plexToken: 'tok', tmdbKey: 'key', requests, leaving })

test('yaml: nested maps, lists of maps, one-line lists of scalars, quoted strings and odd keys', () => {
  assert.equal(
    yaml({ a: { b: 1, 'Requested by x:y': [603, 604], list: [{ default: 'franchise' }, { file: 'f', n: 2 }], empty: {} }, s: 'he said "hi"' }),
    'a:\n  b: 1\n  "Requested by x:y": [603, 604]\n  list:\n    - default: "franchise"\n    - file: "f"\n      n: 2\n  empty: {}\ns: "he said \\"hi\\""\n',
  )
})

test('a "Requested by" collection per person and library, with TMDB ids for movies and TVDB ids for shows', () => {
  const out = files([request('alice', 'movie', 603), request('bob', 'movie', 604), request('alice', 'movie', 603), request('alice', 'tv', 81189)])
  const movies = out['arrmy/movies-collections.yml']
  assert.match(movies, /Requested by alice:\n {4}tmdb_movie: \[603\]\n {4}sync_mode: "sync"/)
  assert.match(movies, /Requested by bob:\n {4}tmdb_movie: \[604\]/)
  assert.match(out['arrmy/tv-collections.yml'], /Requested by alice:\n {4}tvdb_show: \[81189\]/)
  assert.doesNotMatch(out['arrmy/tv-collections.yml'], /bob/)
})

test('a library with no Requests has no collections file and the config does not list one', () => {
  const out = files([request('alice', 'movie', 603)])
  assert.equal(out['arrmy/tv-collections.yml'], undefined)
  assert.match(out['config.yml'], /TV Shows:\n {4}collection_files:\n {6}- default: "franchise"\n {4}overlay_files:/)
  assert.match(out['config.yml'], /Movies:\n {4}collection_files:\n {6}- default: "franchise"\n {6}- file: "config\/arrmy\/movies-collections.yml"/)
})

test('the config has Plex, TMDB and no Radarr or Sonarr, so Kometa can never download', () => {
  const config = files([])['config.yml']
  assert.match(config, /plex:\n {2}url: "http:\/\/plex:32400"\n {2}token: "tok"/)
  assert.match(config, /tmdb:\n {2}apikey: "key"/)
  assert.doesNotMatch(config, /radarr|sonarr|add_missing/)
  assert.match(config, /save_report: true/)
  assert.match(config, /- default: "status"/) // shows only
  assert.equal(config.match(/- default: "status"/g)?.length, 1)
})

test('overlays: New always, More coming for shows still waiting, Leaving soon for Unwatched Requests', () => {
  const out = files([request('alice', 'tv', 1, 'requested'), request('alice', 'movie', 2, 'requested'), request('bob', 'movie', 3)], [request('bob', 'movie', 3)])
  const movies = out['arrmy/movies-overlays.yml']
  const tv = out['arrmy/tv-overlays.yml']
  assert.match(movies, /New:\n {4}plex_all: true\n {4}filters:\n {6}added: 14/)
  assert.match(movies, /Leaving soon:\n {4}tmdb_movie: \[3\]/)
  assert.doesNotMatch(movies, /More coming/) // a movie is in Plex whole or not at all
  assert.match(tv, /More coming:\n {4}tvdb_show: \[1\]/)
  assert.doesNotMatch(tv, /Leaving soon/)
  assert.match(tv, /name: "text\(MORE COMING\)"\n {6}group: "arrmy"\n {6}weight: 20/)
})
