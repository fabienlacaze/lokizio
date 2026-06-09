// Edge Function: ical-proxy
// Fetches an iCal feed (Airbnb, Booking, etc.) server-side to bypass CORS.
// Body: { url: "https://..." }
// Returns: raw iCal text (Content-Type: text/calendar)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Allowlist for known iCal providers (prevents SSRF abuse)
const ALLOWED_HOSTS = [
  'airbnb.com', 'airbnb.fr', 'airbnb.co.uk',
  'admin.booking.com', 'booking.com',
  'vrbo.com', 'homeaway.com', 'abritel.fr',
  'calendar.google.com',
  'outlook.live.com', 'outlook.office365.com',
  'icloud.com',
  'gites-de-france.com',
];

function isAllowed(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:' && u.protocol !== 'webcal:') return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some(allowed => host === allowed || host.endsWith('.' + allowed));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json();
    let url = (body?.url || '').trim();
    if (!url) return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

    // Normalize webcal:// → https://
    if (url.startsWith('webcal://')) url = 'https://' + url.slice(9);

    if (!isAllowed(url)) {
      return new Response(JSON.stringify({ error: 'Host not allowed', url }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Lokizio iCal fetcher)',
        'Accept': 'text/calendar, text/plain, */*',
      },
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Upstream HTTP ' + resp.status }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    const text = await resp.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      return new Response(JSON.stringify({ error: 'Response is not a valid iCal feed' }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    return new Response(text, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', ...CORS } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
});
