import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type WhatsappCommandType = "send" | "open" | "close" | "closeGroup";
export type WhatsappCommandStatus = "pending" | "processing" | "done" | "error";

export interface WhatsappGroupOption {
  id: string; // WhatsApp JID
  name: string;
  participants: number;
}

export type WhatsappSessionStatus = "connecting" | "qr" | "connected" | "disconnected";

export interface WhatsappSession {
  status?: WhatsappSessionStatus;
  qr?: string;
  groups?: WhatsappGroupOption[];
}

export interface WhatsappCommand {
  id: string;
  uid: string;
  waGroupId: string;
  appGroupId?: string;
  type: WhatsappCommandType;
  text?: string;
  scheduledFor?: Timestamp;
  status: WhatsappCommandStatus;
  error?: string;
}

// Asks the local bridge service to open a WhatsApp connection for this coach
// (it'll respond by writing a QR code, then 'connected', to the same doc).
export async function requestWhatsappConnection(uid: string) {
  await setDoc(doc(db, "whatsappSessions", uid), { requestedAt: serverTimestamp() }, { merge: true });
}

interface QueueCommandInput {
  uid: string;
  waGroupId: string;
  appGroupId?: string;
  type: WhatsappCommandType;
  text?: string;
  scheduledFor?: Date;
}

// Writes a command doc; the local WhatsApp bridge service (running
// separately, listening on this collection) picks it up and executes it.
export async function queueWhatsappCommand({ uid, waGroupId, appGroupId, type, text, scheduledFor }: QueueCommandInput) {
  await addDoc(collection(db, "whatsappCommands"), {
    uid,
    waGroupId,
    ...(appGroupId ? { appGroupId } : {}),
    type,
    ...(text ? { text } : {}),
    ...(scheduledFor ? { scheduledFor: Timestamp.fromDate(scheduledFor) } : {}),
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function updateScheduledMessage(commandId: string, text: string, scheduledFor: Date | null) {
  await updateDoc(doc(db, "whatsappCommands", commandId), {
    text,
    ...(scheduledFor ? { scheduledFor: Timestamp.fromDate(scheduledFor) } : {}),
  });
}

export async function deleteScheduledMessage(commandId: string) {
  await deleteDoc(doc(db, "whatsappCommands", commandId));
}
