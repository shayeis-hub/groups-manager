import { addDoc, collection, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Heads-up for the coach (the account that owns the data) about something a
// dietitian did, so it doesn't go unnoticed unless he happens to go looking.
// Only written by dietitians; only readable/updatable by the coach it's for.
export interface AppNotification {
  id: string;
  ownerUid: string;
  type: "dietitianSession";
  clientId: string;
  clientName: string;
  authorName: string;
  sessionDate: string; // YYYY-MM-DD, the date of the logged conversation
  createdAt: number;
  read: boolean;
}

export async function notifyDietitianSession(input: Omit<AppNotification, "id" | "type" | "createdAt" | "read">) {
  await addDoc(collection(db, "notifications"), {
    ...input,
    type: "dietitianSession",
    createdAt: Date.now(),
    read: false,
  });
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function markAllNotificationsRead(ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, "notifications", id), { read: true }));
  await batch.commit();
}
