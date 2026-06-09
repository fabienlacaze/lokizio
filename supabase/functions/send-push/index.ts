// Edge Function: send-push
// Sends Web Push notifications via VAPID to subscribed users.
//
// Body: {
//   user_id?: string,          // target a specific user
//   provider_token?: string,   // legacy: target by readonly provider token (view.html)
//   title: string,
//   body: string,
//   url?: string,
//   tag?: string,
// }

import webpush from 'https://esm.sh/web-push@3.6.7?target=deno';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:lokizio.service@outlook.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SB_KEY = Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE); } catch (e) { console.error('VAPID config error:', e); }
}

async function fetchSubs(filterCol: string, filterVal: string): Promise<any[]> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?${filterCol}=eq.${encodeURIComponent(filterVal)}&select=*`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
  );
  if (!resp.ok) return [];
  return await resp.json();
}

async function deleteSub(id: string) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
  } catch { /* noop */ }
}

async function getCallerOrg(userId: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/members?user_id=eq.${userId}&select=org_id&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
    );
    if (!resp.ok) return null;
    const rows = await resp.json();
    return rows?.[0]?.org_id || null;
  } catch { return null; }
}

async function targetUserInSameOrg(callerOrg: string, targetUserId: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/members?user_id=eq.${targetUserId}&org_id=eq.${callerOrg}&select=id&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
    );
    if (!resp.ok) return false;
    const rows = await resp.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  const CORS = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!VAPID_PRIVATE || !VAPID_PUBLIC) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured in secrets' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { userId: callerId } = await requireAuth(req, SUPABASE_URL, ANON_KEY);

    const { user_id, provider_token, title, body, url, tag } = await req.json();
    if (!title || !body) throw new Error('title and body required');
    if (!user_id && !provider_token) throw new Error('user_id or provider_token required');

    if (user_id && user_id !== callerId) {
      const org = await getCallerOrg(callerId);
      if (!org || !(await targetUserInSameOrg(org, user_id))) {
        return new Response(JSON.stringify({ error: 'Forbidden: target user outside your organization' }), {
          status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    let subs: any[] = [];
    if (user_id) subs = await fetchSubs('user_id', user_id);
    else if (provider_token) subs = await fetchSubs('provider_token', provider_token);

    const payload = JSON.stringify({ title, body, url: url || '/', tag: tag || 'lokizio' });
    let sent = 0, failed = 0;

    for (const s of subs) {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh || (s.keys && s.keys.p256dh), auth: s.auth || (s.keys && s.keys.auth) },
      };
      try {
        await webpush.sendNotification(subscription, payload, { TTL: 86400 });
        sent++;
      } catch (e: any) {
        failed++;
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await deleteSub(s.id);
        } else {
          console.error('push err:', e?.statusCode, e?.body || e?.message || e);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, total: subs.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const status = /auth|token|forbidden/i.test(msg) ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
