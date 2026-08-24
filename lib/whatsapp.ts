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
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

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

export interface WhatsappAttachment {
  path: string; // Storage path
  name: string; // original filename
  type: string; // mimetype
}

export interface WhatsappCommand {
  id: string;
  uid: string;
  waGroupId: string;
  appGroupId?: string;
  type: WhatsappCommandType;
  text?: string;
  attachment?: WhatsappAttachment;
  scheduledFor?: Timestamp;
  status: WhatsappCommandStatus;
  error?: string;
}

// Asks the local bridge service to open a WhatsApp connection for this coach
// (it'll respond by writing a QR code, then 'connected', to the same doc).
export async function requestWhatsappConnection(uid: string) {
  await setDoc(doc(db, "whatsappSessions", uid), { requestedAt: serverTimestamp() }, { merge: true });
}

// Uploads a file the coach picked in the composer; the bridge service
// downloads it from this path when it executes the command.
export async function uploadWhatsappAttachment(uid: string, file: File): Promise<WhatsappAttachment> {
  const path = `whatsapp-attachments/${uid}/${Date.now()}-${file.name}`;
  await uploadBytes(ref(storage, path), file);
  return { path, name: file.name, type: file.type || "application/octet-stream" };
}

interface QueueCommandInput {
  uid: string;
  waGroupId: string;
  appGroupId?: string;
  type: WhatsappCommandType;
  text?: string;
  attachment?: WhatsappAttachment;
  scheduledFor?: Date;
}

// Writes a command doc; the local WhatsApp bridge service (running
// separately, listening on this collection) picks it up and executes it.
export async function queueWhatsappCommand({ uid, waGroupId, appGroupId, type, text, attachment, scheduledFor }: QueueCommandInput) {
  await addDoc(collection(db, "whatsappCommands"), {
    uid,
    waGroupId,
    ...(appGroupId ? { appGroupId } : {}),
    type,
    ...(text ? { text } : {}),
    ...(attachment ? { attachment } : {}),
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

// Deliberately doesn't delete the Storage file even if the command carried
// an attachment: when a group is linked to more than one WhatsApp group, the
// same attachment path is shared across one command doc per link, so this
// row's deletion doesn't mean no sibling command still needs that file.
export async function deleteScheduledMessage(commandId: string) {
  await deleteDoc(doc(db, "whatsappCommands", commandId));
}
