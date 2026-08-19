export interface Client {
  id: string;
  name: string;
  groupId: string;
  portalUrl: string;
  createdAt: number;
  userId: string;
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  createdAt: number;
}

export type SessionKind = "dietitianSessions" | "coachSessions";

export const SESSION_LABELS: Record<SessionKind, string> = {
  dietitianSessions: "שיחות עם תזונאית",
  coachSessions: "שיחות עם מאמן",
};
