#!/usr/bin/env node
/**
 * Checks the Google Play kit in store/google-play against Google's limits, so
 * a listing never bounces at upload time:
 *   - every text block under a heading "… (max N)" fits in N characters
 *   - every image has the size and format Play asks for
 *
 *   npm run store:check        (from apps/customer)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const KIT = join(import.meta.dirname, '..', 'store', 'google-play');
const problems = [];

/* ---------- text ---------- */
for (const file of readdirSync(KIT).filter((f) => f.startsWith('listing-') && f.endsWith('.md'))) {
  const md = readFileSync(join(KIT, file), 'utf8');
  const re = /^## (.+?) \(max (\d+)\)\s*\n+```\n([\s\S]*?)\n```/gm;
  let m;
  let blocks = 0;
  while ((m = re.exec(md))) {
    blocks++;
    const [, label, max, text] = m;
    // Play counts characters, not bytes; a Hindi matra counts as one.
    const length = [...text].length;
    const status = length <= Number(max) ? 'ok' : 'TOO LONG';
    console.log(`${file.padEnd(20)} ${label.padEnd(18)} ${String(length).padStart(4)} / ${max}  ${status}`);
    if (length > Number(max)) problems.push(`${file}: ${label} is ${length} characters (max ${max})`);
  }
  if (blocks < 3) problems.push(`${file}: expected name, short and full description blocks, found ${blocks}`);
}

/* ---------- images ---------- */
function png(path) {
  const b = readFileSync(path);
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  // IHDR: width, height, bit depth, colour type (2 = RGB, 6 = RGBA)
  return {
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
    alpha: b[25] === 6 || b[25] === 4,
    bytes: b.length,
  };
}
const IMAGES = join(KIT, 'images');
const rules = [
  { test: /^icon-512\.png$/, w: 512, h: 512, alphaOk: true, maxBytes: 1024 * 1024 },
  { test: /^feature-graphic\.png$/, w: 1024, h: 500, alphaOk: false, maxBytes: 15 * 1024 * 1024 },
  { test: /^phone-.*\.png$/, ratio: true, alphaOk: false, maxBytes: 8 * 1024 * 1024 },
];
const phones = { en: 0, hi: 0 };
for (const file of readdirSync(IMAGES)) {
  const rule = rules.find((r) => r.test.test(file));
  if (!rule) continue;
  const info = png(join(IMAGES, file));
  if (!info) {
    problems.push(`${file}: not a PNG`);
    continue;
  }
  const { width: w, height: h } = info;
  if (rule.w && (w !== rule.w || h !== rule.h))
    problems.push(`${file}: ${w}×${h}, Play wants ${rule.w}×${rule.h}`);
  if (rule.ratio) {
    // Play: each side 320–3840 px, the long side at most twice the short side.
    if (Math.min(w, h) < 320 || Math.max(w, h) > 3840 || Math.max(w, h) > 2 * Math.min(w, h)) {
      problems.push(`${file}: ${w}×${h} is outside Play's screenshot rules`);
    }
    const lang = file.split('-')[1];
    if (lang in phones) phones[lang]++;
  }
  if (!rule.alphaOk && info.alpha)
    problems.push(`${file}: has transparency; Play wants a 24-bit PNG or JPEG`);
  if (info.bytes > rule.maxBytes)
    problems.push(`${file}: ${(info.bytes / 1048576).toFixed(1)} MB is too big`);
  console.log(`images/${file.padEnd(22)} ${w}×${h}${info.alpha ? ' (alpha)' : ''}`);
}
for (const [lang, n] of Object.entries(phones)) {
  if (n < 2 || n > 8) problems.push(`${n} phone screenshots for ${lang}; Play needs 2–8`);
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log('\n✓ The Play Store kit fits Google’s limits.');
