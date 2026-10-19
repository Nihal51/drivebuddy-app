/**
 * Writes docs/translations.csv: every English line next to its Hindi, for a
 * native Hindi speaker to read through in Excel or Google Sheets.
 *
 *     npm run i18n:review        (from apps/customer)
 *
 * Lines with {…} are filled in by the app; the sample values show where.
 * Needs Node 22.18+ (it reads the TypeScript message files directly).
 */

import { writeFileSync } from 'node:fs';

const { en } = await import('../src/i18n/en.ts');
const { hi } = await import('../src/i18n/hi.ts');

const SAMPLE = ['{1}', '{2}', '{3}', '{4}'];

function leaves(node, path = '') {
  if (typeof node === 'string') return [[path, node]];
  if (typeof node === 'function') return [[path, String(node(...SAMPLE.slice(0, node.length)))]];
  if (Array.isArray(node)) return node.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (node && typeof node === 'object')
    return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

const english = new Map(leaves(en));
const rows = leaves(hi).map(([key, hindi]) => [key, english.get(key) ?? '', hindi]);
const cell = (v) => `"${String(v).replaceAll('"', '""')}"`;
const csv = ['﻿' + 'Key,English,Hindi,Reviewer comment', ...rows.map((r) => [...r, ''].map(cell).join(','))];
const out = new URL('../../../docs/translations.csv', import.meta.url);
writeFileSync(out, csv.join('\r\n') + '\r\n');
console.log(`${rows.length} lines → ${out.pathname}`);
