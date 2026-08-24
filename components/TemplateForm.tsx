"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { PROGRAMS, Program } from "@/lib/groups";
import { WhatsappAttachment, uploadWhatsappAttachment } from "@/lib/whatsapp";
import { MessageTemplate, WEEKDAY_LABELS, createMessageTemplate, updateMessageTemplate } from "@/lib/messageTemplates";

interface Props {
  editing?: MessageTemplate;
  onDone: () => void;
  onCancel?: () => void;
}

export default function TemplateForm({ editing, onDone, onCancel }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState(editing?.name ?? "");
  const [program, setProgram] = useState<Program>(editing?.program ?? "Start");
  const [weekOffset, setWeekOffset] = useState(editing?.weekOffset ?? 1);
  const [dayOfWeek, setDayOfWeek] = useState(editing?.dayOfWeek ?? 0);
  const [text, setText] = useState(editing?.text ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [attachment, setAttachment] = useState<WhatsappAttachment | undefined>(editing?.attachment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || (!text.trim() && !file && !attachment)) return;
    setSaving(true);
    setError("");
    try {
      const finalAttachment = file ? await uploadWhatsappAttachment(user.uid, file) : attachment;
      const input = {
        uid: user.uid,
        program,
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 border border-gray-200 rounded-xl p-4 bg-gray-50/50" dir="rtl">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
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
          <label className="text-sm font-medium text-gray-600">תוכנית</label>
          <select
            value={program}
            onChange={(e) => setProgram(e.target.value as Program)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {PROGRAMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
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
          disabled={saving}
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
