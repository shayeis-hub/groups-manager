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

export interface Group {
  id: string;
  name: string;
  program: Program;
  startDate: string; // ISO date string YYYY-MM-DD
  createdAt: number; // timestamp for sort order
  userId: string;
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
