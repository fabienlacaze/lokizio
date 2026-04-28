#!/usr/bin/env node
// Apply a SQL file to the PROD Supabase project via the exec_sql RPC.
// The service_role key is passed as a CLI arg so it never touches disk.
//
// Usage:
//   node scripts/apply-sql-prod.js <path-to-sql-file> <SERVICE_ROLE_KEY>
//
// Prerequisite: exec_sql must already exist in prod. If not, paste this once
// in the Supabase SQL Editor:
//   CREATE OR REPLACE FUNCTION public.exec_sql(sql text) RETURNS void AS $$
//   BEGIN EXECUTE sql; END;
//   $$ LANGUAGE plpgsql SECURITY DEFINER;
//   REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
//   GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

import { readFileSync } from 'node:fs';

const PROD_URL = 'https://mrvejwyvhuivmipfwlzz.supabase.co';

const file = process.argv[2];
const serviceKey = process.argv[3];

if (!file || !serviceKey) {
  console.error('Usage: node scripts/apply-sql-prod.js <path-to-sql-file> <SERVICE_ROLE_KEY>');
  console.error('Get the key from: Supabase Dashboard > Project Settings > API > service_role');
  process.exit(1);
}

const sql = readFileSync(file, 'utf8');
console.log(`Applying ${file} (${sql.split('\n').length} lines) to PROD ${PROD_URL}...`);

const resp = await fetch(`${PROD_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sql }),
});

if (resp.ok) {
  console.log('✓ Applied successfully to PROD');
  process.exit(0);
}

const errText = await resp.text().catch(() => '');
console.error('✗ Error:', errText);
process.exit(1);
