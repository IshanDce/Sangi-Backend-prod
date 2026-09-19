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
export declare function normalizeTimeSlot(slot?: string): string;
/** Format minutes since midnight to "h:mm AM/PM" */
export declare function minutesToTime12(totalMin: number): string;
/**
 * Parse a timeSlot string into { start, end } in minutes since midnight.
 * Falls back to durationMin for end if only start provided.
 */
export declare function parseSlotToMinutes(rawSlot: string, durationMin?: number): {
    start: number;
    end: number;
};
/**
 * Returns true if slot A and slot B overlap.
 * Overlap: A.start < B.end AND A.end > B.start
 */
export declare function slotsOverlap(a: {
    start: number;
    end: number;
}, b: {
    start: number;
    end: number;
}): boolean;
/**
 * Return available start-time strings given busy slots.
 */
export declare function suggestAvailableSlots(busySlots: Array<{
    start: number;
    end: number;
}>, dayStartMin?: number, dayEndMin?: number, durationMin?: number, stepMin?: number, maxSuggestions?: number): string[];
/** Statuses that block a time slot */
export declare const SLOT_OCCUPYING_STATUSES: string[];
