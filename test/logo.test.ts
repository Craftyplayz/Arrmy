import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inflateSync } from 'node:zlib'
import { drawLogo } from '../src/lib/logo.ts'

test('the bot avatar is the logo: three chevrons, --btn to --accent, on --bg', () => {
  const png = drawLogo(512)
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [512, 512])
  const raw = inflateSync(png.subarray(41, png.length - 16)) // the one IDAT chunk
  const at = (x: number, y: number) => [...raw.subarray(y * 2049 + 1 + x * 4, y * 2049 + 5 + x * 4)]
  // 3.2 px per unit, centred: unit (64, y) is pixel (256, 256 + (y - 64) × 3.2)
  assert.deepEqual(at(256, 211), [0x2a, 0x6e, 0x9e, 255], 'the top point is --btn')
  assert.deepEqual(at(256, 288), [0x48, 0x97, 0xc9, 255], 'the middle one halfway')
  assert.deepEqual(at(256, 364), [0x66, 0xc0, 0xf4, 255], 'the bottom point is --accent')
  assert.deepEqual(at(256, 249), [0x20, 0x20, 0x20, 255], 'a gap between chevrons')
  assert.deepEqual(at(0, 0), [0x20, 0x20, 0x20, 255], '--bg around it')
})
