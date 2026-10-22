import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { THEMES, themeOf } from '../src/lib/themes.ts'

test('themeOf only knows listed themes', () => {
  assert.equal(themeOf('violet')?.id, 'violet')
  assert.equal(themeOf('"><script>'), undefined)
  assert.equal(themeOf(null), undefined)
})

const css = readFileSync(new URL('../src/app/themes.css', import.meta.url), 'utf8') + ':root{}'
const root = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8').match(/:root \{[^}]*\}/)![0]

const lum = (h: string) => {
  const hex = h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

test('every theme has AA text contrast', () => {
  for (const { id } of THEMES) {
    const block = id === 'default' ? root : css.match(new RegExp(`\\[data-theme="${id}"\\] \\{([^}]*)\\}`))?.[1]
    assert.ok(block, id)
    const tok = (n: string) => block.match(new RegExp(`--${n}:\\s*(#[0-9a-f]{3,6})`))?.[1] ?? root.match(new RegExp(`--${n}:\\s*(#[0-9a-f]{3,6})`))![1]
    for (const bg of ['bg', 'card', 'card2', 'sunken']) {
      assert.ok(ratio(tok('text'), tok(bg)) >= 4.5, `${id} text on ${bg}`)
      assert.ok(ratio(tok('muted'), tok(bg)) >= 4.5, `${id} muted on ${bg}`)
    }
    assert.ok(ratio(tok('on-btn'), tok('btn')) >= 4.5, `${id} button text`)
    assert.ok(ratio(tok('link'), tok('card')) >= 4.5, `${id} link on card`)
    assert.ok(ratio(tok('accent'), tok('card')) >= 4.5, `${id} accent on card`)
  }
})
