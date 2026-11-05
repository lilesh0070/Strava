#!/usr/bin/env node
// Finds English UI literals that bypass the dictionary (src/lib/strings.ts) in screens and components.
// Usage: npm run check:i18n   — exits 1 when there are more hits than the known baseline below.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['src/app', 'src/components'];
const PATTERNS = [
  // <X label="Title" />, title=, subtitle=, placeholder=, accessibilityLabel=
  /\b(label|title|subtitle|placeholder|accessibilityLabel)="[A-Z]/g,
  // Alert.alert('Title', …)
  /Alert\.alert\('[A-Z]/g,
  // JSX text: <Text>Some words</Text>
  />[A-Z][a-z][^<>{}]*</g,
];
/** Literals that are not translatable text (ids, brand names, format examples). */
const ALLOWED = [/STR-7K3P9/, /TBDI FITTRACK/, /TBDI FitTrack/, /ghp_/, /OpenStreetMap/];
/** Known hits that are still to be fixed; lower it as they go, never raise it. */
const BASELINE = 0;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield p;
  }
}

const hits = [];
for (const root of ROOTS) {
  for (const file of files(root)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const re of PATTERNS) {
        for (const m of line.matchAll(re)) {
          if (ALLOWED.some((a) => a.test(m[0]) || a.test(line))) continue;
          hits.push(`${relative(process.cwd(), file)}:${i + 1}: ${m[0].trim()}`);
        }
      }
    });
  }
}

for (const h of hits) console.log(h);
if (hits.length > BASELINE) {
  console.error(`\n${hits.length} untranslated UI literal(s) (baseline ${BASELINE}). Add them to src/lib/strings.ts and use t().`);
  process.exit(1);
}
console.log(`i18n check OK: ${hits.length} literal(s), baseline ${BASELINE}`);
