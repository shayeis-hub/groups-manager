"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Group } from "@/lib/groups";
import { WhatsappCommand, updateScheduledMessage, deleteScheduledMessage } from "@/lib/whatsapp";

interface Props {
  group: Group;
}

function toLocalInputValue(ts: WhatsappCommand["scheduledFor"]) {
  if (!ts) return "";
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScheduledMessagesPanel({ group }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<WhatsappCommand[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editWhen, setEditWhen] = useState("");
  const [error, setError] = useState("");

  const waGroupIds = (group.whatsappGroups ?? []).map((l) => l.id);
  const waGroupIdsKey = waGroupIds.join(",");

  useEffect(() => {
    if (!open || waGroupIds.length === 0) return;
    const q = query(
      collection(db, "whatsappCommands"),
      // Firestore rules restrict reads to `uid == request.auth.uid`, which
      // it can only verify statically if the query itself filters on that
      // same field — otherwise the whole query is denied, not just filtered.
      where("uid", "==", group.userId),
      where("waGroupId", "in", waGroupIds),
      where("type", "==", "send"),
      where("status", "==", "pending")
    );
    setError("");
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as WhatsappCommand))
          .filter((m) => m.scheduledFor)
          .sort((a, b) => (a.scheduledFor!.toMillis() - b.scheduledFor!.toMillis()));
        setMessages(list);
      },
      (err) => setError(err.message)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, waGroupIdsKey, group.userId]);

  if (waGroupIds.length === 0) return null;

  const waGroupName = (id: string) => group.whatsappGroups?.find((l) => l.id === id)?.name;

  const startEdit = (m: WhatsappCommand) => {
    setEditingId(m.id);
    setEditText(m.text ?? "");
    setEditWhen(toLocalInputValue(m.scheduledFor));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateScheduledMessage(editingId, editText.trim(), editWhen ? new Date(editWhen) : null);
    setEditingId(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100" dir="rtl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5 text-lg font-bold text-gray-800"
      >
        הודעות מתוזמנות
        <span className="text-gray-300 text-xl leading-none">{open ? "︿" : "﹀"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 sm:px-8 sm:pb-6 flex flex-col gap-3">
          {error ? (
            <p className="text-sm text-red-500">שגיאה בטעינה: {error}</p>
          ) : messages === null ? (
            <p className="text-sm text-gray-400">טוען...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-400">אין הודעות מתוזמנות לקבוצה זו</p>
          ) : (
            messages.map((m) =>
              editingId === m.id ? (
                <div key={m.id} className="border border-indigo-200 rounded-xl p-3 flex flex-col gap-2 bg-indigo-50/30">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-none"
                  />
                  <input
                    type="datetime-local"
                    value={editWhen}
                    onChange={(e) => setEditWhen(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white self-start"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="text-sm font-semibold text-indigo-600 hover:underline">שמור</button>
                    <button onClick={() => setEditingId(null)} className="text-sm text-gray-400 hover:underline">ביטול</button>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="border border-gray-100 rounded-xl p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">{m.text}</p>
                    {m.attachment && (
                      <p className="text-xs text-indigo-500 mt-1">קובץ מצורף: {m.attachment.name}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {m.scheduledFor?.toDate().toLocaleString("he-IL")}
                      {waGroupIds.length > 1 && ` · ${waGroupName(m.waGroupId) ?? m.waGroupId}`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => startEdit(m)} className="text-xs font-semibold text-indigo-600 hover:underline">ערוך</button>
                    <button onClick={() => deleteScheduledMessage(m.id)} className="text-xs font-semibold text-red-500 hover:underline">מחק</button>
                  </div>
                </div>
              )
            )
          )}
        </div>
      )}
    </div>
  );
}
