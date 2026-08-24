import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Program, Group, getDateForWeek } from "@/lib/groups";
import { WhatsappAttachment, queueWhatsappCommand } from "@/lib/whatsapp";

export const WEEKDAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// A named, reusable batch of templates for one program — e.g. "קיץ - Start"
// vs "חורף - Start". Kept as its own collection (not a free-text tag on each
// template) so renaming/reusing it can't silently fragment into near-
// duplicate spellings.
export interface TemplateSet {
  id: string;
  uid: string;
  name: string;
  program: Program;
  createdAt: number;
}

export async function createTemplateSet(uid: string, name: string, program: Program): Promise<string> {
  const ref = await addDoc(collection(db, "templateSets"), { uid, name: name.trim(), program, createdAt: Date.now() });
  return ref.id;
}

// Deletes the set only if nothing references it — a cascade delete of its
// templates would be a much bigger surprise than a blocked click.
export async function deleteTemplateSet(id: string, templateCount: number) {
  if (templateCount > 0) {
    throw new Error(`אי אפשר למחוק קבוצת שליחה עם ${templateCount} הודעות בה — מחק קודם את ההודעות`);
  }
  await deleteDoc(doc(db, "templateSets", id));
}

export interface MessageTemplate {
  id: string;
  uid: string;
  setId: string;
  name: string;
  weekOffset: number; // 1-based program week
  dayOfWeek: number; // 0=Sunday..6=Saturday
  text: string;
  attachment?: WhatsappAttachment;
  createdAt: number;
}

interface SaveTemplateInput {
  uid: string;
  setId: string;
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
//
// Templates whose computed date already passed are skipped rather than
// queued: a command with a past scheduledFor is picked up as immediately
// due by the bridge's sweep, so applying a set to a group that's already a
// few weeks in would otherwise blast out every "missed" week's messages at
// once instead of just the ones still ahead.
export async function applyTemplatesToGroup(
  group: Group,
  templates: MessageTemplate[],
  timeOfDay: string // "HH:MM"
): Promise<{ scheduled: number; skipped: number }> {
  const [hours, minutes] = timeOfDay.split(":").map(Number);
  const links = group.whatsappGroups ?? [];
  const now = new Date();

  const upcoming = templates.filter((t) => {
    const scheduledFor = getDateForWeek(group.startDate, t.weekOffset, t.dayOfWeek);
    scheduledFor.setHours(hours, minutes, 0, 0);
    return scheduledFor > now;
  });

  await Promise.all(
    upcoming.flatMap((t) => {
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

  return { scheduled: upcoming.length, skipped: templates.length - upcoming.length };
}
