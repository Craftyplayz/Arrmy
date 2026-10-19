import assert from 'node:assert/strict'
import { test } from 'node:test'
import { movieStatus, seriesStatus, type Season } from '../src/lib/status.ts'
import { createToken, readToken } from '../src/lib/token.ts'

const secret = 'a-test-secret-of-32-characters!!'

test('session token round-trips and rejects tampering and expiry', () => {
  const token = createToken(secret, 42, 1000, 0)
  assert.equal(readToken(secret, token, 500), 42)
  assert.equal(readToken(secret, token, 1001), null, 'expired')
  assert.equal(readToken('another-secret-of-32-characters!', token, 500), null, 'wrong secret')
  assert.equal(readToken(secret, token.replace(/^42/, '1'), 500), null, 'swapped user id')
  assert.equal(readToken(secret, 'garbage', 500), null)
  assert.equal(readToken(secret, undefined, 500), null)
})

test('movie status', () => {
  const queue = [{ movieId: 1, size: 100, sizeleft: 25 }]
  assert.equal(movieStatus(undefined, queue), null)
  assert.deepEqual(movieStatus({ id: 1, hasFile: true }, queue), { label: 'Available' })
  assert.deepEqual(movieStatus({ id: 1, hasFile: false }, queue), { label: 'Downloading', progress: 75 })
  assert.deepEqual(movieStatus({ id: 2, hasFile: false }, queue), { label: 'Requested' })
})

test('series status only counts the requested seasons', () => {
  const season = (seasonNumber: number, files: number, episodes: number, monitored = true): Season => ({
    seasonNumber,
    monitored,
    statistics: { episodeFileCount: files, episodeCount: episodes },
  })
  const series = { id: 7, seasons: [season(0, 0, 3), season(1, 10, 10), season(2, 4, 10), season(3, 0, 0, false)] }
  assert.deepEqual(seriesStatus(series, [], [1]), { label: 'Available' })
  assert.deepEqual(seriesStatus(series, [], [1, 2]), { label: 'Partially available' })
  assert.deepEqual(seriesStatus(series, [{ seriesId: 7, size: 10, sizeleft: 5 }], [2]), { label: 'Downloading', progress: 50 })
  assert.deepEqual(seriesStatus(series, []), { label: 'Partially available' }, 'defaults to monitored seasons, skips specials')
  assert.equal(seriesStatus(series, [], [9]), null, 'season not in Sonarr')
  assert.equal(seriesStatus(undefined, []), null)
})
