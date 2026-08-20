"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Group, getCurrentWeek, PROGRAM_WEEKS } from "@/lib/groups";
import { Client, Session, SessionKind, SESSION_LABELS } from "@/lib/clients";
import { isDietitianEmail, dietitianNameByEmail } from "@/lib/dietitians";

const KINDS: SessionKind[] = ["dietitianSessions", "coachSessions"];

export default function ClientPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const router = useRouter();
  const { user, loading } = useAuth();
  const isDietitian = isDietitianEmail(user?.email);

  const [client, setClient] = useState<Client | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [sessions, setSessions] = useState<Record<SessionKind, Session[]>>({
    dietitianSessions: [],
    coachSessions: [],
  });
  const [fetching, setFetching] = useState(true);
  const [composing, setComposing] = useState<SessionKind | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const fetchAll = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const cSnap = await getDoc(doc(db, "clients", clientId));
      if (!cSnap.exists()) {
        setClient(null);
        return;
      }
      const c = { id: cSnap.id, ...cSnap.data() } as Client;
      setClient(c);

      const gSnap = await getDoc(doc(db, "groups", c.groupId));
      setGroup(gSnap.exists() ? ({ id: gSnap.id, ...gSnap.data() } as Group) : null);

      const loaded = await Promise.all(
        KINDS.map(async (kind) => {
          const snap = await getDocs(collection(db, "clients", clientId, kind));
          return snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Session))
            .sort((a, b) => b.date.localeCompare(a.date));
        })
      );
      setSessions({ dietitianSessions: loaded[0], coachSessions: loaded[1] });
    } catch (err) {
      console.error("fetch client error:", err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (user) fetchAll();
  }, [user, clientId]);

  const openComposer = (kind: SessionKind) => {
    setComposing(kind);
    setDraftDate(new Date().toISOString().slice(0, 10));
    setDraftText("");
  };

  const saveSession = async () => {
    if (!composing || !draftText.trim()) return;
    setSaving(true);
    try {
      const authorName = dietitianNameByEmail(user?.email) ?? user?.displayName ?? null;
      const ref = await addDoc(collection(db, "clients", clientId, composing), {
        date: draftDate,
        text: draftText.trim(),
        createdAt: Date.now(),
        ...(authorName ? { authorName } : {}),
      });
      setComposing(null);
      setExpandedId(ref.id);
      await fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const deleteSession = async (kind: SessionKind, sessionId: string) => {
    if (!confirm("למחוק את הסיכום הזה?")) return;
    await deleteDoc(doc(db, "clients", clientId, kind, sessionId));
    setExpandedId((id) => (id === sessionId ? null : id));
    await fetchAll();
  };

  const startEditSession = (session: Session) => {
    setEditingId(session.id);
    setEditText(session.text);
  };

  const saveEditSession = async (kind: SessionKind, sessionId: string) => {
    if (!editText.trim()) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, "clients", clientId, kind, sessionId), {
        text: editText.trim(),
      });
      setEditingId(null);
      await fetchAll();
    } finally {
      setEditSaving(false);
    }
  };

  const deleteClient = async () => {
    if (!client) return;
    if (!confirm(`למחוק את הלקוח "${client.name}"?`)) return;
    await deleteDoc(doc(db, "clients", clientId));
    router.push(`/groups/${client.groupId}`);
  };

  if (loading || (user && fetching)) {
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

  if (!client) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4" dir="rtl">
        <p className="text-gray-400 text-lg">הלקוח לא נמצא</p>
        <Link href="/" className="text-indigo-600 font-semibold">חזרה לקבוצות</Link>
      </div>
    );
  }

  const week = group ? getCurrentWeek(group.startDate, group.program) : null;
  const total = group ? PROGRAM_WEEKS[group.program] : 0;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/groups/${client.groupId}`}
              className="text-gray-300 hover:text-gray-600 transition text-2xl leading-none shrink-0"
            >
              ›
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-gray-800 break-words">{client.name}</h1>
              <p className="text-sm text-gray-400 break-words">
                {group ? `${group.program} · ${group.name} · ` : ""}
                {week ? `שבוע ${week} מתוך ${total}` : "התוכנית הסתיימה"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {client.portalUrl && (
              <a
                href={client.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-sm whitespace-nowrap"
              >
                כרטיס לקוח ↗
              </a>
            )}
            {!isDietitian && (
              <button
                onClick={deleteClient}
                className="text-sm text-gray-400 hover:text-red-400 transition whitespace-nowrap"
              >
                מחק לקוח
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-4">
        {KINDS.map((kind) => (
          <section key={kind} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-800">{SESSION_LABELS[kind]}</h2>
              {(!isDietitian || kind === "dietitianSessions") && (
                <button
                  onClick={() => openComposer(kind)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition whitespace-nowrap shrink-0"
                >
                  + הוסף שיחה
                </button>
              )}
            </div>

            {composing === kind && (
              <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 mb-4 flex flex-col gap-3">
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-gray-800 bg-white w-fit"
                />
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={4}
                  placeholder="סיכום השיחה..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-gray-800 bg-white resize-y placeholder:text-gray-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveSession}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition disabled:opacity-50"
                  >
                    {saving ? "שומר..." : "שמור"}
                  </button>
                  <button
                    onClick={() => setComposing(null)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-5 py-2 rounded-lg text-sm transition"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            {sessions[kind].length === 0 ? (
              <p className="text-gray-300 text-sm py-4 text-center">אין עדיין שיחות מתועדות</p>
            ) : (
              <div className="flex flex-col gap-2">
                {sessions[kind].map((s, i) => {
                  const number = sessions[kind].length - i; // oldest session = 1
                  const isOpen = expandedId === s.id;
                  return (
                    <div key={s.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedId(isOpen ? null : s.id)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-right"
                      >
                        <span className="text-sm font-medium text-gray-700">
                          שיחה מספר {number}{s.authorName ? ` · ${s.authorName}` : ""}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">{s.date}</span>
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-3 pt-1 border-t border-gray-100">
                          {isDietitian ? (
                            <p className="text-gray-800 whitespace-pre-wrap pt-2">{s.text}</p>
                          ) : editingId === s.id ? (
                            <div className="flex flex-col gap-2 pt-2">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={4}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-gray-800 bg-white resize-y"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveEditSession(kind, s.id)}
                                  disabled={editSaving}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition disabled:opacity-50"
                                >
                                  {editSaving ? "שומר..." : "שמור"}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-5 py-2 rounded-lg text-sm transition"
                                >
                                  ביטול
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-end gap-3 mb-1">
                                <button
                                  onClick={() => startEditSession(s)}
                                  className="text-gray-300 hover:text-indigo-500 transition text-sm"
                                >
                                  עריכה
                                </button>
                                <button
                                  onClick={() => deleteSession(kind, s.id)}
                                  className="text-gray-300 hover:text-red-400 transition text-sm leading-none"
                                >
                                  ✕
                                </button>
                              </div>
                              <p className="text-gray-800 whitespace-pre-wrap">{s.text}</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
