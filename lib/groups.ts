export type Program = "Start" | "Pro" | "Momentum" | "Boost" | "אימון לאיזון" | "Routine" | "VIP";

export const PROGRAM_WEEKS: Record<Program, number> = {
  Start: 13,
  Pro: 13,
  Momentum: 12,
  Boost: 8,
  "אימון לאיזון": 4,
  Routine: 12,
  VIP: 13,
};

export const PROGRAMS: Program[] = ["Start", "Pro", "Momentum", "Boost", "אימון לאיזון", "Routine", "VIP"];

export const PROGRAM_COLORS: Record<Program, { bg: string; text: string; border: string }> = {
  Start:          { bg: "bg-sky-100",     text: "text-sky-700",     border: "border-sky-200" },
  Pro:            { bg: "bg-violet-100",  text: "text-violet-700",  border: "border-violet-200" },
  Momentum:       { bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-200" },
  Boost:          { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200" },
  "אימון לאיזון": { bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-200" },
  Routine:        { bg: "bg-teal-100",    text: "text-teal-700",    border: "border-teal-200" },
  VIP:            { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200" },
};

export interface Group {
  id: string;
  name: string;
  program: Program;
  startDate: string; // ISO date string YYYY-MM-DD
  coachName?: string; // free text — groups created before this field don't have one yet
  createdAt: number; // timestamp for sort order
  userId: string;
  whatsappGroupId?: string; // WhatsApp group JID, e.g. "120363...@g.us"
  whatsappGroupName?: string; // display name at the time it was linked
  whatsappOpen?: boolean; // last known "who can send messages" state; unset = unknown
  whatsappArchived?: boolean; // true once the end-of-cycle close procedure has run
}

// Returns the Sunday at or before the given date
function getSunday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d;
}

// Un-clamped 1-based week for `referenceDate` (defaults to today) relative to
// startDate: < 1 means the cycle hadn't started yet, > totalWeeks means it
// had already ended by that date.
function getRawWeek(startDate: string, referenceDate: Date = new Date()): number {
  const startSunday = getSunday(new Date(startDate + "T00:00:00"));
  const refSunday = getSunday(referenceDate);

  const diffMs = refSunday.getTime() - startSunday.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// Which program-week a given date (e.g. a logged session's date) fell in.
// Not clamped to the program's total length — a session logged after the
// program's official end still reports a real week number.
export function getWeekForDate(startDate: string, dateISO: string): number {
  return getRawWeek(startDate, new Date(dateISO + "T00:00:00"));
}

// Returns current week number (1-based). Returns null if the program hasn't
// started yet or has already ended.
export function getCurrentWeek(startDate: string, program: Program): number | null {
  const week = getRawWeek(startDate);
  if (week < 1 || week > PROGRAM_WEEKS[program]) return null;
  return week;
}

export function isGroupActive(startDate: string, program: Program): boolean {
  return getCurrentWeek(startDate, program) !== null;
}

// Cycle whose start date is still in the future.
export function isGroupUpcoming(startDate: string): boolean {
  return getRawWeek(startDate) < 1;
}

// Groups a new client can be assigned to: currently running or not yet started.
// Finished cycles are deliberately excluded.
export function canAssignClients(startDate: string, program: Program): boolean {
  return isGroupActive(startDate, program) || isGroupUpcoming(startDate);
}
