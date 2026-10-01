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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

// Opens a blank tab synchronously (must be called directly from a click
// handler, before any await — otherwise the browser treats the later
// window.open as a popup and blocks it) and points it at the file's
// download URL once resolved. Lets the coach preview a video before
// attaching or sending it.
export function previewStorageFile(path: string) {
  const tab = window.open("", "_blank");
  getDownloadURL(ref(storage, path))
    .then((url) => {
      if (tab) tab.location.href = url;
    })
    .catch(() => {
      tab?.close();
      alert("שגיאה בטעינת הקובץ לתצוגה מקדימה");
    });
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
export async function queueWhatsappCommand({ uid, waGroupId, appGroupId, type, text, attachment, scheduledFor }: QueueCommandInput): Promise<string> {
  const ref = await addDoc(collection(db, "whatsappCommands"), {
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
  return ref.id;
}

// Turns a phone number as typed by a person ("050-123-4567", "+972 50 123 4567",
// "972501234567") into the WhatsApp JID the bridge sends to. Israeli local
// numbers (leading 0) get the 972 country code; anything already carrying a
// country code is kept as-is. Returns null when it doesn't look like a real
// number so the UI can refuse instead of queueing a command that can't work.
export function phoneToJid(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "972" + digits.slice(1);
  if (digits.length < 10 || digits.length > 15) return null;
  return `${digits}@s.whatsapp.net`;
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
