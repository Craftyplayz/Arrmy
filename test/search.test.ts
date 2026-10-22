import assert from 'node:assert/strict'
import { test } from 'node:test'
import { creditsOf, pickCompanies, pickPerson, searchByOf, seriesBooks, seriesTitles } from '../src/lib/searchrules.ts'

test('seriesTitles: main books in order, no novellas or untitled positions', () => {
  const s = {
    name: 'The Lord of the Rings',
    author: { name: 'J.R.R. Tolkien' },
    book_series: [
      { position: 1, book: { title: 'The Fellowship of the Ring' } },
      { position: 1.5, book: { title: 'A Novella' } },
      { position: 2, book: { title: 'The Two Towers' } },
      { position: 3, book: { title: 'The Return of the King' } },
      { position: null, book: { title: 'A Companion' } },
    ],
  }
  assert.deepEqual(seriesTitles(s), { author: 'J.R.R. Tolkien', titles: ['The Fellowship of the Ring', 'The Two Towers', 'The Return of the King'] })
  assert.deepEqual(seriesTitles({ name: 'x', author: null, book_series: [] }), { author: undefined, titles: [] })
})

test('search by: only what the tab offers, and movies and TV only with TMDB', () => {
  assert.equal(searchByOf('movie', 'actor', true), 'actor')
  assert.equal(searchByOf('movie', 'actor', false), 'title', 'no TMDB key')
  assert.equal(searchByOf('audiobook', 'author', false), 'author', 'books need no TMDB')
  assert.equal(searchByOf('audiobook', 'actor', true), 'title', 'not a book choice')
  assert.equal(searchByOf('all', 'actor', true), 'title')
  assert.equal(searchByOf('tv', undefined, true), 'title')
})

test('pickPerson prefers the department searched for', () => {
  const people = [
    { id: 1, name: 'Chris Evans', known_for_department: 'Directing' },
    { id: 2, name: 'Chris Evans', known_for_department: 'Acting' },
  ]
  assert.equal(pickPerson(people, 'actor')?.id, 2)
  assert.equal(pickPerson(people, 'director')?.id, 1)
  assert.equal(pickPerson([{ id: 3, name: 'X', known_for_department: 'Writing' }], 'actor')?.id, 3, 'falls back to the best known')
  assert.equal(pickPerson([], 'actor'), undefined)
})

test('pickCompanies takes every company with the words, not lookalikes', () => {
  const found = [
    { id: 1, name: 'Marvel Studios' },
    { id: 2, name: 'Marvelous Entertainment' },
    { id: 3, name: 'Marvel Entertainment' },
  ]
  assert.deepEqual(pickCompanies(found, 'marvel').map((c) => c.id), [1, 3])
  assert.deepEqual(pickCompanies(found, 'Marvel Studios').map((c) => c.id), [1])
  assert.deepEqual(pickCompanies(found, 'MCU').map((c) => c.id), [1], 'no name matches: TMDB’s first')
})

test('creditsOf: cast or directed, each once, most popular first, no talk shows', () => {
  const credits = {
    cast: [
      { id: 1, popularity: 5 },
      { id: 2, popularity: 50 },
      { id: 1, popularity: 5 },
      { id: 3, popularity: 99, genre_ids: [10767] },
    ],
    crew: [
      { id: 4, popularity: 1, job: 'Director' },
      { id: 5, popularity: 9, job: 'Producer' },
    ],
  }
  assert.deepEqual(creditsOf(credits, 'actor').map((c) => c.id), [2, 1])
  assert.deepEqual(creditsOf(credits, 'director').map((c) => c.id), [4])
  assert.equal(creditsOf({ cast: Array.from({ length: 30 }, (_, id) => ({ id })) }, 'actor').length, 20)
})

test('seriesBooks keeps the main author’s books, oldest first', () => {
  const docs = [
    { title: 'Networks of power', author_name: ['Robert Perrucci'], first_publish_year: 1989 },
    { title: 'Chamber of Secrets', author_name: ['J. K. Rowling'], first_publish_year: 1998 },
    { title: 'Harry potter full series', first_publish_year: 1997 },
    { title: "Philosopher's Stone", author_name: ['J. K. Rowling'], first_publish_year: 1997 },
  ]
  assert.deepEqual(seriesBooks(docs).map((d) => d.title), ["Philosopher's Stone", 'Chamber of Secrets'])
  assert.deepEqual(seriesBooks([]), [])
})
