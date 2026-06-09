// Edge Function: sentry-issues
//
// Proxies a small subset of the Sentry REST API to authenticated super-admins.
// We do this server-side so the Sentry auth token is never exposed to browsers.
//
// Requires Supabase secrets:
//   SENTRY_AUTH_TOKEN  — read-only PAT (event:read, project:read, org:read)
//   SENTRY_ORG         — fabienlacaze
//   SENTRY_PROJECT     — lokizio
//
// Endpoints:
//   GET ?limit=10            list unresolved issues
//   GET ?all=1               include resolved
//   GET ?issue=LOKIZIO-1     full details of one issue (last event)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENTRY_TOKEN = Deno.env.get('SENTRY_AUTH_TOKEN')
const SENTRY_ORG = Deno.env.get('SENTRY_ORG') || 'fabienlacaze'
const SENTRY_PROJECT = Deno.env.get('SENTRY_PROJECT') || 'lokizio'

async function sentryApi(path: string) {
  const url = 'https://sentry.io/api/0' + path
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + SENTRY_TOKEN } })
  if (!r.ok) throw new Error(`Sentry API ${r.status} on ${path}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    if (!SENTRY_TOKEN) {
      return new Response(JSON.stringify({ error: 'SENTRY_AUTH_TOKEN not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    // ── Auth: caller must be a super_admin ──
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return new Response('Unauthorized', { status: 401, headers: CORS })

    // Verify JWT via Supabase
    const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: 'Bearer ' + token } } })
    const { data: { user }, error: userErr } = await sb.auth.getUser()
    if (userErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

    // Check super_admins membership (use service key to bypass RLS for the lookup)
    const admin = createClient(SUPABASE_URL, SERVICE)
    const { data: isAdmin } = await admin.from('super_admins').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!isAdmin) return new Response('Forbidden', { status: 403, headers: CORS })

    // ── Routing ──
    const url = new URL(req.url)
    const issueId = url.searchParams.get('issue')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 50)
    const includeResolved = url.searchParams.get('all') === '1'

    if (issueId) {
      // shortId like LOKIZIO-1 → resolve to numeric id
      let id: string = issueId
      if (/^[A-Z]+-\d+$/.test(issueId)) {
        const list = await sentryApi(`/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?limit=100`)
        const match = (list as any[]).find((i) => i.shortId === issueId)
        if (!match) return new Response(JSON.stringify({ error: 'shortId not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } })
        id = match.id
      }
      const issue = await sentryApi(`/organizations/${SENTRY_ORG}/issues/${id}/`)
      const events = await sentryApi(`/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/events/?limit=5`)
      const lastEvent = (events as any[]).find((e: any) => e.groupID === String(id)) || (events as any[])[0]
      return Response.json({ issue, lastEvent }, { headers: CORS })
    }

    const query = includeResolved ? '' : '&query=is:unresolved'
    const issues = await sentryApi(`/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?limit=${limit}${query}`)
    return Response.json({ issues }, { headers: CORS })
  } catch (e) {
    console.error('sentry-issues error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
})
