import assert from 'node:assert/strict'
import { test } from 'node:test'
import { audiobookStatus, coverUrl, rankBooks, sameBook } from '../src/lib/bookrules.ts'

const book = (over: object) => ({ BookID: 'OL1W', BookName: 'Project Hail Mary', AuthorName: 'Andy Weir', ...over })

test('LazyLibrarian audio statuses as Arrmy shows them', () => {
  assert.equal(audiobookStatus(undefined), null)
  assert.equal(audiobookStatus(book({ audiostatus: 'Skipped' })), null, 'cancelled')
  assert.deepEqual(audiobookStatus(book({ audiostatus: 'Wanted' })), { label: 'Requested' })
  assert.deepEqual(audiobookStatus(book({ audiostatus: 'Snatched' }), { size: 200, sizeleft: 50 }), { label: 'Downloading', progress: 75 })
  assert.deepEqual(audiobookStatus(book({ audiostatus: 'Snatched' })), { label: 'Downloading', progress: 0 }, 'not in qBittorrent yet')
  assert.deepEqual(audiobookStatus(book({ audiostatus: 'Open' })), { label: 'Available' })
  assert.deepEqual(audiobookStatus(book({ audiostatus: 'Skipped', audiolibrary: '2026-10-20 05:00:00' })), { label: 'Available' }, 'filed')
})

test('covers: OpenLibrary at medium size over https, placeholders dropped', () => {
  assert.equal(coverUrl('http://covers.openlibrary.org/b/id/11200092-S.jpg'), 'https://covers.openlibrary.org/b/id/11200092-M.jpg')
  assert.equal(coverUrl('images/nocover.png'), undefined)
  assert.equal(coverUrl(null), undefined)
})

test('sameBook is strict, because it decides what Audiobookshelf may delete', () => {
  const phm = { title: 'Project Hail Mary', author: 'Andy Weir' }
  assert.ok(sameBook({ title: 'Project Hail Mary', author: 'Andy Weir' }, phm))
  assert.ok(sameBook({ title: 'Project Hail Mary (Unabridged)', author: 'Weir, Andy' }, phm), 'brackets and author order')
  assert.ok(sameBook({ title: 'Project Hail Mary: A Novel' }, phm), 'subtitle, unknown author')
  assert.ok(sameBook({ title: 'Les Misérables', author: 'Victor Hugo' }, { title: 'Les Miserables', author: 'Victor Hugo' }), 'accents')
  assert.ok(!sameBook({ title: 'Dune Messiah', author: 'Frank Herbert' }, { title: 'Dune', author: 'Frank Herbert' }), 'sequel')
  assert.ok(!sameBook({ title: 'Project Hail Mary', author: 'Someone Else' }, phm), 'other author')
  assert.ok(!sameBook({ title: '', author: 'Andy Weir' }, phm))
})

test('search ranking: the real book first, study-guide spin-offs gone', () => {
  // What OpenLibrary really returned for "project hail mary" (best LazyLibrarian score first).
  const found = [
    { bookname: 'SUMMARY and REVIEW : PROJECT HAIL MARY', bookimg: 'images/nocover.png', highest_fuzz: 100 },
    { bookname: 'Project Hail Mary', bookimg: 'http://covers.openlibrary.org/b/id/11200092-S.jpg', highest_fuzz: 100 },
    { bookname: "Summary of Andy Weir's Project Hail Mary", bookimg: 'images/nocover.png', highest_fuzz: 100 },
    { bookname: 'The Martian / Artemis / Project Hail Mary', bookimg: 'images/nocover.png', highest_fuzz: 100 },
    { bookname: 'Summary and Analysis of Project Hail Mary by Andy Weir', bookimg: 'http://covers.openlibrary.org/b/id/1-S.jpg', highest_fuzz: 100 },
  ]
  assert.deepEqual(rankBooks(found, 'project hail mary').map((b) => b.bookname), ['Project Hail Mary', 'The Martian / Artemis / Project Hail Mary'])
})
