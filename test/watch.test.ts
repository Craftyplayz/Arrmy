import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isUnwatched, playsOf, summaryDue, topPlays, UNWATCHED_AFTER_MS, weekSummary, type Play } from '../src/lib/watchrules.ts'

const DAY = 86_400_000
const now = Date.parse('2026-10-25T19:00:00')
const movie = (title: string, key: number, who: string, daysAgo: number): Play => ({
  date: (now - daysAgo * DAY) / 1000,
  user_id: who.length,
  friendly_name: who,
  full_title: title,
  title,
  grandparent_title: '',
  media_type: 'movie',
  parent_media_index: null,
  media_index: null,
  rating_key: key,
  grandparent_rating_key: null,
  percent_complete: 100,
})
const episode = (show: string, key: number, season: number, ep: number, who: string, daysAgo: number): Play => ({
  ...movie(`Episode ${ep}`, 1000 + ep, who, daysAgo),
  full_title: `${show} - Episode ${ep}`,
  grandparent_title: show,
  media_type: 'episode',
  parent_media_index: season,
  media_index: ep,
  grandparent_rating_key: key,
})

const plays = [
  movie('Dune', 10, 'Sam', 1),
  movie('Dune', 10, 'Crafty', 2),
  episode('Severance', 20, 1, 1, 'Sam', 3),
  episode('Severance', 20, 1, 2, 'Sam', 3),
  episode('Severance', 20, 2, 1, 'Crafty', 20),
  movie('Alien', 30, 'Crafty', 40),
]

test("a Request's plays: the movie, or the show's episodes in the requested seasons", () => {
  assert.equal(playsOf('movie', [], 10, plays).length, 2)
  assert.equal(playsOf('tv', [1], 20, plays).length, 2)
  assert.equal(playsOf('tv', [], 20, plays).length, 3, 'no seasons listed: every season')
  assert.deepEqual(playsOf('movie', [], undefined, plays), [], 'not in Plex yet')
  assert.deepEqual(playsOf('movie', [], 20, plays), [], "a show's key never matches a movie")
})

test('unwatched: nobody played it, 8 weeks after it became Available', () => {
  assert.equal(isUnwatched(now - UNWATCHED_AFTER_MS, [], now), true)
  assert.equal(isUnwatched(now - UNWATCHED_AFTER_MS + DAY, [], now), false, 'not 8 weeks yet')
  assert.equal(isUnwatched(now - 100 * DAY, [plays[0]], now), false)
})

test('most played movies, shows and people in the last 30 days', () => {
  const top = topPlays(plays, now - 30 * DAY)
  assert.deepEqual(top.movies, [['Dune', 2]], 'Alien is older than 30 days')
  assert.deepEqual(top.shows, [['Severance', 3]])
  assert.deepEqual(top.people, [['Sam', 3], ['Crafty', 2]])
})

test('the weekly summary: one line per person, busiest first, titles in the order watched', () => {
  assert.deepEqual(weekSummary(plays, now - 7 * DAY), ['**Sam**: Severance (2 episodes) · Dune', '**Crafty**: Dune'])
  assert.deepEqual(weekSummary(plays, now), [])
})

test('the weekly summary is due once, on Sunday from 18:00', () => {
  assert.equal(summaryDue(new Date('2026-10-25T17:59:00'), undefined), undefined, 'Sunday, too early')
  assert.equal(summaryDue(new Date('2026-10-25T18:00:00'), undefined), '2026-10-25')
  assert.equal(summaryDue(new Date('2026-10-25T23:00:00'), '2026-10-25'), undefined, 'already sent')
  assert.equal(summaryDue(new Date('2026-10-26T19:00:00'), '2026-10-18'), undefined, 'Monday: missed weeks are skipped')
})
