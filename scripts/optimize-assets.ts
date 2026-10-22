import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { PROJECT_ROOT } from '../src/paths.js';

const MAX_SIDE = 1280;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

/** Ужимает JPEG и PNG в assets/ до 1280 px по длинной стороне, меньшие файлы не трогает. */
async function main(): Promise<void> {
  for (const file of walk(join(PROJECT_ROOT, 'assets'))) {
    const ext = extname(file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;

    const image = sharp(file).rotate();
    const { width = 0, height = 0 } = await image.metadata();
    if (Math.max(width, height) <= MAX_SIDE) continue;

    const resized = image.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside' });
    const out =
      ext === '.png' ? resized.png({ compressionLevel: 9 }) : resized.jpeg({ quality: 82 });
    writeFileSync(file, await out.toBuffer());
    console.log(`ужато: ${file}`);
  }
}

await main();
