// Arrmy's logo: three chevrons from --btn to --accent, rank stripes that also point down like a download. The same
// shape as src/app/icon.svg, drawn here as a PNG for the Discord bot's avatar, since Discord takes no SVG. No I/O here.
// .ts so plain node (the tests) can load this file too
import { png } from './barart.ts'

/** Bumped when the drawing changes, so the bot uploads it again. */
export const LOGO_VERSION = 1

// In icon.svg's units (a 128 square): each chevron's left end, point and right end, top to bottom, and its colour.
const CHEVRONS = [
  { y: 30, colour: [0x2a, 0x6e, 0x9e] }, // --btn
  { y: 54, colour: [0x48, 0x97, 0xc9] }, // halfway
  { y: 78, colour: [0x66, 0xc0, 0xf4] }, // --accent
].map(({ y, colour }) => ({ points: [[34, y], [64, y + 20], [94, y]], colour }))
const HALF_STROKE = 6.5
const BG = [0x20, 0x20, 0x20] // --bg; Discord cuts avatars to a circle

function distance(px: number, py: number, [ax, ay]: number[], [bx, by]: number[]) {
  const [dx, dy] = [bx - ax, by - ay]
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

/** The logo as a `size` px square PNG on --bg, the 128 square at 80% of it, as the bot's avatar. */
export function drawLogo(size = 512) {
  const rgba = new Uint8Array(size * size * 4)
  const scale = (size * 0.8) / 128
  const colourAt = (x: number, y: number) =>
    CHEVRONS.find(({ points: [a, b, c] }) => distance(x, y, a, b) <= HALF_STROKE || distance(x, y, b, c) <= HALF_STROKE)?.colour ?? BG
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // 4×4 samples per pixel, so the edges are smooth
      const sum = [0, 0, 0]
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const colour = colourAt(64 + (x + (sx + 0.5) / 4 - size / 2) / scale, 64 + (y + (sy + 0.5) / 4 - size / 2) / scale)
          for (let i = 0; i < 3; i++) sum[i] += colour[i]
        }
      rgba.set([...sum.map((c) => Math.round(c / 16)), 255], (y * size + x) * 4)
    }
  return png(size, size, rgba)
}
