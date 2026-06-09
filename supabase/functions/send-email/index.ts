// Supabase Edge Function: send-email
// Sends transactional emails via Resend (free: 100 emails/day, 3000/month)
// Used for: invoice notifications, assignment alerts, connection requests
//
// Setup: Add RESEND_API_KEY to Supabase Edge Function secrets
// Get free key at https://resend.com

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { audit } from '../_shared/security.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev' // Free tier, no domain needed

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

interface EmailRequest {
  to: string
  subject: string
  html: string
  type?: string // 'invoice' | 'assignment' | 'connection' | 'reminder' | 'generic'
  user_id?: string
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Auth check
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await sb.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    const body: EmailRequest = await req.json()
    if (!body.to || !body.subject || !body.html) {
      return new Response(JSON.stringify({ error: 'Missing to, subject, or html' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    // Rate limit: max 10 emails per user per hour
    const hourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count } = await sb.from('email_log').select('*', { count: 'exact', head: true })
      .eq('sender_id', user.id).gte('created_at', hourAgo)
    if ((count || 0) >= 10) {
      // Quick Win #1: log rate-limit hits for abuse tracking
      audit({
        user_id: user.id,
        action: 'send_email.rate_limited',
        metadata: { count, limit: 10, window_seconds: 3600, to: body?.to ? body.to.substring(0, 32) + '...' : null },
        severity: 'warning',
      }).catch(() => {})
      return new Response(JSON.stringify({ error: 'Rate limit exceeded (10/hour)' }), { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    // Check opt-out
    const { data: opt } = await sb.from('email_optout').select('email').eq('email', body.to.toLowerCase()).maybeSingle()
    if (opt) {
      await sb.from('email_log').insert({ sender_id: user.id, to_email: body.to, subject: body.subject, type: body.type || 'generic', status: 'skipped', error: 'opt-out' })
      return new Response(JSON.stringify({ ok: true, sent: false, reason: 'Recipient opted out' }), { headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    // Dev mode: no key, log only
    if (!RESEND_KEY) {
      console.log('No RESEND_API_KEY, email logged but not sent:', body.to, body.subject)
      await sb.from('email_log').insert({ sender_id: user.id, to_email: body.to, subject: body.subject, type: body.type || 'generic', status: 'skipped' })
      return new Response(JSON.stringify({ ok: true, sent: false, reason: 'No API key configured. Add RESEND_API_KEY to Supabase Edge Function secrets.' }), { headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    // Generate unsubscribe token (HMAC of email, first 16 hex chars)
    const UNSUB_SECRET = Deno.env.get('UNSUB_SECRET') || 'lokizio-unsub-fallback'
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(UNSUB_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body.to.toLowerCase()))
    const unsubToken = Array.from(new Uint8Array(sig)).map((b: number) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
    const unsubUrl = `${SUPABASE_URL}/functions/v1/email-unsubscribe?email=${encodeURIComponent(body.to)}&token=${unsubToken}`

    // Append footer with unsubscribe link
    const footer = `<div style="font-family:Arial,sans-serif;font-size:11px;color:#999;padding:16px;text-align:center;border-top:1px solid #eee;margin-top:24px;">Lokizio — <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">Se desabonner de ces emails</a></div>`
    const fullHtml = body.html.includes('</body>') ? body.html.replace('</body>', footer + '</body>') : body.html + footer

    // Send via Resend API
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [body.to],
        subject: body.subject,
        html: fullHtml,
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      })
    })

    const resendData = await resendResp.json()

    // Log
    await sb.from('email_log').insert({
      sender_id: user.id,
      to_email: body.to,
      subject: body.subject,
      type: body.type || 'generic',
      status: resendResp.ok ? 'sent' : 'failed',
      resend_id: resendData.id || null,
      error: resendData.message || null,
    })

    if (!resendResp.ok) {
      return new Response(JSON.stringify({ error: resendData.message || 'Send failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    return new Response(JSON.stringify({ ok: true, id: resendData.id }), { headers: { 'Content-Type': 'application/json', ...CORS } })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
})
