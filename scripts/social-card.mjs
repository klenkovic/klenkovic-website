import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile('assets/social-card.svg', 'utf8');
const portrait = await readFile('src/assets/kristijan.jpg');
const portraitPath = '../src/assets/kristijan.jpg';
if (!svg.includes(portraitPath)) throw new Error('Social card portrait reference is missing');
const embedded = svg.replace(portraitPath, `data:image/jpeg;base64,${portrait.toString('base64')}`);
await sharp(Buffer.from(embedded)).png().toFile('public/social-card.png');
