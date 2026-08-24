import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Program, Group, getDateForWeek } from "@/lib/groups";
import { WhatsappAttachment, queueWhatsappCommand } from "@/lib/whatsapp";

export const WEEKDAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export interface MessageTemplate {
  id: string;
  uid: string;
  program: Program;
  name: string;
  weekOffset: number; // 1-based program week
  dayOfWeek: number; // 0=Sunday..6=Saturday
  text: string;
  attachment?: WhatsappAttachment;
  createdAt: number;
}

interface SaveTemplateInput {
  uid: string;
  program: Program;
  name: string;
  weekOffset: number;
  dayOfWeek: number;
  text: string;
  attachment?: WhatsappAttachment;
}

export async function createMessageTemplate(input: SaveTemplateInput) {
  await addDoc(collection(db, "messageTemplates"), { ...input, createdAt: Date.now() });
}

export async function updateMessageTemplate(id: string, input: SaveTemplateInput) {
  await updateDoc(doc(db, "messageTemplates", id), { ...input });
}

export async function deleteMessageTemplate(id: string) {
  await deleteDoc(doc(db, "messageTemplates", id));
}

// Schedules one 'send' command per (matching template × linked WhatsApp
// group) — reuses the same queue the composer uses, so the results show up
// in ScheduledMessagesPanel like any other scheduled message.
export async function applyTemplatesToGroup(
  group: Group,
  templates: MessageTemplate[],
  timeOfDay: string // "HH:MM"
) {
  const [hours, minutes] = timeOfDay.split(":").map(Number);
  const links = group.whatsappGroups ?? [];

  await Promise.all(
    templates.flatMap((t) => {
      const scheduledFor = getDateForWeek(group.startDate, t.weekOffset, t.dayOfWeek);
      scheduledFor.setHours(hours, minutes, 0, 0);
      return links.map((link) =>
        queueWhatsappCommand({
          uid: group.userId,
          waGroupId: link.id,
          appGroupId: group.id,
          type: "send",
          text: t.text,
          attachment: t.attachment,
          scheduledFor,
        })
      );
    })
  );
}
