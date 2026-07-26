// Generates the PWA icons: crescent moon + milk drop, accent on app bg.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const BG = '#161826'
const ACCENT = '#9184d9'

// scale < 1 shrinks the glyph toward the center (maskable safe zone).
const svg = (scale) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <circle cx="240" cy="256" r="150" fill="${ACCENT}"/>
    <circle cx="298" cy="212" r="138" fill="${BG}"/>
    <path d="M352 300 C352 300 316 350 316 378 A36 36 0 0 0 388 378 C388 350 352 300 352 300 Z" fill="${ACCENT}"/>
  </g>
</svg>`

// Status-bar badge: Android only uses the alpha channel, so this is a solid
// square with the crescent knocked out as a transparent hole.
const badgeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <mask id="m">
    <rect width="512" height="512" fill="white"/>
    <circle cx="256" cy="256" r="160" fill="black"/>
    <circle cx="318" cy="209" r="148" fill="white"/>
  </mask>
  <rect width="512" height="512" fill="white" mask="url(#m)"/>
</svg>`

mkdirSync('public/icons', { recursive: true })
const jobs = [
  ['public/icons/icon-192.png', 192, 0.92],
  ['public/icons/icon-512.png', 512, 0.92],
  ['public/icons/icon-maskable-192.png', 192, 0.68],
  ['public/icons/icon-maskable-512.png', 512, 0.68],
]
for (const [out, size, scale] of jobs) {
  await sharp(Buffer.from(svg(scale))).resize(size, size).png().toFile(out)
  console.log('wrote', out)
}
await sharp(Buffer.from(badgeSvg)).resize(96, 96).png().toFile('public/icons/badge-96.png')
console.log('wrote public/icons/badge-96.png')
