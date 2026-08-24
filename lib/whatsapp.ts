import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type WhatsappCommandType = "send" | "open" | "close";

interface QueueCommandInput {
  waGroupId: string;
  type: WhatsappCommandType;
  text?: string;
  scheduledFor?: Date;
  createdBy: string;
}

// Writes a command doc; the local WhatsApp bridge service (running
// separately, listening on this collection) picks it up and executes it.
export async function queueWhatsappCommand({ waGroupId, type, text, scheduledFor, createdBy }: QueueCommandInput) {
  await addDoc(collection(db, "whatsappCommands"), {
    waGroupId,
    type,
    ...(text ? { text } : {}),
    ...(scheduledFor ? { scheduledFor: Timestamp.fromDate(scheduledFor) } : {}),
    status: "pending",
    createdBy,
    createdAt: serverTimestamp(),
  });
}
