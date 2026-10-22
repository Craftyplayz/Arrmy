import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cardOf, runtimeText, trailerOf } from '../src/lib/discoverrules.ts'

test('cardOf reads movie and TV fields', () => {
  const img = (p?: string | null) => (p ? `x${p}` : undefined)
  assert.deepEqual(cardOf('movie', { id: 1, title: 'Dune', release_date: '2021-10-22', poster_path: '/a.jpg' }, img), {
    type: 'movie',
    id: 1,
    title: 'Dune',
    year: '2021',
    poster: 'x/a.jpg',
  })
  assert.equal(cardOf('tv', { id: 2, name: 'Andor', first_air_date: '', poster_path: null }, img).year, undefined)
})

test('trailerOf prefers official YouTube trailers', () => {
  const v = (key: string, o: object = {}) => ({ key, site: 'YouTube', type: 'Trailer', ...o })
  assert.equal(trailerOf([v('a'), v('b', { official: true })]), 'b')
  assert.equal(trailerOf([{ key: 'c', site: 'Vimeo', type: 'Trailer' }, { key: 'd', site: 'YouTube', type: 'Clip' }]), undefined)
})

test('runtimeText', () => {
  assert.equal(runtimeText(135), '2 h 15 min')
  assert.equal(runtimeText(120), '2 h')
  assert.equal(runtimeText(45), '45 min')
})
