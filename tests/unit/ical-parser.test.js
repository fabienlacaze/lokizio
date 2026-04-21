// Tests pour le parser iCal (ical_parser.js)
// Logique dupliquee pour isolement du test (module depend de globals SUPABASE_URL)

import { describe, it, expect } from 'vitest';

const FRENCH_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function getFrenchDay(dt) {
  const d = dt.getDay();
  return FRENCH_DAYS[d === 0 ? 6 : d - 1];
}

function parseIcalDate(value) {
  const m = value.match(/:(.+)$/);
  const dateStr = m ? m[1].trim() : value.trim();
  const m2 = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (m2) return new Date(Date.UTC(+m2[1], +m2[2] - 1, +m2[3], +m2[4], +m2[5], +m2[6]));
  const m3 = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m3) return new Date(+m3[1], +m3[2] - 1, +m3[3]);
  return null;
}

function parseIcalText(content, source) {
  const events = [];
  content = content.replace(/\r\n /g, '').replace(/\r\n\t/g, '');
  const lines = content.split('\n');
  let inEvent = false, dtStart = '', dtEnd = '', summary = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') { inEvent = true; dtStart = dtEnd = summary = ''; }
    else if (trimmed === 'END:VEVENT') {
      if (inEvent && dtStart) {
        const start = parseIcalDate(dtStart);
        const end = dtEnd ? parseIcalDate(dtEnd) : start;
        if (start) events.push({ start, end: end || start, summary, source });
      }
      inEvent = false;
    } else if (inEvent) {
      if (trimmed.startsWith('DTSTART')) dtStart = trimmed;
      else if (trimmed.startsWith('DTEND')) dtEnd = trimmed;
      else if (trimmed.startsWith('SUMMARY:')) summary = trimmed.substring(8).trim();
    }
  }
  return events;
}

describe('getFrenchDay', () => {
  it('Monday 2026-04-20 returns "Lun"', () => {
    expect(getFrenchDay(new Date(2026, 3, 20))).toBe('Lun');
  });
  it('Sunday returns "Dim"', () => {
    expect(getFrenchDay(new Date(2026, 3, 19))).toBe('Dim');
  });
  it('Saturday returns "Sam"', () => {
    expect(getFrenchDay(new Date(2026, 3, 18))).toBe('Sam');
  });
});

describe('parseIcalDate', () => {
  it('parses date-only format YYYYMMDD', () => {
    const d = parseIcalDate('DTSTART;VALUE=DATE:20260420');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(20);
  });

  it('parses UTC datetime YYYYMMDDTHHmmssZ', () => {
    const d = parseIcalDate('DTSTART:20260420T143000Z');
    expect(d.toISOString()).toBe('2026-04-20T14:30:00.000Z');
  });

  it('parses datetime without Z', () => {
    const d = parseIcalDate('DTSTART:20260420T143000');
    expect(d).not.toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(parseIcalDate('garbage')).toBeNull();
    expect(parseIcalDate('DTSTART:abc')).toBeNull();
  });
});

describe('parseIcalText', () => {
  const sampleIcal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20260420',
    'DTEND;VALUE=DATE:20260425',
    'SUMMARY:Reservation Airbnb',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20260501',
    'DTEND;VALUE=DATE:20260505',
    'SUMMARY:Booking.com Reservation',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  it('extracts all VEVENTs', () => {
    const events = parseIcalText(sampleIcal, 'airbnb');
    expect(events).toHaveLength(2);
  });

  it('preserves summary', () => {
    const events = parseIcalText(sampleIcal, 'airbnb');
    expect(events[0].summary).toBe('Reservation Airbnb');
    expect(events[1].summary).toBe('Booking.com Reservation');
  });

  it('tags events with source', () => {
    const events = parseIcalText(sampleIcal, 'airbnb');
    expect(events.every(e => e.source === 'airbnb')).toBe(true);
  });

  it('parses dates correctly', () => {
    const events = parseIcalText(sampleIcal, 'test');
    expect(events[0].start.getDate()).toBe(20);
    expect(events[0].start.getMonth()).toBe(3);
  });

  it('handles line folding (RFC 5545)', () => {
    const folded = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260420\r\nSUMMARY:A very long sum\r\n mary split across lines\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const events = parseIcalText(folded, 'test');
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('A very long summary split across lines');
  });

  it('ignores events without DTSTART', () => {
    const broken = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:No date\r\nEND:VEVENT\r\nEND:VCALENDAR';
    expect(parseIcalText(broken, 'test')).toHaveLength(0);
  });

  it('uses DTSTART as DTEND if DTEND missing', () => {
    const single = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260601\r\nSUMMARY:Single day\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const events = parseIcalText(single, 'test');
    expect(events).toHaveLength(1);
    expect(events[0].end).toEqual(events[0].start);
  });

  it('returns empty array for non-iCal input', () => {
    expect(parseIcalText('not an ical', 'test')).toEqual([]);
  });
});
