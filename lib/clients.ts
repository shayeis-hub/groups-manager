export interface Client {
  id: string;
  name: string;
  groupId: string;
  portalUrl: string;
  createdAt: number;
  userId: string;
  openingQuestionnaire?: boolean; // whether the client filled the intake questionnaire
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  createdAt: number;
  authorName?: string; // who logged it — matters when multiple dietitians share a client
}

export type SessionKind = "dietitianSessions" | "coachSessions";

export const SESSION_LABELS: Record<SessionKind, string> = {
  dietitianSessions: "שיחות עם תזונאית",
  coachSessions: "שיחות עם מאמן",
};
