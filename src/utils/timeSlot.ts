/**
 * timeSlot.ts — Utility for parsing and comparing time slots
 *
 * Supports two formats:
 *   "10:00 AM"            → treats this as start; end = start + durationMin
 *   "10:00 AM - 12:00 PM" → explicit start and end
 */


/**
 * Normalizes a time slot string by converting corrupt dashes or em/en dashes to standard " - ".
 */
export function normalizeTimeSlot(slot?: string): string {
  if (!slot) return '';
  return slot
    .replace(/[\u2014\u2013\u2012\u2015]|[\u00E2][\u20AC][\u201D\u2013"]|â€”|â€“|â€"/g, ' - ')
    .replace(/\s*-\s*/g, ' - ')
    .trim();
}

const SLOT_DURATION_MIN = 120; // default: 2 hours per service

/** Parse "h:mm AM/PM" into minutes since midnight */
function parseTime12(time: string): number {
  const normalized = time.trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match) return -1;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];
  if (period === 'AM') {
    if (hours === 12) hours = 0;
  } else {
    if (hours !== 12) hours += 12;
  }
  return hours * 60 + minutes;
}

/** Format minutes since midnight to "h:mm AM/PM" */
export function minutesToTime12(totalMin: number): string {
  const clipped = Math.max(0, Math.min(totalMin, 23 * 60 + 59));
  const hours24 = Math.floor(clipped / 60);
  const mins = clipped % 60;
  const period = hours24 < 12 ? 'AM' : 'PM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  return hours12 + ':' + String(mins).padStart(2, '0') + ' ' + period;
}

/**
 * Parse a timeSlot string into { start, end } in minutes since midnight.
 * Falls back to durationMin for end if only start provided.
 */
export function parseSlotToMinutes(
  rawSlot: string,
  durationMin: number = SLOT_DURATION_MIN
): { start: number; end: number } {
  const slot = normalizeTimeSlot(rawSlot);
  if (!slot || slot.trim() === '') return { start: -1, end: -1 };

  const rangeSep = slot.includes(' - ') ? ' - ' : slot.includes('-') ? '-' : null;
  if (rangeSep) {
    const parts = slot.split(rangeSep).map((p) => p.trim());
    if (parts.length === 2) {
      const start = parseTime12(parts[0]);
      const end = parseTime12(parts[1]);
      if (start >= 0 && end > 0) return { start, end };
    }
  }

  const start = parseTime12(slot.trim());
  if (start >= 0) return { start, end: start + durationMin };

  return { start: -1, end: -1 };
}

/**
 * Returns true if slot A and slot B overlap.
 * Overlap: A.start < B.end AND A.end > B.start
 */
export function slotsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number }
): boolean {
  if (a.start < 0 || b.start < 0) return false;
  return a.start < b.end && a.end > b.start;
}

/**
 * Return available start-time strings given busy slots.
 */
export function suggestAvailableSlots(
  busySlots: Array<{ start: number; end: number }>,
  dayStartMin: number = 8 * 60,
  dayEndMin:   number = 20 * 60,
  durationMin: number = SLOT_DURATION_MIN,
  stepMin:     number = 60,
  maxSuggestions: number = 5
): string[] {
  const suggestions: string[] = [];
  for (let s = dayStartMin; s + durationMin <= dayEndMin; s += stepMin) {
    const candidate = { start: s, end: s + durationMin };
    const clash = busySlots.some((busy) => slotsOverlap(candidate, busy));
    if (!clash) {
      suggestions.push(minutesToTime12(s));
      if (suggestions.length >= maxSuggestions) break;
    }
  }
  return suggestions;
}

/** Statuses that block a time slot */
export const SLOT_OCCUPYING_STATUSES = [
  'requested',
  'accepted',
  'ongoing',
  'serviceCompleted',
  'paymentPending',
  'paymentCompleted',
];
