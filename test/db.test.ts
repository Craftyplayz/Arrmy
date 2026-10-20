import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'

test('a database from before 1.1.0 keeps its Requests and accepts audiobooks', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'arrmy-db-'))
  const path = join(dir, 'arrmy.db')
  // The 1.0 schema: media_type only allowed movie and tv.
  const old = new DatabaseSync(path)
  old.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
      media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')), external_id INTEGER NOT NULL, title TEXT NOT NULL,
      year INTEGER, poster TEXT, seasons TEXT,
      status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'available')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO users VALUES (1, 'crafty', 1);
    INSERT INTO requests (user_id, media_type, external_id, title, seasons) VALUES (1, 'tv', 81189, 'Breaking Bad', '[1]');
  `)
  old.close()

  process.env.DB_PATH = path
  const db = await import('../src/lib/db.ts')
  try {
    assert.deepEqual(db.listRequests().map((r) => [r.title, r.external_id, r.seasons]), [['Breaking Bad', 81189, '[1]']])
    db.addRequest({ userId: 1, type: 'audiobook', externalId: 'OL21745884W', title: 'Project Hail Mary' })
    assert.deepEqual(db.waitingOfType('audiobook').map((r) => r.external_id), ['OL21745884W'], 'text BookIDs stay text')
    assert.ok(db.hasRequest(1, 'audiobook', 'OL21745884W'))
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {} // Windows keeps the still-open database locked; the temp folder can stay
  }
})
