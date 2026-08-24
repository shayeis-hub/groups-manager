"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Group, PROGRAMS, Program } from "@/lib/groups";
import {
  MessageTemplate,
  WEEKDAY_LABELS,
  deleteMessageTemplate,
  applyTemplatesToGroup,
} from "@/lib/messageTemplates";
import TemplateForm from "@/components/TemplateForm";

export default function TemplatesPage() {
  const { user, loading } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [applyGroupId, setApplyGroupId] = useState("");
  const [applyTime, setApplyTime] = useState("09:00");
  const [applying, setApplying] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState("");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "messageTemplates"), where("uid", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setTemplates(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as MessageTemplate))
          .sort((a, b) => a.weekOffset - b.weekOffset || a.dayOfWeek - b.dayOfWeek)
      );
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "groups"), where("userId", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setGroups(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Group))
          .filter((g) => g.whatsappGroups && g.whatsappGroups.length > 0 && !g.whatsappArchived)
          .sort((a, b) => a.name.localeCompare(b.name, "he"))
      );
    });
  }, [user]);

  const grouped = PROGRAMS.reduce<Record<Program, MessageTemplate[]>>((acc, p) => {
    acc[p] = (templates ?? []).filter((t) => t.program === p);
    return acc;
  }, {} as Record<Program, MessageTemplate[]>);

  const applyGroup = groups.find((g) => g.id === applyGroupId);
  const matchingTemplates = applyGroup ? grouped[applyGroup.program] ?? [] : [];

  const runApply = async () => {
    if (!applyGroup || matchingTemplates.length === 0) return;
    const total = matchingTemplates.length * (applyGroup.whatsappGroups?.length ?? 0);
    if (
      !confirm(
        `לתזמן ${matchingTemplates.length} הודעות (${total} בפועל אם יש כמה קבוצות וואטסאפ מקושרות) לקבוצה "${applyGroup.name}", לפי תאריך ההתחלה שלה?`
      )
    ) {
      return;
    }
    setApplying(true);
    setApplyFeedback("");
    try {
      await applyTemplatesToGroup(applyGroup, matchingTemplates, applyTime);
      setApplyFeedback(`תוזמנו ${matchingTemplates.length} הודעות.`);
    } catch (err) {
      setApplyFeedback(err instanceof Error ? err.message : "שגיאה, נסה שוב");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <Link href="/" className="text-indigo-600 font-semibold">יש להתחבר תחילה</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/whatsapp" className="text-gray-300 hover:text-gray-600 transition text-2xl leading-none shrink-0">
            ›
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-gray-800">ספריית הודעות</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 sm:px-8 sm:py-5 flex flex-col gap-4" dir="rtl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">תזמון אוטומטי לקבוצה</h2>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-gray-400">אין עדיין קבוצות מקושרות לוואטסאפ.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-600">קבוצה</label>
                <select
                  value={applyGroupId}
                  onChange={(e) => setApplyGroupId(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">בחר קבוצה...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.program} · {g.name} · {g.startDate}</option>
                  ))}
                </select>
              </div>

              {applyGroup && (
                <p className="text-sm text-gray-500">
                  {matchingTemplates.length === 0
                    ? `אין הודעות בספרייה עבור תוכנית ${applyGroup.program}`
                    : `נמצאו ${matchingTemplates.length} הודעות עבור תוכנית ${applyGroup.program}, יתוזמנו לפי תאריך ההתחלה ${applyGroup.startDate}`}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-gray-500 flex items-center gap-2">
                  שעת שליחה:
                  <input
                    type="time"
                    value={applyTime}
                    onChange={(e) => setApplyTime(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-gray-50"
                  />
                </label>
                <button
                  onClick={runApply}
                  disabled={applying || !applyGroupId || matchingTemplates.length === 0}
                  className="mr-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-5 py-2 text-sm transition disabled:opacity-50"
                >
                  {applying ? "מתזמן..." : "תזמן הכל"}
                </button>
              </div>

              {applyFeedback && <p className="text-sm text-gray-500">{applyFeedback}</p>}
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 sm:px-8 sm:py-5 flex flex-col gap-4" dir="rtl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">הודעות בספרייה</h2>
            <button onClick={() => setShowAdd((s) => !s)} className="text-sm font-semibold text-indigo-600 hover:underline">
              {showAdd ? "ביטול" : "+ הוסף הודעה"}
            </button>
          </div>

          {showAdd && (
            <TemplateForm
              onDone={() => setShowAdd(false)}
              onCancel={() => setShowAdd(false)}
            />
          )}

          {templates === null ? (
            <p className="text-sm text-gray-400">טוען...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-gray-400">אין עדיין הודעות בספרייה</p>
          ) : (
            <div className="flex flex-col gap-5">
              {PROGRAMS.filter((p) => grouped[p].length > 0).map((program) => (
                <div key={program} className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold text-gray-500">{program}</h3>
                  {grouped[program].map((t) =>
                    editingId === t.id ? (
                      <TemplateForm
                        key={t.id}
                        editing={t}
                        onDone={() => setEditingId(null)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <div key={t.id} className="border border-gray-100 rounded-xl p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            שבוע {t.weekOffset} · יום {WEEKDAY_LABELS[t.dayOfWeek]}
                            {t.attachment && ` · קובץ: ${t.attachment.name}`}
                          </p>
                          {t.text && <p className="text-sm text-gray-600 mt-1 break-words whitespace-pre-wrap">{t.text}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setEditingId(t.id)} className="text-xs font-semibold text-indigo-600 hover:underline">ערוך</button>
                          <button onClick={() => deleteMessageTemplate(t.id)} className="text-xs font-semibold text-red-500 hover:underline">מחק</button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
