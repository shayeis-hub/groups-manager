"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { PROGRAMS, Program } from "@/lib/groups";
import { WhatsappAttachment, uploadWhatsappAttachment } from "@/lib/whatsapp";
import {
  MessageTemplate,
  TemplateSet,
  WEEKDAY_LABELS,
  createTemplateSet,
  createMessageTemplate,
  updateMessageTemplate,
} from "@/lib/messageTemplates";

const NEW_SET_VALUE = "__new__";

interface Props {
  editing?: MessageTemplate;
  defaultSetId?: string;
  onDone: () => void;
  onCancel?: () => void;
}

export default function TemplateForm({ editing, defaultSetId, onDone, onCancel }: Props) {
  const { user } = useAuth();
  const [sets, setSets] = useState<TemplateSet[] | null>(null);
  const [setId, setSetId] = useState(editing?.setId ?? defaultSetId ?? "");
  const [newSetName, setNewSetName] = useState("");
  const [newSetProgram, setNewSetProgram] = useState<Program>("Start");

  const [name, setName] = useState(editing?.name ?? "");
  const [weekOffset, setWeekOffset] = useState(editing?.weekOffset ?? 1);
  const [dayOfWeek, setDayOfWeek] = useState(editing?.dayOfWeek ?? 0);
  const [text, setText] = useState(editing?.text ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [attachment, setAttachment] = useState<WhatsappAttachment | undefined>(editing?.attachment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Shared across every coach — not scoped by uid, on purpose.
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "templateSets"), (snap) => {
      setSets(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as TemplateSet))
          .sort((a, b) => a.name.localeCompare(b.name, "he"))
      );
    });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !setId || setId === NEW_SET_VALUE) return;
    if (!text.trim() && !file && !attachment) return;
    setSaving(true);
    setError("");
    try {
      const finalAttachment = file ? await uploadWhatsappAttachment(user.uid, file) : attachment;
      const input = {
        uid: user.uid,
        setId,
        name: name.trim(),
        weekOffset,
        dayOfWeek,
        text: text.trim(),
        attachment: finalAttachment,
      };
      if (editing) {
        await updateMessageTemplate(editing.id, input);
      } else {
        await createMessageTemplate(input);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה, נסה שוב");
    } finally {
      setSaving(false);
    }
  };

  const createSetInline = async () => {
    if (!user || !newSetName.trim()) return;
    const id = await createTemplateSet(user.uid, newSetName.trim(), newSetProgram);
    setSetId(id);
    setNewSetName("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 border border-gray-200 rounded-xl p-4 bg-gray-50/50" dir="rtl">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-600">קבוצת שליחה</label>
        <select
          value={setId}
          onChange={(e) => setSetId(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">בחר קבוצת שליחה...</option>
          {sets?.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.program})</option>
          ))}
          <option value={NEW_SET_VALUE}>+ קבוצת שליחה חדשה...</option>
        </select>

        {setId === NEW_SET_VALUE && (
          <div className="flex flex-wrap items-end gap-2 mt-1 p-3 border border-indigo-200 rounded-xl bg-indigo-50/40">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">שם</label>
              <input
                type="text"
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                placeholder='לדוגמה: קיץ - Start'
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">תוכנית</label>
              <select
                value={newSetProgram}
                onChange={(e) => setNewSetProgram(e.target.value as Program)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
              >
                {PROGRAMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={createSetInline}
              disabled={!newSetName.trim()}
              className="text-sm font-semibold text-indigo-600 hover:underline disabled:opacity-40"
            >
              צור
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5 col-span-1">
          <label className="text-sm font-medium text-gray-600">שם ההודעה</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='לדוגמה: פתיחה שבוע 1'
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-600">שבוע בתוכנית</label>
          <input
            type="number"
            min={1}
            value={weekOffset}
            onChange={(e) => setWeekOffset(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-600">יום בשבוע</label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={i} value={i}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="טקסט ההודעה..."
        rows={3}
        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
      />

      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-indigo-600 hover:underline cursor-pointer">
          {file || attachment ? "החלף קובץ" : "צרף קובץ"}
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
        </label>
        {(file || attachment) && (
          <span className="text-sm text-gray-500 flex items-center gap-2 min-w-0">
            <span className="truncate">{file?.name ?? attachment?.name}</span>
            <button
              type="button"
              onClick={() => { setFile(null); setAttachment(undefined); }}
              className="text-gray-400 hover:text-gray-600 shrink-0"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !setId || setId === NEW_SET_VALUE}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-5 py-2 text-sm transition disabled:opacity-50"
        >
          {saving ? "שומר..." : editing ? "שמור שינויים" : "הוסף להודעה"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-gray-400 hover:underline">
            ביטול
          </button>
        )}
      </div>
    </form>
  );
}
