import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSearch, parseBook, magnetOf } from '../src/lib/abb.ts'

const search = `<div class="post"><h2><a href="/abss/the-hobsbit-2020-harpercollins-andy-serkis-j-r-r-tolkien/" rel="bookmark">The Hobbit, 2020 HarperCollins (Andy Serkis) - J. R. R. Tolkien</a></h2></div><div class="postInfo">Category: Classic</div>
<div class="post"><h2><a href="/abss/tom-bombadil/" rel="bookmark">Tom &amp; Bombadil &#8211; Tolkien</a></h2></div>`

const table = (size: string, trackers: string) => `<table><tr><td>Announce URL:</td><td>udp://tracker.leechers-paradise.org:6969</td></tr>
<tr><td>File Size:</td><td><span style='color:#00f;'>${size}</td></tr>
<tr><td>Info Hash:</td><td>F32EA7128D2148546C9E66B4F1F49DF2D765457D</td></tr>${trackers}</table>`

test('search page: book links and decoded titles', () => {
  assert.deepEqual(parseSearch(search), [
    { path: '/abss/the-hobsbit-2020-harpercollins-andy-serkis-j-r-r-tolkien/', title: 'The Hobbit, 2020 HarperCollins (Andy Serkis) - J. R. R. Tolkien' },
    { path: '/abss/tom-bombadil/', title: 'Tom & Bombadil \u2013 Tolkien' },
  ])
})

test('book page: size, hash and unique trackers', () => {
  const book = parseBook(table('484.34</span> MBs', `<tr><td>Tracker:</td><td>udp://tracker.leechers-paradise.org:6969</td></tr><tr><td>Tracker:</td><td>http://tracker2.dler.org:80/announce</td></tr>`))
  assert.deepEqual(book, { hash: 'f32ea7128d2148546c9e66b4f1f49df2d765457d', size: Math.round(484.34 * 1024 ** 2), trackers: ['udp://tracker.leechers-paradise.org:6969', 'http://tracker2.dler.org:80/announce'] })
  assert.equal(parseBook(table('1.03</span> GBs', ''))?.size, Math.round(1.03 * 1024 ** 3))
})

test('book page: unknown size is 0, no info hash is no book', () => {
  assert.equal(parseBook(table('?</span> ', ''))?.size, 0)
  assert.equal(parseBook('<td>File Size:</td><td>1 GBs</td>'), null)
})

test('magnet carries hash, title and trackers', () => {
  assert.equal(magnetOf('abc', 'A & B', ['udp://t:1/announce']), 'magnet:?xt=urn:btih:abc&dn=A%20%26%20B&tr=udp%3A%2F%2Ft%3A1%2Fannounce')
})
