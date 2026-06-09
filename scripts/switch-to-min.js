#!/usr/bin/env node
// Switch all <script src="X.js?v=..."> tags in index.html to use X.min.js
// (skips supabase_config.js and any file that doesn't have a .min.js variant).
//
// Run AFTER `npm run build`, then `npm run bump` to refresh the ?v=hash on
// the minified files.
//
// Usage: node scripts/switch-to-min.js
//        node scripts/switch-to-min.js --revert    # back to .js sources

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const revert = process.argv.includes('--revert');

let html = fs.readFileSync(indexPath, 'utf8');

if (revert) {
  // Replace any X.min.js?v=... with X.js?v=... (back to source)
  const RE = /<script\s+src="([A-Za-z0-9_\-./]+)\.min\.js\?v=([^"]+)"\s*>\s*<\/script>/g;
  let count = 0;
  html = html.replace(RE, (full, basePath) => {
    count++;
    return `<script src="${basePath}.js?v=stale"></script>`;
  });
  fs.writeFileSync(indexPath, html);
  console.log(`Reverted ${count} script tags to source .js. Now run \`npm run bump\` to refresh hashes.`);
  process.exit(0);
}

const RE = /<script\s+src="([A-Za-z0-9_\-./]+)\.js\?v=([^"]+)"\s*>\s*<\/script>/g;
let switched = 0;
let skipped = 0;

html = html.replace(RE, (full, basePath, oldVer) => {
  // Skip files that don't have a .min.js variant (or that we intentionally skip)
  const minFile = path.join(root, basePath + '.min.js');
  if (!fs.existsSync(minFile)) {
    skipped++;
    return full;
  }
  switched++;
  return `<script src="${basePath}.min.js?v=stale"></script>`;
});

fs.writeFileSync(indexPath, html);
console.log(`Switched ${switched} script tags to .min.js (skipped ${skipped} without .min.js variant).`);
console.log(`Now run \`npm run bump\` to refresh the ?v= hashes from the minified file contents.`);
