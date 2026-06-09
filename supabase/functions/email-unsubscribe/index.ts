// Edge Function: email-unsubscribe
// Handles one-click unsubscribe from Lokizio emails.
// URL: /functions/v1/email-unsubscribe?email=<email>&token=<hmac>
// Returns a simple HTML confirmation page.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const UNSUB_SECRET = Deno.env.get('UNSUB_SECRET') || 'lokizio-unsub-fallback';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function hmacToken(email: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(UNSUB_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(email.toLowerCase()));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function htmlPage(title: string, message: string): Response {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;background:#0f0f1a;color:#e0e0e8;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}.box{max-width:480px;background:#1a1a2e;border:1px solid #2a2a44;border-radius:16px;padding:32px;text-align:center;}h1{margin-top:0;color:#fff;}p{line-height:1.6;color:#b0b0c0;}</style></head><body><div class="box"><h1>${title}</h1><p>${message}</p></div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const email = (url.searchParams.get('email') || '').trim().toLowerCase();
    const token = url.searchParams.get('token') || '';
    if (!email) return htmlPage('Lien invalide', 'Email manquant.');

    const expected = await hmacToken(email);
    if (token !== expected) return htmlPage('Lien invalide', 'Ce lien de desabonnement est invalide ou a expire.');

    await sb.from('email_optout').upsert({ email }, { onConflict: 'email' });
    return htmlPage('✓ Desabonnement confirme', `Vous ne recevrez plus d'emails de notification de Lokizio a l'adresse <strong>${email}</strong>.<br><br>Les emails de transaction obligatoires (reinitialisation de mot de passe, factures envoyees manuellement) peuvent toujours vous parvenir pour des raisons legales.`);
  } catch (e: any) {
    return htmlPage('Erreur', 'Une erreur s\'est produite. Contactez le support.');
  }
});
