"use client";

import { useMemo, useState } from "react";
import { Group } from "@/lib/groups";
import { WhatsappCommand, deleteScheduledMessage, deleteScheduledMessages, updateScheduledMessage } from "@/lib/whatsapp";

// Firestore Timestamp -> value for <input type="datetime-local"> in local time.
function toLocalInputValue(ts: WhatsappCommand["scheduledFor"]): string {
  if (!ts) return "";
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  messages: WhatsappCommand[]; // pending sends that have a scheduledFor, soonest first
  groups: Group[]; // for labelling which cycle a message is headed to
  waNames?: Record<string, string>; // WhatsApp JID -> group name, for groups the app doesn't list
  onClose: () => void;
}

interface Section {
  key: string;
  label: string;
  messages: WhatsappCommand[];
}

export default function ScheduledMessagesModal({ messages, groups, waNames, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editWhen, setEditWhen] = useState("");

  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const sections = useMemo<Section[]>(() => {
    const byKey = new Map<string, Section>();
    for (const m of messages) {
      const group = groups.find((g) => g.id === m.appGroupId);
      const key = m.appGroupId ?? m.waGroupId;
      const label = group
        ? `${group.program} · ${group.name}`
        : waNames?.[m.waGroupId] ?? "קבוצה שאינה ברשימה (ארכיון?)";
      const existing = byKey.get(key);
      if (existing) existing.messages.push(m);
      else byKey.set(key, { key, label, messages: [m] });
    }
    // Section holding the soonest message first.
    return Array.from(byKey.values()).sort(
      (a, b) => a.messages[0].scheduledFor!.toMillis() - b.messages[0].scheduledFor!.toMillis()
    );
  }, [messages, groups, waNames]);

  const waGroupName = (m: WhatsappCommand) =>
    groups.find((g) => g.id === m.appGroupId)?.whatsappGroups?.find((l) => l.id === m.waGroupId)?.name;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? "הפעולה נכשלה — ייתכן שהשירות כבר התחיל לשלוח את ההודעה. " + err.message
          : "הפעולה נכשלה, נסה שוב"
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelOne = (m: WhatsappCommand) => {
    if (!confirm("לבטל את התזמון של ההודעה הזו?")) return;
    run(() => deleteScheduledMessage(m.id));
  };

  const startEdit = (m: WhatsappCommand) => {
    setEditingId(m.id);
    setEditText(m.text ?? "");
    setEditWhen(toLocalInputValue(m.scheduledFor));
  };

  const saveEdit = (m: WhatsappCommand) => {
    if (!editWhen) return;
    if (!editText.trim() && !m.attachment) {
      setError("אי אפשר לשמור הודעה בלי טקסט וללא קובץ מצורף");
      return;
    }
    const when = new Date(editWhen);
    if (when.getTime() <= Date.now() && !confirm("השעה שבחרת כבר עברה, ההודעה תישלח מיד. להמשיך?")) return;
    run(async () => {
      await updateScheduledMessage(m.id, editText.trim(), when);
      setEditingId(null);
    });
  };

  const cancelSection = (s: Section) => {
    if (!confirm(`לבטל את כל ${s.messages.length} ההודעות המתוזמנות של "${s.label}"?`)) return;
    run(() => deleteScheduledMessages(s.messages.map((m) => m.id)));
  };

  const cancelAll = () => {
    if (!confirm(`לבטל את כל ${messages.length} ההודעות המתוזמנות, בכל הקבוצות?`)) return;
    run(() => deleteScheduledMessages(messages.map((m) => m.id)));
  };

  const now = Date.now();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 sm:p-8 max-h-[85vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            הודעות מתוזמנות <span className="text-gray-400 font-normal text-base">({messages.length})</span>
          </h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 transition text-2xl leading-none">
            ✕
          </button>
        </div>

        {messages.length > 1 && (
          <button
            onClick={cancelAll}
            disabled={busy}
            className="self-start text-sm font-semibold text-red-600 hover:underline disabled:opacity-50 mb-3"
          >
            בטל את כל ההודעות המתוזמנות ({messages.length})
          </button>
        )}

        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">אין הודעות מתוזמנות</p>
        ) : (
          <div className="overflow-y-auto flex flex-col gap-4 -mx-2 px-2">
            {sections.map((s) => {
              const isOpen = openKeys.has(s.key);
              return (
              // shrink-0: without it the flex column squashes every section
              // down to its header height once there are more than fit.
              <div key={s.key} className="border border-gray-100 rounded-xl overflow-hidden shrink-0">
                <div className="flex items-center justify-between gap-3 bg-gray-50 pl-4">
                  <button
                    onClick={() => toggle(s.key)}
                    className="flex-1 flex items-center gap-2 px-4 py-3 text-right hover:bg-gray-100 transition-colors"
                  >
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="text-sm font-bold text-gray-800">
                      {s.label} <span className="text-gray-400 font-normal">· {s.messages.length} הודעות</span>
                    </span>
                  </button>
                  <button
                    onClick={() => cancelSection(s)}
                    disabled={busy}
                    className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50 shrink-0"
                  >
                    בטל את כולן
                  </button>
                </div>
                {isOpen && <div className="flex flex-col">
                  {s.messages.map((m) => {
                    const overdue = m.scheduledFor!.toMillis() < now;
                    const wa = waGroupName(m);
                    if (editingId === m.id) {
                      return (
                        <div key={m.id} className="flex flex-col gap-2 px-4 py-3 border-t border-indigo-100 bg-indigo-50/40">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={3}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-none"
                          />
                          {m.attachment && (
                            <p className="text-xs text-indigo-500">קובץ מצורף: {m.attachment.name} (לא ניתן להחליף כאן)</p>
                          )}
                          <input
                            type="datetime-local"
                            value={editWhen}
                            onChange={(e) => setEditWhen(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white self-start"
                          />
                          <div className="flex gap-3">
                            <button
                              onClick={() => saveEdit(m)}
                              disabled={busy || !editWhen}
                              className="text-sm font-semibold text-indigo-600 hover:underline disabled:opacity-50"
                            >
                              שמור
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-sm text-gray-400 hover:underline"
                            >
                              ביטול
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={m.id}
                        className="flex items-start justify-between gap-3 px-4 py-3 border-t border-gray-100"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">
                            {m.scheduledFor!.toDate().toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                            {overdue && <span className="text-red-500 font-semibold"> · באיחור, עדיין לא נשלחה</span>}
                            {wa && ` · ${wa}`}
                          </p>
                          {m.text && (
                            <p className="text-sm text-gray-800 mt-0.5 break-words whitespace-pre-wrap line-clamp-3">{m.text}</p>
                          )}
                          {m.attachment && (
                            <p className="text-xs text-indigo-500 mt-0.5 truncate">קובץ מצורף: {m.attachment.name}</p>
                          )}
                        </div>
                        <div className="flex gap-3 shrink-0">
                          <button
                            onClick={() => startEdit(m)}
                            disabled={busy}
                            className="text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-50"
                          >
                            ערוך
                          </button>
                          <button
                            onClick={() => cancelOne(m)}
                            disabled={busy}
                            className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50"
                          >
                            בטל תזמון
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
