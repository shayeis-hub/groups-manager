export type Program = "Start" | "Pro" | "Momentum" | "Boost" | "אימון לאיזון";

export const PROGRAM_WEEKS: Record<Program, number> = {
  Start: 13,
  Pro: 13,
  Momentum: 12,
  Boost: 8,
  "אימון לאיזון": 4,
};

export const PROGRAMS: Program[] = ["Start", "Pro", "Momentum", "Boost", "אימון לאיזון"];

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

// Returns current week number (1-based). Returns null if program has ended.
export function getCurrentWeek(startDate: string, program: Program): number | null {
  const totalWeeks = PROGRAM_WEEKS[program];
  const start = new Date(startDate + "T00:00:00");
  const startSunday = getSunday(start);
  const nowSunday = getSunday(new Date());

  const diffMs = nowSunday.getTime() - startSunday.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  const week = diffWeeks + 1;

  if (week < 1 || week > totalWeeks) return null;
  return week;
}

export function isGroupActive(startDate: string, program: Program): boolean {
  return getCurrentWeek(startDate, program) !== null;
}
