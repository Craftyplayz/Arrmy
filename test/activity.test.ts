import assert from 'node:assert/strict'
import { test } from 'node:test'
import { absSession, activityThread, look, playCard, plexSession, type Activity, type Session } from '../src/lib/activityrules.ts'
import { weekSummary, type Play } from '../src/lib/watchrules.ts'

const MIN = 60_000
const t0 = Date.parse('2026-10-23T20:00:00Z')
const episode = (id: string, over: Partial<Session> = {}): Session => ({
  id,
  thread: 'play:plex:100',
  title: 'Severance',
  type: 'tv',
  item: '101',
  user: 'Sam',
  device: 'Apple TV',
  detail: 'S1E1 · Good News About Hell',
  playing: true,
  ...over,
})

/** Looks every 30 s from `from` for `minutes`, with `sessions` playing throughout. */
function watch(state: Activity | undefined, sessions: Session[], from: number, minutes: number) {
  const posts = [], edits = []
  for (let t = from; t <= from + minutes * MIN; t += MIN / 2) {
    const r = look(state, sessions, t)
    for (const p of r.post) p.message = `m${p.session}`
    posts.push(...r.post)
    edits.push(...r.edit)
    state = r.state
  }
  return { state: state!, posts, edits }
}

test('the first look only records: what was already playing never gets a card', () => {
  const first = look(undefined, [episode('a')], t0)
  const { posts } = watch(first.state, [episode('a')], t0 + MIN / 2, 10)
  assert.equal(first.post.length + posts.length, 0)
})

test('a play gets a card once it passes a minute, and only one', () => {
  const empty = look(undefined, [], t0).state
  const { posts } = watch(empty, [episode('a')], t0, 0.5)
  assert.equal(posts.length, 0)
  const more = watch(empty, [episode('a')], t0, 5)
  assert.equal(more.posts.length, 1)
  assert.equal(more.posts[0].started, t0)
})

test('paused time is not watched time, and a long gap between looks is skipped', () => {
  const empty = look(undefined, [], t0).state
  assert.equal(watch(empty, [episode('a', { playing: false })], t0, 10).posts.length, 0)
  let s = look(empty, [episode('a')], t0).state
  s = look(s, [episode('a')], t0 + 30 * MIN).state // Arrmy was down
  assert.equal(s.live.a.watched, 0)
})

test('stopping edits the card with the end time; a quick look under a minute is dropped', () => {
  const empty = look(undefined, [], t0).state
  const played = watch(empty, [episode('a'), episode('b', { user: 'Mum', item: '102' })], t0, 0.5)
  const stopped = look(played.state, [], t0 + MIN)
  assert.deepEqual(stopped.edit, [])
  const long = watch(empty, [episode('a')], t0, 20)
  const end = look(long.state, [], t0 + 21 * MIN)
  assert.equal(end.edit.length, 1)
  assert.equal(end.edit[0].ended, t0 + 20 * MIN)
  assert.equal(end.edit[0].watched, 20 * 60)
})

test('the same person back at the same episode within 30 minutes edits the old card', () => {
  const empty = look(undefined, [], t0).state
  const first = watch(empty, [episode('a')], t0, 10)
  let state = look(first.state, [], t0 + 11 * MIN).state
  const back = watch(state, [episode('b')], t0 + 30 * MIN, 5)
  assert.equal(back.posts.length, 0)
  assert.equal(back.edits.length, 1)
  assert.equal(back.edits[0].message, 'ma')
  assert.equal(back.edits[0].started, t0)
  state = look(back.state, [], t0 + 36 * MIN).state
  assert.equal(state.ended[0].watched, 15 * 60)
  // Someone else, another episode, or too late: a new card.
  for (const [s, at] of [[episode('c', { user: 'Mum' }), 15], [episode('c', { item: '102' }), 15], [episode('c'), 45]] as const) {
    const later = watch(look(first.state, [], t0 + 11 * MIN).state, [s], t0 + at * MIN, 3)
    assert.equal(later.posts.length, 1, `${s.user} ${s.item} at ${at}`)
  }
})

