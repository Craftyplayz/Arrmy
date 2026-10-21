import assert from 'node:assert/strict'
import { test } from 'node:test'
import { audiobookStatus, bestEdition, cleanEdition, coverUrl, editionId, isbn10, editionOf, fromOpenLibrary, isEdition, rankBooks, safeName, sameBook, unwantAgain } from '../src/lib/bookrules.ts'

const book = (over: object) => ({ BookID: 'OL1W', BookName: 'Project Hail Mary', AuthorName: 'Andy Weir', ...over })

test('LazyLibrarian audio statuses as Arrmy shows them', () => {
  assert.equal(audiobookStatus(undefined), null)
  assert.equal(audiobookStatus(book({ audiostatus: 'Skipped' })), null, 'cancelled')
  assert.deepEqual(audiobookStatus(book({ AudioStatus: 'Wanted' })), { label: 'Requested' }, 'as the real server spells it')
  assert.deepEqual(audiobookStatus(book({ audiostatus: 'Wanted' })), { label: 'Requested' }, 'lowercase fallback')
  assert.deepEqual(audiobookStatus(book({ audiostatus: 'Snatched' }), { size: 200, sizeleft: 50 }), { label: 'Downloading', progress: 75 })
  assert.deepEqual(audiobookStatus(book({ audiostatus: 'Snatched' })), { label: 'Downloading', progress: 0 }, 'not in qBittorrent yet')
  assert.deepEqual(audiobookStatus(book({ audiostatus: 'Open' })), { label: 'Available' })
  assert.deepEqual(audiobookStatus(book({ AudioStatus: 'Skipped', AudioLibrary: '2026-10-20 05:00:00' })), { label: 'Available' }, 'filed')
})

test('covers: OpenLibrary at medium size over https, placeholders dropped', () => {
  assert.equal(coverUrl('http://covers.openlibrary.org/b/id/11200092-S.jpg'), 'https://covers.openlibrary.org/b/id/11200092-M.jpg')
  assert.equal(coverUrl('images/nocover.png'), undefined)
  assert.equal(coverUrl('cache/book/OL66554W.jpg', 'OL66554W'), 'https://covers.openlibrary.org/w/olid/OL66554W-M.jpg', 'LazyLibrarian cache: OpenLibrary work cover')
  assert.equal(coverUrl('cache/book/123.jpg', '123'), undefined, 'not an OpenLibrary work')
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

test("search ranking keeps OpenLibrary's order among same-titled books", () => {
  // "pride and prejudice": 2,245 results, all with covers and the same score; OpenLibrary lists Austen's first.
  const found = [
    { bookname: 'Pride and Prejudice and Zombies', authorname: 'Seth Grahame-Smith' },
    { bookname: 'Pride and Prejudice', authorname: 'Jane Austen' },
    { bookname: 'Pride and Prejudice [adaptation]', authorname: 'Andrea Shell' },
  ]
  assert.deepEqual(rankBooks(found, 'pride and prejudice').map((b) => b.authorname), ['Jane Austen', 'Andrea Shell', 'Seth Grahame-Smith'])
})

test('OpenLibrary search results in LazyLibrarian terms', () => {
  const doc = { key: '/works/OL66554W', title: 'Pride and Prejudice', author_name: ['Jane Austen', 'Someone'], cover_i: 14348537, first_publish_year: 1813 }
  assert.deepEqual(fromOpenLibrary(doc), {
    bookid: 'OL66554W',
    bookname: 'Pride and Prejudice',
    authorname: 'Jane Austen',
    bookimg: 'https://covers.openlibrary.org/b/id/14348537-M.jpg',
    year: 1813,
  })
  assert.equal(fromOpenLibrary({ key: '/works/OL1W', title: 'Untitled' }).authorname, 'Unknown author')
  assert.equal(fromOpenLibrary({ key: '/works/OL1W', title: 'Untitled' }).bookimg, undefined)
})

test('a removed book LazyLibrarian wants again is unwanted, for a day, unless it was requested again', () => {
  const now = 1_000_000_000
  const book = (BookID: string, AudioStatus: string) => ({ BookID, BookName: 'x', AuthorName: 'y', AudioStatus })
  const books = [book('A', 'Wanted'), book('B', 'Snatched'), book('C', 'Skipped'), book('D', 'Wanted'), book('E', 'Wanted')]
  const removed = { A: now - 60_000, B: now - 60_000, C: now - 60_000, D: now - 2 * 86_400_000, E: now - 60_000 }
  const { unwant, keep } = unwantAgain(removed, books, new Set(['E']), now)
  assert.deepEqual(unwant, ['A', 'B'])
  assert.deepEqual(Object.keys(keep), ['A', 'B', 'C'], 'D is a day old; E was requested again')
})

test('Editions: release names from the live Prowlarr, matched to one book and one edition', () => {
  const pos = "Harry Potter and the Philosopher's Stone"
  assert.ok(isEdition('Harry Potter and the Philosopher s Stone Full Cast Edition Audiobook 2025 Stereo mp3', pos, 'Full Cast'))
  assert.ok(isEdition('Harry Potter and the Philosophers Stone (Dramatised)', "Harry Potter and the Philosophers Stone", 'Full-Cast'), 'Dramatised counts as Full Cast')
  assert.ok(!isEdition('Harry Potter Full-Cast Audio Editions Audiobooks', pos, 'Full Cast'), 'a pack of the series lacks the title')
  assert.ok(!isEdition('Harry Potter and the Chamber of Secrets Full Cast Edition', pos, 'Full Cast'), 'another book')
  assert.ok(isEdition('Harry Potter and the Philosopher s Stone; Read by Stephen Fry [MP3]', pos, 'Stephen Fry'))
  assert.ok(!isEdition('Harry Potter and the Philosopher s Stone - Jim Dale', pos, 'Stephen Fry'), 'another narrator')
  assert.ok(!isEdition('Harry Potter and the Philosopher s Stone Full Cast', pos, 'Stephen Fry'))
})

test('Editions: the best release has the most seeders and is big enough to be audio', () => {
  const r = (title: string, seeders: number, size = 700e6) => ({ title, seeders, size, protocol: 'torrent', magnetUrl: 'magnet:?' })
  const releases = [
    r('Dune Frank Herbert Full Cast', 5),
    r('Dune Frank Herbert Full Cast m4b', 40),
    r('Dune Frank Herbert Full Cast epub', 900, 2e6),
    r('Dune Frank Herbert Full Cast dead', 0),
  ]
  assert.equal(bestEdition(releases, 'Dune', 'Full Cast')?.title, 'Dune Frank Herbert Full Cast m4b')
  assert.equal(bestEdition(releases, 'Dune', 'Scott Brick'), undefined)
})

test('Editions: ids and folder names', () => {
  assert.deepEqual(editionOf(editionId('OL82563W', 'Stephen Fry')), { bookId: 'OL82563W', edition: 'Stephen Fry' })
  assert.equal(editionOf('OL82563W'), undefined)
  assert.equal(cleanEdition(' Full~Cast / ../x '), 'Full Cast .. x')
  assert.equal(cleanEdition('   '), '')
  assert.equal(safeName('../..'), 'Unknown')
  assert.equal(safeName('Dune: Part One'), 'Dune Part One')
})

test('isbn10: the 978- ISBN-13 as an ISBN-10, with its check digit', () => {
  assert.equal(isbn10('9780545790352'), '0545790352')
  assert.equal(isbn10('9780306406157'), '0306406152')
  assert.equal(isbn10('9791234567896'), undefined, '979- has no ISBN-10')
})
