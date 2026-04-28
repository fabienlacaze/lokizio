#!/usr/bin/env node
/**
 * Seed 4 test users in PROD (concierge, owner, provider, tenant) with a
 * realistic shared org + property + reservation + service request, so Fabien
 * can log in to each one to test all roles end-to-end.
 *
 * Login credentials (same password for all):
 *   concierge@lokizio.test  / Test1234!
 *   owner@lokizio.test      / Test1234!
 *   provider@lokizio.test   / Test1234!
 *   tenant@lokizio.test     / Test1234!
 *
 * Re-running this script wipes and recreates all 4 users.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mrvejwyvhuivmipfwlzz.supabase.co';
const SERVICE_KEY = process.argv[2];

if (!SERVICE_KEY || !SERVICE_KEY.startsWith('eyJ')) {
  console.error('Usage: node scripts/seed-test-users.js <SUPABASE_PROD_SERVICE_KEY>');
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
  console.log('=== Seeding test users ===\n');

  // 1. Wipe existing test users (idempotent re-run)
  const { data: existing } = await sb.auth.admin.listUsers({ perPage: 200 });
  for (const u of existing?.users || []) {
    if (u.email && u.email.endsWith('@lokizio.test')) {
      console.log('Removing existing:', u.email);
      // First delete the org they own (cascades members/properties/etc)
      const { data: members } = await sb.from('members').select('org_id').eq('user_id', u.id);
      for (const m of members || []) {
        await sb.from('organizations').delete().eq('id', m.org_id);
      }
      await sb.auth.admin.deleteUser(u.id);
    }
  }

  // 2. Create the 4 users
  const userIds = {};
  for (const u of USERS) {
    const { data, error } = await sb.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) {
      console.error(`Failed to create ${u.email}:`, error.message);
      continue;
    }
    userIds[u.role] = data.user.id;
    console.log(`✓ Created ${u.email} (${u.role})`);
  }

  // 3. Create a shared org owned by the concierge
  const { data: org, error: orgErr } = await sb.from('organizations').insert({
    name: 'Conciergerie Test Lokizio',
    plan: 'business',
    onboarding_completed: true,
  }).select().single();
  if (orgErr) { console.error('Org error:', orgErr); process.exit(1); }
  console.log(`✓ Org created: ${org.id}`);

  // 4. Add all users as members of the org with their respective roles
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
  else console.log(`✓ ${memberRows.length} members linked to org`);

  // 5. Subscriptions (give business plan to concierge)
  const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30);
  await sb.from('subscriptions').upsert({
    user_id: userIds.concierge, plan: 'business',
    current_period_end: trialEnd.toISOString(),
  });

  // 6. Property (owned by owner, managed by concierge org)
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
  if (propErr) { console.error('Property error:', propErr); }
  else console.log(`✓ Property created: ${prop.name}`);

  // 7. Reservation (active, tenant currently on site)
  const today = new Date();
  const start = new Date(today.getTime() - 1 * 86400000).toISOString().split('T')[0]; // arrived yesterday
  const end = new Date(today.getTime() + 5 * 86400000).toISOString().split('T')[0];   // leaves in 5 days
  if (prop) {
    await sb.from('reservations').insert({
      org_id: org.id,
      property_id: prop.id,
      tenant_user_id: userIds.tenant,
      start_date: start,
      end_date: end,
      status: 'active',
      access_instructions: 'Code immeuble: 4321A. Boite a cles a droite de la porte, code: 7890.',
      notes: 'Voyageur de demonstration - sejour de test.',
    });
    console.log(`✓ Reservation created (tenant on site, ${start} -> ${end})`);
  }

  // 8. Service requests
  if (prop) {
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = new Date(today.getTime() + 1 * 86400000).toISOString().split('T')[0];
    const next7Str = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

    await sb.from('service_requests').insert([
      {
        org_id: org.id, property_id: prop.id,
        service_type: 'cleaning_standard',
        requested_date: tomorrowStr,
        status: 'pending',
      },
      {
        org_id: org.id, property_id: prop.id,
        service_type: 'cleaning_standard',
        requested_date: next7Str,
        status: 'assigned',
        provider_id: userIds.provider,
        assigned_to: userIds.provider,
        assigned_provider: 'Prestataire Test',
      },
      {
        org_id: org.id, property_id: prop.id,
        service_type: 'windows',
        requested_date: todayStr,
        status: 'pending',
      },
    ]);
    console.log(`✓ 3 service requests created (1 today no-provider, 1 tomorrow no-provider, 1 next week assigned)`);
  }

  // 9. Marketplace profiles (visible publicly)
  const profiles = [
    { user_id: userIds.concierge, role: 'concierge', display_name: 'Concierge Test', company_name: 'Conciergerie Test Lokizio', is_public: true, city: 'Paris', country: 'FR' },
    { user_id: userIds.provider, role: 'provider', display_name: 'Prestataire Test', company_name: 'Test Cleaning Services', is_public: true, city: 'Paris', country: 'FR', services: ['cleaning_standard', 'windows', 'laundry'] },
    { user_id: userIds.owner, role: 'owner', display_name: 'Proprietaire Test', is_public: true, city: 'Paris', country: 'FR' },
  ];
  for (const p of profiles) {
    await sb.from('marketplace_profiles').upsert(p, { onConflict: 'user_id' });
  }
  console.log(`✓ ${profiles.length} marketplace profiles set as public`);

  console.log('\n=== ALL DONE ===');
  console.log('\nLogin credentials (password: Test1234! for all):');
  USERS.forEach(u => console.log('  ' + u.role.padEnd(10), u.email));
  console.log('\nOpen the app and login with any of these to test the corresponding role.');
}

main().catch(err => { console.error('Seed crashed:', err); process.exit(1); });