test('Audiobookshelf counts its own listening time, carried over a comeback', () => {
  const empty = look(undefined, [], t0).state
  const book = (id: string, listened: number) => episode(id, { thread: 'play:abs:li1', type: 'audiobook', item: 'li1', detail: 'Chapter 2', listened })
  let r = look(empty, [book('x', 30)], t0)
  r = look(r.state, [book('x', 90)], t0 + MIN)
  assert.equal(r.post.length, 1)
  r.post[0].message = 'mx'
  r = look(r.state, [], t0 + 2 * MIN)
  r = look(r.state, [book('y', 70)], t0 + 10 * MIN)
  assert.equal(r.edit[0].watched, 160)
  r = look(r.state, [book('y', 100)], t0 + 11 * MIN)
  assert.equal(r.state.live.y.watched, 190)
})

test('the card says who, what, where and when, and how long once stopped', () => {
  const p = { ...episode('a'), session: 'a', from: 'S1E1 · Good News About Hell', started: t0, seen: t0, watched: 0, base: 0 }
  const live = playCard(p, { name: 'Plex' })
  assert.equal(live.title, 'Severance')
  assert.equal(live.description, '**Sam** is watching.')
  assert.deepEqual(live.fields?.map((f) => f.name), ['Episode', 'Device', 'Started'])
  const done = playCard({ ...p, ended: t0 + 42 * MIN, watched: 42 * 60 }, { name: 'Plex' })
  assert.equal(done.description, '**Sam** watched for 42 min.')
  assert.equal(done.fields?.at(-1)?.value, `<t:${(t0 + 42 * MIN) / 1000}:t>`)
  const book = playCard({ ...p, type: 'audiobook', from: 'Chapter 1', detail: 'Chapter 3', ended: t0, watched: 600 }, { name: 'Audiobookshelf' })
  assert.equal(book.description, '**Sam** listened for 10 min.')
  assert.equal(book.fields?.[0].value, 'Chapter 1 → Chapter 3')
})

test('sessions map to their thread: a show by its grandparent, a movie with its year, a book by its item', () => {
  const ep = plexSession({ sessionKey: '7', ratingKey: '101', grandparentRatingKey: '100', type: 'episode', title: 'Pilot', grandparentTitle: 'Severance', parentIndex: 1, index: 1, User: { title: 'Sam' }, Player: { title: 'TV', state: 'paused' } })
  assert.deepEqual([ep?.id, ep?.thread, ep?.title, ep?.detail, ep?.playing], ['7:101', 'play:plex:100', 'Severance', 'S1E1 · Pilot', false])
  const movie = plexSession({ sessionKey: '8', ratingKey: '55', type: 'movie', title: 'Dune', year: 2021 })
  assert.deepEqual([movie?.thread, movie?.title, movie?.type, movie?.user], ['play:plex:55', 'Dune (2021)', 'movie', 'Someone'])
  assert.equal(plexSession({ sessionKey: '9', ratingKey: '1', type: 'track', title: 'Song' }), undefined)
  const book = absSession(
    { id: 's', userId: 'u', libraryItemId: 'li1', displayTitle: 'Dune', timeListening: 12, currentTime: 700, chapters: [{ start: 0, end: 600, title: 'One' }, { start: 600, end: 1200, title: 'Two' }], deviceInfo: { model: 'Pixel' } },
    [{ id: 'u', username: 'Sam' }],
  )
  assert.deepEqual([book?.thread, book?.user, book?.device, book?.detail, book?.listened], ['play:abs:li1', 'Sam', 'Pixel', 'Two', 12])
  assert.equal(absSession({ id: 'p', userId: 'u', libraryItemId: 'li2', mediaType: 'podcast', displayTitle: 'Pod' }, []), undefined)
  assert.deepEqual(activityThread({ thread: 'play:abs:li1', title: 'Dune', type: 'audiobook' }, 'https://x/c.jpg'), { forum: 'activity', key: 'play:abs:li1', name: 'Dune', tags: ['Audiobook'], art: 'https://x/c.jpg' })
})

test('the weekly summary links each title to its Activity thread', () => {
  const play = (title: string, key: number): Play => ({ date: t0 / 1000, user_id: 1, friendly_name: 'Sam', full_title: title, title, grandparent_title: '', media_type: 'movie', parent_media_index: null, media_index: null, rating_key: key, grandparent_rating_key: null, percent_complete: 100 })
  const lines = weekSummary([play('Dune', 1), play('Heat', 2)], t0 - MIN, (p) => (p.rating_key === 1 ? 'https://discord.com/channels/g/t' : undefined))
  assert.deepEqual(lines, ['**Sam**: [Dune](<https://discord.com/channels/g/t>) · Heat'])
})
