// Integration test helpers: wraps Supabase client calls for test orgs/users.
// Requires a lokizio-test Supabase project with the schema from test-schema-bootstrap.sql.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.test if present
const envPath = resolve(process.cwd(), '.env.test');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export const TEST_URL = process.env.SUPABASE_TEST_URL;
export const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
export const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;

export function hasTestConfig() {
  return !!(TEST_URL && TEST_ANON_KEY && TEST_SERVICE_KEY);
}

// Admin client (bypasses RLS): used for setup/teardown.
export function adminClient() {
  if (!hasTestConfig()) throw new Error('Missing .env.test — see .env.test.example');
  return createClient(TEST_URL, TEST_SERVICE_KEY, { auth: { persistSession: false } });
}

// Auth as a specific user (respects RLS).
export function userClient(email, password) {
  return createClient(TEST_URL, TEST_ANON_KEY, { auth: { persistSession: false } });
}

// Creates a fresh user with a unique email. Returns { user, client (authed) }.
export async function createTestUser(label = 'test') {
  const admin = adminClient();
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@lokizio-test.local`;
  const password = 'ValidTest1!';
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);

  const authed = createClient(TEST_URL, TEST_ANON_KEY, { auth: { persistSession: false } });
  const { error: sigErr } = await authed.auth.signInWithPassword({ email, password });
  if (sigErr) throw new Error(`signIn failed: ${sigErr.message}`);

  return { user: data.user, email, password, client: authed };
}

// Creates an org + makes the user a member with the given role.
export async function createTestOrg({ userId, role = 'concierge', orgName = 'TestOrg' }) {
  const admin = adminClient();
  const { data: org, error: orgErr } = await admin.from('organizations').insert({
    name: orgName + '-' + Date.now(),
    plan: 'free',
  }).select().single();
  if (orgErr) throw new Error(`createOrg failed: ${orgErr.message}`);

  const { error: memErr } = await admin.from('members').insert({
    org_id: org.id, user_id: userId, role,
    accepted: true, invited_email: 'set@by.test', display_name: role + ' test',
  });
  if (memErr) throw new Error(`createMember failed: ${memErr.message}`);

  return org;
}

// Cleanup: deletes org (cascades to members/properties/invoices via FK).
// Also deletes the user from auth.
export async function cleanupOrg(orgId) {
  if (!orgId) return;
  const admin = adminClient();
  await admin.from('organizations').delete().eq('id', orgId);
}

export async function cleanupUser(userId) {
  if (!userId) return;
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}

// Convenience: create user + org + seed a property. Returns everything.
export async function setupConciergeScenario() {
  const { user, email, client } = await createTestUser('concierge');
  const org = await createTestOrg({ userId: user.id, role: 'concierge' });
  const admin = adminClient();
  const { data: prop } = await admin.from('properties').insert({
    org_id: org.id, name: 'Villa Test', address: '1 rue Test 75001 Paris',
  }).select().single();
  return { user, email, client, org, property: prop, admin };
}
