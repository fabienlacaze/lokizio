// Integration tests: connection_requests unique active constraint.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  hasTestConfig, adminClient, createTestUser, cleanupUser,
} from './_helpers.js';

const skip = !hasTestConfig();

describe.skipIf(skip)('Connection requests - duplicate prevention', () => {
  let userA, userB;

  beforeAll(async () => {
    userA = await createTestUser('connA');
    userB = await createTestUser('connB');
  }, 60_000);

  afterAll(async () => {
    const admin = adminClient();
    await admin.from('connection_requests').delete().or(`sender_id.eq.${userA.user.id},receiver_id.eq.${userA.user.id}`);
    await cleanupUser(userA.user.id);
    await cleanupUser(userB.user.id);
  }, 30_000);

  it('first pending request succeeds', async () => {
    const { data, error } = await userA.client.from('connection_requests').insert({
      sender_id: userA.user.id, sender_name: 'A',
      receiver_id: userB.user.id, receiver_name: 'B',
      sender_role: 'concierge', receiver_role: 'provider', proposed_role: 'provider',
      status: 'pending',
    }).select();
    expect(error).toBeNull();
    expect(data.length).toBe(1);
  });

  it('second pending request for same pair is rejected (unique index)', async () => {
    const { error } = await userA.client.from('connection_requests').insert({
      sender_id: userA.user.id, sender_name: 'A',
      receiver_id: userB.user.id, receiver_name: 'B',
      sender_role: 'concierge', receiver_role: 'provider', proposed_role: 'provider',
      status: 'pending',
    });
    // Expect duplicate-key violation (unique partial index)
    expect(error).not.toBeNull();
    expect(error.message + (error.code || '')).toMatch(/duplicate|unique|23505/i);
  });

  it('refused request does not block new pending for same pair', async () => {
    const admin = adminClient();
    // Mark existing as refused
    await admin.from('connection_requests').update({ status: 'refused' })
      .eq('sender_id', userA.user.id).eq('receiver_id', userB.user.id);

    const { data, error } = await userA.client.from('connection_requests').insert({
      sender_id: userA.user.id, sender_name: 'A',
      receiver_id: userB.user.id, receiver_name: 'B',
      sender_role: 'concierge', receiver_role: 'provider', proposed_role: 'provider',
      status: 'pending',
    }).select();
    expect(error).toBeNull();
    expect(data.length).toBe(1);
  });

  it('reversed pair (B→A) is also blocked while A→B is pending', async () => {
    // Clean current state: mark all as refused
    const admin = adminClient();
    await admin.from('connection_requests').update({ status: 'refused' })
      .or(`sender_id.eq.${userA.user.id},receiver_id.eq.${userA.user.id}`);

    // A→B pending
    await userA.client.from('connection_requests').insert({
      sender_id: userA.user.id, sender_name: 'A',
      receiver_id: userB.user.id, receiver_name: 'B',
      sender_role: 'concierge', receiver_role: 'provider', proposed_role: 'provider',
      status: 'pending',
    });

    // B→A pending should fail due to unique index on LEAST/GREATEST
    const { error } = await userB.client.from('connection_requests').insert({
      sender_id: userB.user.id, sender_name: 'B',
      receiver_id: userA.user.id, receiver_name: 'A',
      sender_role: 'provider', receiver_role: 'concierge', proposed_role: 'concierge',
      status: 'pending',
    });
    expect(error).not.toBeNull();
  });
});
