// Edge Function: export-ical
// Generates an iCal (.ics) feed for a property's reservations.
// Public endpoint (no auth) — the URL contains a read-only property_id.
// Airbnb/Booking/VRBO/Gites de France can subscribe to this URL to sync availability.
//
// Usage: GET /functions/v1/export-ical?property_id=<uuid>
// Returns: text/calendar feed

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function formatIcalDate(d: string): string {
  // iCal DATE format: YYYYMMDD (no dashes, no time for all-day events)
  return d.replace(/-/g, "");
}

function escapeIcalText(s: string): string {
  if (!s) return "";
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("property_id");

    if (!propertyId) {
      return new Response("Missing property_id parameter", { status: 400 });
    }

    // Load property + its active reservations
    const { data: property, error: propErr } = await sb.from("properties")
      .select("id, name")
      .eq("id", propertyId)
      .single();

    if (propErr || !property) {
      return new Response("Property not found", { status: 404 });
    }

    const { data: reservations } = await sb.from("reservations")
      .select("id, start_date, end_date, status")
      .eq("property_id", propertyId)
      .in("status", ["active", "completed"]);

    const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const propName = escapeIcalText(property.name || "Property");

    let ical = "BEGIN:VCALENDAR\r\n";
    ical += "VERSION:2.0\r\n";
    ical += `PRODID:-//Lokizio//Property ${propertyId}//FR\r\n`;
    ical += "CALSCALE:GREGORIAN\r\n";
    ical += "METHOD:PUBLISH\r\n";
    ical += `X-WR-CALNAME:${propName} - Reservations\r\n`;

    for (const r of reservations || []) {
      if (!r.start_date || !r.end_date) continue;
      ical += "BEGIN:VEVENT\r\n";
      ical += `UID:${r.id}@lokizio\r\n`;
      ical += `DTSTAMP:${now}\r\n`;
      ical += `DTSTART;VALUE=DATE:${formatIcalDate(r.start_date)}\r\n`;
      ical += `DTEND;VALUE=DATE:${formatIcalDate(r.end_date)}\r\n`;
      ical += `SUMMARY:Reserve - Lokizio\r\n`;
      ical += `STATUS:${r.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}\r\n`;
      ical += "TRANSP:OPAQUE\r\n";
      ical += "END:VEVENT\r\n";
    }

    ical += "END:VCALENDAR\r\n";

    return new Response(ical, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=900", // 15 min cache
        "Content-Disposition": `inline; filename="lokizio-${propertyId}.ics"`,
      },
    });
  } catch (e: any) {
    return new Response(`Error: ${e?.message || String(e)}`, { status: 500 });
  }
});
