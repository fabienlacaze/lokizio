#!/usr/bin/env node
// Apply a SQL file to the test Supabase project via the pg-meta endpoint
// (uses service_role key). Useful for running migrations from CI without
// copy-pasting into the dashboard.
//
// Usage: node scripts/apply-sql.js sql/fix-onboarding-policies.sql

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env.test') });

const TEST_URL = process.env.SUPABASE_TEST_URL;
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;

if (!TEST_URL || !TEST_SERVICE_KEY) {
  console.error('Missing .env.test (SUPABASE_TEST_URL / SERVICE_KEY)');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply-sql.js <path-to-sql-file>');
  process.exit(1);
}

const sql = readFileSync(file, 'utf8');
console.log(`Applying ${file} (${sql.split('\n').length} lines) to ${TEST_URL}...`);

// Use Supabase's pg-meta endpoint, which is exposed for all projects under
// /rest/v1/rpc/... but easier: use /pg-meta/query via headers.
// Actually the simplest way is the built-in `/rest/v1/rpc/exec_sql` if defined,
// otherwise use the direct query endpoint from Management API.
//
// We'll use the Postgrest `/rest/v1/rpc/query` pattern with a custom stored
// proc, but since none is defined by default, fall back to the Management API.
//
// Workaround: use pg connection via direct HTTPS call to the SQL editor-style
// endpoint. We do this through the `pg-meta` that Supabase runs per project at
// /pg/ - but that's internal. Cleanest path: create a simple exec_sql RPC.

// Simpler implementation: issue the SQL in chunks via the REST database API
// with a helper RPC. Since we don't have one yet, we just invoke the REST
// RPC with name `exec_sql` and hope it exists; otherwise print a clear msg.

const resp = await fetch(`${TEST_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': TEST_SERVICE_KEY,
    'Authorization': `Bearer ${TEST_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sql }),
});

if (resp.ok) {
  console.log('✓ Applied successfully');
  process.exit(0);
}

const errText = await resp.text().catch(() => '');
if (errText.includes('function') && errText.includes('exec_sql')) {
  console.error('✗ RPC exec_sql not found in the project.');
  console.error('  First run this once in Supabase SQL editor:');
  console.error(`
CREATE OR REPLACE FUNCTION public.exec_sql(sql text) RETURNS void AS $$
BEGIN EXECUTE sql; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
`);
  console.error('  Then re-run this script.');
  process.exit(1);
}

console.error('✗ Error:', errText);
process.exit(1);
