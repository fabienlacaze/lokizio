#!/usr/bin/env node
// Fetch the last N Sentry issues for Lokizio.
// Usage:
//   node scripts/fetch-sentry-issues.js              # last 10 unresolved issues
//   node scripts/fetch-sentry-issues.js --limit 5    # last 5
//   node scripts/fetch-sentry-issues.js --all        # include resolved
//   node scripts/fetch-sentry-issues.js --issue ABC  # full details of one issue
//
// Reads SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT from .env.local.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Missing .env.local at', envPath);
  process.exit(1);
}
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});

const TOKEN = env.SENTRY_AUTH_TOKEN;
const ORG = env.SENTRY_ORG || 'fabienlacaze';
const PROJECT = env.SENTRY_PROJECT || 'lokizio';
if (!TOKEN) { console.error('SENTRY_AUTH_TOKEN missing in .env.local'); process.exit(1); }

// ── Args ──
const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(name);
  if (i === -1) return def;
  return args[i + 1] || def;
}
const LIMIT = parseInt(arg('--limit', '10'), 10);
const INCLUDE_RESOLVED = args.includes('--all');
const ISSUE_ID = arg('--issue', null);

// ── Helpers ──
async function api(pathSeg) {
  const url = 'https://sentry.io/api/0' + pathSeg;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' on ' + url + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}

function fmtDate(s) {
  return new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

// ── Single issue mode ──
async function showIssue(id) {
  const issue = await api(`/issues/${id}/`);
  const events = await api(`/issues/${id}/events/?limit=1`);
  const last = events[0];
  console.log('═'.repeat(70));
  console.log(`ISSUE ${issue.shortId}  [${issue.level.toUpperCase()}]  ${issue.status}`);
  console.log(`Title: ${issue.title}`);
  console.log(`First seen: ${fmtDate(issue.firstSeen)}   Last seen: ${fmtDate(issue.lastSeen)}`);
  console.log(`Count: ${issue.count} events    Users affected: ${issue.userCount}`);
  console.log(`URL: ${issue.permalink}`);
  console.log('─'.repeat(70));
  if (last) {
    console.log('LAST EVENT:');
    console.log('  Platform:', last.platform);
    console.log('  Tags:');
    (last.tags || []).forEach((t) => console.log(`    ${t.key} = ${t.value}`));
    const exc = last.entries && last.entries.find((e) => e.type === 'exception');
    if (exc) {
      console.log('  Exception:');
      (exc.data.values || []).forEach((v) => {
        console.log(`    ${v.type}: ${v.value}`);
        const frames = (v.stacktrace && v.stacktrace.frames || []).slice(-8);
        frames.forEach((f) => {
          console.log(`      at ${f.function || '?'} (${f.filename || '?'}:${f.lineno || '?'})`);
        });
      });
    }
    const breadcrumbs = last.entries && last.entries.find((e) => e.type === 'breadcrumbs');
    if (breadcrumbs) {
      console.log('  Last 5 breadcrumbs:');
      (breadcrumbs.data.values || []).slice(-5).forEach((b) => {
        console.log(`    [${b.category}] ${b.message || JSON.stringify(b.data || {})}`);
      });
    }
  }
}

// ── List mode ──
async function listIssues() {
  const query = INCLUDE_RESOLVED ? '' : '&query=is:unresolved';
  const issues = await api(`/projects/${ORG}/${PROJECT}/issues/?limit=${LIMIT}${query}`);
  if (!issues.length) {
    console.log('No issues found.');
    return;
  }
  console.log(`${issues.length} issue(s) on ${ORG}/${PROJECT}:`);
  console.log('─'.repeat(70));
  issues.forEach((i) => {
    const tag = `[${i.level.toUpperCase()}]`.padEnd(8);
    console.log(`${tag} ${i.shortId}  ${i.title.slice(0, 60)}`);
    console.log(`         ${i.count} events, ${i.userCount} user(s), last ${fmtDate(i.lastSeen)}`);
  });
  console.log('─'.repeat(70));
  console.log(`Tip: node scripts/fetch-sentry-issues.js --issue <SHORT_ID>  for full details`);
}

(async () => {
  try {
    if (ISSUE_ID) await showIssue(ISSUE_ID);
    else await listIssues();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
