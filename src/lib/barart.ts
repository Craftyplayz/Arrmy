// The Discord progress bar's pieces, drawn as PNGs and uploaded as the bot's own emoji. Discord can't colour text, so
// a bar in DESIGN.md's colours (a --btn → --accent fill on a white track) has to be pictures. No I/O here.
import { crc32, deflateSync } from 'node:zlib'

/** Cells in a bar, and how finely each one fills: 10 × 4 = steps of 2.5%. */
export const CELLS = 10
export const QUARTERS = 4

/** Emoji names: one per cell and fill level, versioned so a redraw uploads fresh ones. */
export const cellName = (cell: number, quarters: number) => `arrmy_bar_v1_${cell}_${quarters}`

const SIZE = 128 // Discord shows emoji at 22px; it scales this down
const BAND = { top: 46, bottom: 82 } // the bar's height inside the square emoji
const BTN = [0x2a, 0x6e, 0x9e]
const ACCENT = [0x66, 0xc0, 0xf4]
const TRACK = [255, 255, 255, 0.14] // DESIGN.md: tracks are white overlays

/** A PNG file from straight (not premultiplied) RGBA pixels. */
export function png(width: number, height: number, rgba: Uint8Array) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), body.length + 4)
    return out
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 6, 0, 0, 0], 8) // 8-bit RGBA, no interlace
  const rows = Buffer.alloc((width * 4 + 1) * height) // each row starts with filter type 0
  for (let y = 0; y < height; y++) rows.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** One cell of the bar, `quarters` of it filled. The first and last cells have the rounded ends. */
export function drawCell(cell: number, quarters: number) {
  const rgba = new Uint8Array(SIZE * SIZE * 4)
  const radius = (BAND.bottom - BAND.top) / 2
  const middle = (BAND.top + BAND.bottom) / 2
  const fillTo = (quarters / QUARTERS) * SIZE
  const inside = (x: number, y: number) => {
    if (y < BAND.top || y > BAND.bottom) return false
    const capX = cell === 0 && x < radius ? radius : cell === CELLS - 1 && x > SIZE - radius ? SIZE - radius : undefined
    return capX === undefined || (x - capX) ** 2 + (y - middle) ** 2 <= radius ** 2
  }
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      // 4×4 samples per pixel, so the round ends and the fill's edge are smooth
      let track = 0
      let fill = 0
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const px = x + (sx + 0.5) / 4
          if (!inside(px, y + (sy + 0.5) / 4)) continue
          if (px < fillTo) fill++
          else track++
        }
      if (!fill && !track) continue
      const t = (cell * SIZE + x) / (CELLS * SIZE) // the gradient runs across the whole bar
      const colour = BTN.map((c, i) => Math.round(c + (ACCENT[i] - c) * t))
      const fillAlpha = fill / 16
      const trackAlpha = (track / 16) * TRACK[3]
      const alpha = fillAlpha + trackAlpha
      const mix = (i: number) => Math.round((colour[i] * fillAlpha + TRACK[i] * trackAlpha) / alpha)
      rgba.set([mix(0), mix(1), mix(2), Math.round(alpha * 255)], (y * SIZE + x) * 4)
    }
  return png(SIZE, SIZE, rgba)
}

/** Every cell at every fill level, as emoji name → PNG. */
export const allCells = () =>
  Array.from({ length: CELLS }, (_, cell) => Array.from({ length: QUARTERS + 1 }, (_, q) => [cellName(cell, q), drawCell(cell, q)] as const)).flat()

/** The bar for a fraction, as emoji when they're uploaded (name → id), else as text. */
export function progressBar(fraction: number, emoji: Record<string, string> = {}) {
  const steps = Math.round(Math.min(1, Math.max(0, fraction)) * CELLS * QUARTERS)
  const cells = Array.from({ length: CELLS }, (_, cell) => Math.min(QUARTERS, Math.max(0, steps - cell * QUARTERS)))
  if (cells.every((q, cell) => emoji[cellName(cell, q)])) return cells.map((q, cell) => `<:${cellName(cell, q)}:${emoji[cellName(cell, q)]}>`).join('')
  return cells.map((q) => (q === QUARTERS ? '▰' : q === 0 ? '▱' : '▰')).join('') // before the emoji are uploaded
}
