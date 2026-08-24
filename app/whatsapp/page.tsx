"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Group, getCurrentWeek, PROGRAM_WEEKS } from "@/lib/groups";
import { WhatsappSession, requestWhatsappConnection, queueWhatsappCommand, uploadWhatsappAttachment } from "@/lib/whatsapp";
import WhatsappConnectCard from "@/components/WhatsappConnectCard";

const OPEN_STATE_LABEL: Record<string, string> = {
  open: "כל הקבוצות פתוחות לכתיבה",
  closed: "כל הקבוצות סגורות (רק אדמינים)",
  mixed: "חלק פתוחות, חלק סגורות",
  none: "אין עדיין קבוצות מקושרות",
};

export default function WhatsappManagementPage() {
  const { user, loading } = useAuth();
  const [session, setSession] = useState<WhatsappSession | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [fetchingGroups, setFetchingGroups] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [bulkBusy, setBulkBusy] = useState<"open" | "close" | null>(null);
  const [closeGroupId, setCloseGroupId] = useState("");
  const [closeText, setCloseText] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeFeedback, setCloseFeedback] = useState("");

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "whatsappSessions", user.uid), (snap) => setSession(snap.data() ?? {}));
  }, [user]);

  const fetchGroups = async () => {
    if (!user) return;
    setFetchingGroups(true);
    try {
      const snap = await getDocs(query(collection(db, "groups"), where("userId", "==", user.uid)));
      setGroups(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Group))
          .filter((g) => g.whatsappGroups && g.whatsappGroups.length > 0 && !g.whatsappArchived)
          .sort((a, b) => a.name.localeCompare(b.name, "he"))
      );
    } finally {
      setFetchingGroups(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openState = useMemo(() => {
    if (groups.length === 0) return "none";
    const states = groups.map((g) => g.whatsappOpen);
    if (states.every((s) => s === true)) return "open";
    if (states.every((s) => s === false)) return "closed";
    return "mixed";
  }, [groups]);

  const runBulk = async (type: "open" | "close") => {
    if (!user || groups.length === 0) return;
    setBulkBusy(type);
    try {
      await Promise.all(
        groups.flatMap((g) =>
          (g.whatsappGroups ?? []).map((link) =>
            queueWhatsappCommand({ uid: user.uid, waGroupId: link.id, appGroupId: g.id, type })
          )
        )
      );
    } finally {
      setBulkBusy(null);
    }
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  // Newest cycle (lowest current week) first; inactive groups (no current
  // week) sort last.
  const composerGroups = [...groups].sort(
    (a, b) =>
      (getCurrentWeek(a.startDate, a.program) ?? Infinity) - (getCurrentWeek(b.startDate, b.program) ?? Infinity)
  );

  const sendMessage = async () => {
    if (!user || !selectedGroup || (!text.trim() && !file)) return;
    setSending(true);
    setFeedback("");
    try {
      const attachment = file ? await uploadWhatsappAttachment(user.uid, file) : undefined;
      await Promise.all(
        (selectedGroup.whatsappGroups ?? []).map((link) =>
          queueWhatsappCommand({
            uid: user.uid,
            waGroupId: link.id,
            appGroupId: selectedGroup.id,
            type: "send",
            text: text.trim() || undefined,
            attachment,
            scheduledFor: scheduledAt ? new Date(scheduledAt) : undefined,
          })
        )
      );
      setFeedback(scheduledAt ? "ההודעה תוזמנה." : "ההודעה נשלחה לתור.");
      setText("");
      setFile(null);
      setScheduledAt("");
      setSelectedGroupId("");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "שגיאה בשליחה, נסה שוב");
    } finally {
      setSending(false);
    }
  };

  const closeTargetGroup = groups.find((g) => g.id === closeGroupId);

  const runCloseGroup = async () => {
    if (!user || !closeTargetGroup) return;
    const links = closeTargetGroup.whatsappGroups ?? [];
    const sendStep = closeText.trim() ? "לשלוח את הודעת הסגירה, " : "";
    const groupsNote = links.length > 1 ? ` (${links.length} קבוצות וואטסאפ מקושרות)` : "";
    if (
      !confirm(
        `לנעול את "${closeTargetGroup.name}"${groupsNote} לכתיבת אדמינים בלבד, ${sendStep}ולהעביר לארכיון?\n\nזו פעולה שאי אפשר לבטל אוטומטית מתוך האפליקציה.`
      )
    ) {
      return;
    }
    setClosing(true);
    setCloseFeedback("");
    try {
      await Promise.all(
        (closeTargetGroup.whatsappGroups ?? []).map((link) =>
          queueWhatsappCommand({
            uid: user.uid,
            waGroupId: link.id,
            appGroupId: closeTargetGroup.id,
            type: "closeGroup",
            text: closeText.trim() || undefined,
          })
        )
      );
      setCloseFeedback("נוהל הסגירה נשלח לביצוע.");
      setCloseText("");
      setCloseGroupId("");
    } catch (err) {
      setCloseFeedback(err instanceof Error ? err.message : "שגיאה, נסה שוב");
    } finally {
      setClosing(false);
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
          <Link href="/" className="text-gray-300 hover:text-gray-600 transition text-2xl leading-none shrink-0">
            ›
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-gray-800">ניהול וואטסאפ</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
        <WhatsappConnectCard session={session} onConnect={() => requestWhatsappConnection(user.uid)} />

        <Link
          href="/whatsapp/templates"
          className="block text-center bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 font-semibold px-6 py-3 rounded-xl transition shadow-sm"
        >
          ספריית הודעות
        </Link>

        {session?.status === "connected" && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 sm:px-8 sm:py-5 flex flex-col gap-3" dir="rtl">
              <h2 className="text-lg font-bold text-gray-800">כל הקבוצות</h2>
              <p className="text-sm text-gray-400">{OPEN_STATE_LABEL[openState]}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => runBulk("open")}
                  disabled={bulkBusy !== null || groups.length === 0}
                  className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-50"
                >
                  {bulkBusy === "open" ? "פותח..." : "פתח את כל הקבוצות"}
                </button>
                <button
                  onClick={() => runBulk("close")}
                  disabled={bulkBusy !== null || groups.length === 0}
                  className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-50"
                >
                  {bulkBusy === "close" ? "סוגר..." : "סגור את כל הקבוצות"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 sm:px-8 sm:py-5 flex flex-col gap-4" dir="rtl">
              <h2 className="text-lg font-bold text-gray-800">שליחת הודעה</h2>

              {fetchingGroups ? (
                <p className="text-sm text-gray-400">טוען קבוצות...</p>
              ) : groups.length === 0 ? (
                <p className="text-sm text-gray-400">
                  אין עדיין קבוצות מקושרות לוואטסאפ. ניתן לקשר קבוצה דרך עריכת קבוצה בעמוד הראשי.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-600">קבוצה</label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                    >
                      <option value="">בחר קבוצה...</option>
                      {composerGroups.map((g) => {
                        const week = getCurrentWeek(g.startDate, g.program);
                        const total = PROGRAM_WEEKS[g.program];
                        return (
                          <option key={g.id} value={g.id}>
                            {g.program} · {g.name} · {week ? `שבוע ${week}/${total}` : "לא פעיל"}
                            {(g.whatsappGroups?.length ?? 0) > 1 ? ` (${g.whatsappGroups!.length} קבוצות)` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="טקסט ההודעה..."
                    rows={4}
                    className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300 resize-none"
                  />

                  <div className="flex items-center gap-3">
                    <label className="text-sm font-semibold text-indigo-600 hover:underline cursor-pointer">
                      {file ? "החלף קובץ" : "צרף קובץ"}
                      <input
                        type="file"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                    </label>
                    {file && (
                      <span className="text-sm text-gray-500 flex items-center gap-2 min-w-0">
                        <span className="truncate">{file.name}</span>
                        <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                          ✕
                        </button>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm text-gray-500 flex items-center gap-2">
                      תזמון (אופציונלי):
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-gray-50"
                      />
                    </label>
                    <button
                      onClick={sendMessage}
                      disabled={sending || !selectedGroupId || (!text.trim() && !file)}
                      className="mr-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-5 py-2 text-sm transition disabled:opacity-50"
                    >
                      {sending ? "שולח..." : scheduledAt ? "תזמן שליחה" : "שלח עכשיו"}
                    </button>
                  </div>

                  {feedback && <p className="text-sm text-gray-500">{feedback}</p>}
                </>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 sm:px-8 sm:py-5 flex flex-col gap-4" dir="rtl">
              <div>
                <h2 className="text-lg font-bold text-gray-800">סגירת קבוצה</h2>
                <p className="text-sm text-gray-400 mt-1">
                  נוהל סיום מחזור: נועל את הקבוצה לכתיבת אדמינים בלבד ומעביר לארכיון (עם הודעת סגירה אופציונלית).
                </p>
              </div>

              {groups.length === 0 ? (
                <p className="text-sm text-gray-400">אין קבוצות פעילות מקושרות לסגור.</p>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-600">קבוצה לסגירה</label>
                    <select
                      value={closeGroupId}
                      onChange={(e) => setCloseGroupId(e.target.value)}
                      className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                    >
                      <option value="">בחר קבוצה...</option>
                      {groups.map((g) => {
                        const week = getCurrentWeek(g.startDate, g.program);
                        const total = PROGRAM_WEEKS[g.program];
                        return (
                          <option key={g.id} value={g.id}>
                            {g.program} · {g.name} · {week ? `שבוע ${week}/${total}` : "לא פעיל"}
                            {(g.whatsappGroups?.length ?? 0) > 1 ? ` (${g.whatsappGroups!.length} קבוצות)` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <textarea
                    value={closeText}
                    onChange={(e) => setCloseText(e.target.value)}
                    placeholder="טקסט הודעת הסגירה... (אופציונלי)"
                    rows={4}
                    className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300 resize-none"
                  />

                  <button
                    onClick={runCloseGroup}
                    disabled={closing || !closeGroupId}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition disabled:opacity-50 self-start"
                  >
                    {closing ? "מבצע..." : "בצע נוהל סגירה"}
                  </button>

                  {closeFeedback && <p className="text-sm text-gray-500">{closeFeedback}</p>}
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
