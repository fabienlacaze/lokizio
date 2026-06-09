// Supabase Edge Function: refresh-ical
// Fetches iCal URLs for all properties and updates plannings
// Called by pg_cron every 2 hours — FREE within Supabase limits
//
// COST GUARD: max 500 properties processed per invocation
// At 12 invocations/day = 6000/day << 500K/month free limit

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FRENCH_DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MAX_PROPERTIES = 500 // Cost guard

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

// ── iCal Parser ──
function parseIcal(text: string, source: string) {
  const events: { start: string; end: string; summary: string; source: string }[] = []
  text = text.replace(/\r\n /g, '').replace(/\r\n\t/g, '')
  let inEv = false, ds = '', de = '', sm = ''
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t === 'BEGIN:VEVENT') { inEv = true; ds = de = sm = '' }
    else if (t === 'END:VEVENT') {
      if (inEv && ds) {
        const s = parseDt(ds), e = parseDt(de) || s
        if (s) events.push({ start: s, end: e!, summary: sm, source })
      }
      inEv = false
    } else if (inEv) {
      if (t.startsWith('DTSTART')) ds = t
      else if (t.startsWith('DTEND')) de = t
      else if (t.startsWith('SUMMARY:')) sm = t.substring(8).trim()
    }
  }
  return events
}

function parseDt(v: string): string | null {
  const m = v.match(/:(.+)$/)
  const d = m ? m[1].trim() : v.trim()
  const m2 = d.match(/^(\d{4})(\d{2})(\d{2})/)
  return m2 ? `${m2[1]}-${m2[2]}-${m2[3]}` : null
}

function fmtFr(iso: string) {
  return iso && iso.length >= 10 ? `${iso.substring(8, 10)}/${iso.substring(5, 7)}/${iso.substring(0, 4)}` : ''
}

// ── Main ──
Deno.serve(async (req) => {
  try {
    // Auth check: only allow service_role or cron secret
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    const url = new URL(req.url)
    const secret = url.searchParams.get('secret')

    if (!authHeader?.includes(SERVICE_KEY) && secret !== cronSecret) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Fetch all properties with iCal URLs (limit for cost guard)
    const { data: properties, error: propErr } = await sb
      .from('properties')
      .select('id, org_id, name, icals, providers, plannings')
      .not('icals', 'is', null)
      .limit(MAX_PROPERTIES)

    if (propErr) throw propErr
    if (!properties || properties.length === 0) {
      return Response.json({ message: 'No properties with iCal URLs', processed: 0 })
    }

    let processed = 0
    let newCleanings = 0

    for (const prop of properties) {
      const icals = prop.icals || []
      const hasUrls = icals.some((i: any) => i.url)
      if (!hasUrls) continue

      // Fetch all iCal URLs for this property
      const allEvents: any[] = []
      for (const ical of icals) {
        if (!ical.url) continue
        try {
          const resp = await fetch(ical.url, {
            headers: { 'User-Agent': 'Lokizio/3.0' },
            signal: AbortSignal.timeout(15000)
          })
          const text = await resp.text()
          const source = ical.label || (ical.url.includes('airbnb') ? 'Airbnb' : ical.url.includes('booking') ? 'Booking' : 'iCal')
          const events = parseIcal(text, source)
          allEvents.push(...events)
        } catch (e) {
          console.error(`  ${prop.name}: iCal fetch error:`, e)
        }
      }

      if (allEvents.length === 0) continue

      // Build cleanings from events
      const today = new Date().toISOString().substring(0, 10)
      const prevPlannings = prop.plannings || []
      const prevMap: Record<string, any> = {}
      for (const c of prevPlannings) {
        prevMap[c.checkinDate || c.date || ''] = c
      }

      allEvents.sort((a, b) => a.start.localeCompare(b.start))
      const seen = new Set<string>()
      const cleanings: any[] = []

      for (let i = 0; i < allEvents.length; i++) {
        const ev = allEvents[i]
        const ds = ev.start
        if (ds < today || seen.has(ds)) continue
        const sl = ev.summary.toLowerCase()
        if (sl.includes('not available') || sl.includes('closed') || sl.includes('blocked')) continue
        seen.add(ds)

        const d = new Date(ds)
        const dayName = FRENCH_DAYS[d.getDay()]
        const pco = i > 0 ? allEvents[i - 1].end : ''
        const isNew = !(ds in prevMap)
        if (isNew) newCleanings++

        cleanings.push({
          date: ds,
          dayName,
          checkinDate: ds,
          cleaningDate: ds,
          checkoutDate: ev.end,
          prevCheckout: pco,
          source: ev.source,
          provider: prevMap[ds]?.provider || '',
          providerPhone: prevMap[ds]?.providerPhone || '',
          summary: ev.summary,
          isNew,
          dateFR: fmtFr(ds),
          cleaningDateFR: fmtFr(ds),
          checkoutDateFR: fmtFr(ev.end)
        })
      }

      // Round-robin assignment for unassigned cleanings
      const providers = prop.providers || []
      if (providers.length > 0 && cleanings.length > 0) {
        const ctr: Record<string, number> = {}
        const pNames = providers.map((p: any) => p.name)
        for (const p of providers) ctr[p.name] = 0

        // First pass: keep locked assignments
        for (const c of cleanings) {
          if (c.provider && pNames.includes(c.provider)) {
            ctr[c.provider]++
            c.isLocked = true
          }
        }
        // Second pass: assign unassigned
        for (const c of cleanings) {
          if (c.isLocked) continue
          const tot = Math.max(Object.values(ctr).reduce((a, b) => a + b, 0), 1)
          let best: any = null, bestDef = -999999
          for (const p of providers) {
            const cur = (ctr[p.name] / tot) * 100
            const deficit = (parseInt(p.percentage) || 0) - cur
            if (!best || deficit > bestDef) { best = p; bestDef = deficit }
          }
          if (best) {
            c.provider = best.name
            c.providerPhone = best.phone || ''
            ctr[best.name]++
          }
        }
      }

      // Save updated plannings to the plannings table (same as client)
      const { data: existingPlan } = await sb.from('plannings').select('id').eq('property_id', prop.id).maybeSingle()
      if (existingPlan) {
        const { error: updateErr } = await sb.from('plannings')
          .update({ cleanings, updated_at: new Date().toISOString() })
          .eq('property_id', prop.id)
        if (updateErr) console.error(`  ${prop.name}: save error:`, updateErr)
        else processed++
      } else {
        const { error: insertErr } = await sb.from('plannings')
          .insert({ property_id: prop.id, cleanings })
        if (insertErr) console.error(`  ${prop.name}: insert error:`, insertErr)
        else processed++
      }
      // Also update last_ical_refresh timestamp
      await sb.from('properties').update({ last_ical_refresh: new Date().toISOString() }).eq('id', prop.id)
    }

    const result = {
      message: 'iCal refresh complete',
      processed,
      total_properties: properties.length,
      new_cleanings: newCleanings,
      timestamp: new Date().toISOString()
    }
    console.log(JSON.stringify(result))
    return Response.json(result)

  } catch (err) {
    console.error('Edge function error:', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
})
