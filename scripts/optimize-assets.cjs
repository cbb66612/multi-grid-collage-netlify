// Build smaller visual assets from the original artwork; originals stay untouched.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');
const root = path.resolve(__dirname, '..');
const assets = [
  ['demo-travel-collage.png', 'demo-travel-collage-v15.webp', 1280, 76],
  ['video/red-cloak-poster.jpg', 'video/red-cloak-poster-v15.webp', 1280, 78],
  ...['rest', 'fly-fire', 'threaten', 'shy'].map(action =>
    [`dragon/dragon-${action}-lite.png`, `dragon/dragon-${action}-v15.webp`, 256, 84])
];
(async () => {
  for (const [input, output, width, quality] of assets) {
    const src = path.join(root, 'assets', input);
    const dest = path.join(root, 'assets', output);
    await sharp(src).resize({width, withoutEnlargement: true}).webp({quality, effort: 6}).toFile(dest);
    const before = (await fs.stat(src)).size;
    const after = (await fs.stat(dest)).size;
    console.log(`${output}: ${before} -> ${after} bytes`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
