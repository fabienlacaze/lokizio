#!/usr/bin/env node
/**
 * RESET PROD (sauf fabien65400@hotmail.fr) + RESEED 4 TEST USERS.
 *
 * Procedure:
 *   1. List all users
 *   2. Skip fabien65400@hotmail.fr (kept)
 *   3. Delete every other user's orgs (CASCADE -> members/properties/...)
 *      then delete the user from auth.users
 *   4. Also wipe orgs that are not linked to fabien65400@hotmail.fr
 *      (in case some are orphaned)
 *   5. Drop the 4 manual "fabien jean" contacts that fabien created in
 *      his own org (members rows with user_id = NULL)
 *   6. Recreate the 4 test users + a demo org + property + reservation
 *      + service_requests + marketplace_profiles
 *
 * Idempotent: re-running the script is safe.
 *
 * Usage: node scripts/reset-and-seed-prod.js <SUPABASE_PROD_SERVICE_KEY>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mrvejwyvhuivmipfwlzz.supabase.co';
const SERVICE_KEY = process.argv[2];
const KEEP_EMAIL = 'fabien65400@hotmail.fr';

if (!SERVICE_KEY || !SERVICE_KEY.startsWith('eyJ')) {
  console.error('Usage: node scripts/reset-and-seed-prod.js <SUPABASE_PROD_SERVICE_KEY>');
  console.error('Get the key: Supabase Dashboard > Project Settings > API > service_role');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const PASSWORD = 'Test1234!';
const USERS = [
  { email: 'concierge@lokizio.test', role: 'concierge', name: 'Concierge Test' },
  { email: 'owner@lokizio.test',     role: 'owner',     name: 'Proprietaire Test' },
  { email: 'provider@lokizio.test',  role: 'provider',  name: 'Prestataire Test' },
  { email: 'tenant@lokizio.test',    role: 'tenant',    name: 'Locataire Test' },
];

async function main() {
  console.log('=== RESET PROD ===');
  console.log(`Keeping: ${KEEP_EMAIL}\n`);

  // 1. List all users (paginate)
  let allUsers = [];
  let page = 1;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error('listUsers error:', error); process.exit(1); }
    if (!data?.users?.length) break;
    allUsers = allUsers.concat(data.users);
    if (data.users.length < 200) break;
    page++;
  }
  console.log(`Total users: ${allUsers.length}`);

  const keepUser = allUsers.find(u => u.email === KEEP_EMAIL);
  if (!keepUser) {
    console.error(`!! User to keep (${KEEP_EMAIL}) not found in auth.users — aborting`);
    process.exit(1);
  }
  console.log(`Keeping user id: ${keepUser.id}\n`);

  // 2. Find Fabien's orgs (so we don't delete them by mistake when wiping orphans)
  const { data: fabienMembers } = await sb.from('members').select('org_id').eq('user_id', keepUser.id);
  const keepOrgIds = new Set((fabienMembers || []).map(m => m.org_id));
  console.log(`Keeping ${keepOrgIds.size} org(s) of Fabien:`, [...keepOrgIds]);

  // 3. Delete other users + their orgs
  let deletedUsers = 0;
  for (const u of allUsers) {
    if (u.id === keepUser.id) continue;
    if (u.email === KEEP_EMAIL) continue;
    const { data: members } = await sb.from('members').select('org_id').eq('user_id', u.id);
    for (const m of members || []) {
      if (keepOrgIds.has(m.org_id)) continue; // never touch Fabien's orgs
      await sb.from('organizations').delete().eq('id', m.org_id);
    }
    const { error: delErr } = await sb.auth.admin.deleteUser(u.id);
    if (delErr) console.warn(`  ! could not delete ${u.email || u.id}: ${delErr.message}`);
    else { deletedUsers++; console.log(`  - deleted ${u.email || u.id}`); }
  }
  console.log(`Deleted ${deletedUsers} users.\n`);

  // 4. Wipe orphaned orgs (not in Fabien's set)
  const { data: allOrgs } = await sb.from('organizations').select('id, name');
  let orphanCount = 0;
  for (const o of allOrgs || []) {
    if (keepOrgIds.has(o.id)) continue;
    await sb.from('organizations').delete().eq('id', o.id);
    orphanCount++;
  }
  if (orphanCount) console.log(`Wiped ${orphanCount} orphan org(s).\n`);

  // 5. Drop Fabien's manual contacts (members with user_id IS NULL inside his orgs)
  for (const orgId of keepOrgIds) {
    const { data: manuals, error: mErr } = await sb.from('members').select('id, display_name').eq('org_id', orgId).is('user_id', null);
    if (mErr) console.warn(`  ! list manuals failed: ${mErr.message}`);
    for (const c of manuals || []) {
      await sb.from('members').delete().eq('id', c.id);
      console.log(`  - dropped manual contact "${c.display_name}" in org ${orgId}`);
    }
  }
  console.log();

  // 6. Wipe stale marketplace_jobs / marketplace_profiles for non-existing users
  const remainingUserIds = new Set([keepUser.id]); // refilled after seeding
  await sb.from('marketplace_jobs').delete().not('posted_by', 'in', `(${[...remainingUserIds].map(id => `'${id}'`).join(',')})`);
  await sb.from('marketplace_profiles').delete().not('user_id', 'in', `(${[...remainingUserIds].map(id => `'${id}'`).join(',')})`);
  console.log('Wiped marketplace data of removed users.\n');

  // ===== RESEED =====
  console.log('=== SEEDING TEST USERS ===\n');

  const userIds = {};
  for (const u of USERS) {
    const { data, error } = await sb.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) {
      console.error(`Failed to create ${u.email}: ${error.message}`);
      continue;
    }
    userIds[u.role] = data.user.id;
    console.log(`+ created ${u.email} (${u.role})`);
  }

  const { data: org, error: orgErr } = await sb.from('organizations').insert({
    name: 'Conciergerie Test Lokizio',
    plan: 'business',
    onboarding_completed: true,
  }).select().single();
  if (orgErr) { console.error('Org error:', orgErr); process.exit(1); }
  console.log(`+ org created: ${org.id}`);

  const memberRows = USERS.map(u => ({
    org_id: org.id,
    user_id: userIds[u.role],
    role: u.role,
    accepted: true,
    invited_email: u.email,
    display_name: u.name,
  }));
  const { error: memErr } = await sb.from('members').insert(memberRows);
  if (memErr) console.error('Members error:', memErr);
  else console.log(`+ ${memberRows.length} members linked`);

  const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30);
  await sb.from('subscriptions').upsert({
    user_id: userIds.concierge, plan: 'business',
    current_period_end: trialEnd.toISOString(),
  });

  const { data: prop, error: propErr } = await sb.from('properties').insert({
    org_id: org.id,
    name: 'Appartement Test Centre',
    address: '12 rue de la Paix, 75002 Paris',
    type: 'apartment',
    rooms: 3,
    surface: 65,
    notes: 'Bien de demonstration pour tester Lokizio.',
    icals: [
      { platform: 'airbnb', url: '' },
      { platform: 'booking', url: '' },
    ],
    service_config: {
      cleaning_standard: { enabled: true, frequency: 'booking_end', price: 75, priceAuto: true, params: { rooms: 3, surface: 65 } }
    },
    required_services: ['cleaning_standard'],
  }).select().single();
  if (propErr) console.error('Property error:', propErr);
  else console.log(`+ property: ${prop.name}`);

  const today = new Date();
  const start = new Date(today.getTime() - 1 * 86400000).toISOString().split('T')[0];
  const end = new Date(today.getTime() + 5 * 86400000).toISOString().split('T')[0];
  if (prop) {
    await sb.from('reservations').insert({
      org_id: org.id,
      property_id: prop.id,
      tenant_user_id: userIds.tenant,
      start_date: start,
      end_date: end,
      status: 'active',
      access_instructions: 'Code immeuble: 4321A. Boite a cles a droite, code: 7890.',
      notes: 'Voyageur de demonstration - sejour de test.',
    });
    console.log(`+ reservation (tenant on site, ${start} -> ${end})`);
  }

  if (prop) {
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = new Date(today.getTime() + 1 * 86400000).toISOString().split('T')[0];
    const next7Str = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];
    await sb.from('service_requests').insert([
      { org_id: org.id, property_id: prop.id, service_type: 'cleaning_standard', requested_date: tomorrowStr, status: 'pending' },
      { org_id: org.id, property_id: prop.id, service_type: 'cleaning_standard', requested_date: next7Str, status: 'assigned', provider_id: userIds.provider, assigned_to: userIds.provider, assigned_provider: 'Prestataire Test' },
      { org_id: org.id, property_id: prop.id, service_type: 'windows', requested_date: todayStr, status: 'pending' },
    ]);
    console.log(`+ 3 service requests (today no-provider, tomorrow no-provider, next week assigned)`);
  }

  const profiles = [
    { user_id: userIds.concierge, role: 'concierge', display_name: 'Concierge Test', company_name: 'Conciergerie Test Lokizio', is_public: true, city: 'Paris', country: 'FR' },
    { user_id: userIds.provider, role: 'provider', display_name: 'Prestataire Test', company_name: 'Test Cleaning Services', is_public: true, city: 'Paris', country: 'FR', services: ['cleaning_standard', 'windows', 'laundry'] },
    { user_id: userIds.owner, role: 'owner', display_name: 'Proprietaire Test', is_public: true, city: 'Paris', country: 'FR' },
  ];
  for (const p of profiles) {
    await sb.from('marketplace_profiles').upsert(p, { onConflict: 'user_id' });
  }
  console.log(`+ ${profiles.length} marketplace profiles set as public`);

  console.log('\n=== DONE ===');
  console.log('\nLogin (password Test1234! for all):');
  USERS.forEach(u => console.log('  ' + u.role.padEnd(10), u.email));
  console.log(`\n${KEEP_EMAIL} preserved with all his data.`);
}

main().catch(err => { console.error('Reset crashed:', err); process.exit(1); });
