// PWA 用 PNG アイコンを依存ライブラリなしで生成する。
// 実行: node scripts/make-icons.mjs  → public/icon-192.png, icon-512.png, apple-touch-icon.png
// デザイン: ダークグリーンの角丸背景 + 明るい緑の「しずく」(icon.svg と同じモチーフ)
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public')
mkdirSync(outDir, { recursive: true })

const BG = [0x1f, 0x4d, 0x3a]
const DROP = [0x7b, 0xd6, 0x9a]
const DROP_DARK = [0x3f, 0x9a, 0x6d]
const HIGHLIGHT = [0xe6, 0xed, 0xe8]

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function encodePNG(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// 512 基準の座標系で図形を判定し、任意サイズにスケール。4x スーパーサンプリングでアンチエイリアス。
function inRoundedRect(x, y, r) {
  const cx = Math.min(Math.max(x, r), 512 - r)
  const cy = Math.min(Math.max(y, r), 512 - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}
function inDrop(x, y) {
  // 下半分: 円 (中心 256,320 半径 124)。上半分: 尖った先端 (256,84) へ向かう三角状の領域
  if ((x - 256) ** 2 + (y - 320) ** 2 <= 124 * 124) return true
  if (y < 84 || y > 320) return false
  const t = (y - 84) / (320 - 84) // 0 at tip, 1 at circle center
  const halfW = 124 * Math.sin((t * Math.PI) / 2)
  return Math.abs(x - 256) <= halfW
}
function sample(x, y, maskable) {
  if (!maskable && !inRoundedRect(x, y, 96)) return null
  if (inDrop(x, y)) {
    if ((x - 300) ** 2 + (y - 336) ** 2 <= 26 * 26) return HIGHLIGHT
    return x < 256 ? DROP_DARK : DROP
  }
  return BG
}
function render(size, maskable = false) {
  const SS = 4
  const scale = 512 / size
  return encodePNG(size, (px, py) => {
    let r = 0,
      g = 0,
      b = 0,
      a = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = (px + (sx + 0.5) / SS) * scale
        const y = (py + (sy + 0.5) / SS) * scale
        const c = sample(x, y, maskable)
        if (c) {
          r += c[0]
          g += c[1]
          b += c[2]
          a += 255
        }
      }
    }
    const n = SS * SS
    const cov = a / n
    if (cov === 0) return [0, 0, 0, 0]
    const k = a / 255 // number of covered samples
    return [Math.round(r / k), Math.round(g / k), Math.round(b / k), Math.round(cov)]
  })
}

writeFileSync(join(outDir, 'icon-192.png'), render(192))
writeFileSync(join(outDir, 'icon-512.png'), render(512))
// apple-touch-icon は iOS 側で角丸が付くので全面塗り
writeFileSync(join(outDir, 'apple-touch-icon.png'), render(180, true))
console.log('icons written to', outDir)
