"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Group, isGroupActive, isGroupUpcoming, daysSinceProgramEnded } from "@/lib/groups";
import { WhatsappGroupOption, queueWhatsappCommand, uploadWhatsappAttachment } from "@/lib/whatsapp";

// One message per minute: slow enough that a mass send doesn't look like a
// burst to WhatsApp, which is the whole point of this screen.
const STEP_MS = 60_000;
const START_DELAY_MS = 10_000;

type Kind = "active" | "finished" | "unlinked";

interface Row {
  id: string; // WhatsApp JID
  name: string; // WhatsApp-side name
  participants: number;
  kind: Kind;
  appGroup?: Group;
  label: string;
  note: string;
}

const KIND_ORDER: Record<Kind, number> = { finished: 0, unlinked: 1, active: 2 };

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} דקות`;
  return m === 0 ? `${h} שעות` : `${h} שעות ו-${m} דקות`;
}

interface Props {
  uid: string;
  waGroups: WhatsappGroupOption[]; // every group the connected WhatsApp account is in
  onClose: () => void;
}

export default function BroadcastAllModal({ uid, waGroups, onClose }: Props) {
  const [appGroups, setAppGroups] = useState<Group[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [includeActive, setIncludeActive] = useState(false);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ count: number; lastAt: Date } | null>(null);

  // All of the coach's app groups, archived ones included: the page itself
  // hides archived groups, but those are exactly the ones this screen reaches.
  useEffect(() => {
    getDocs(query(collection(db, "groups"), where("userId", "==", uid)))
      .then((snap) => setAppGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group))))
      .catch((err) => setLoadError(err instanceof Error ? err.message : "שגיאה בטעינת הקבוצות"));
  }, [uid]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const rows = useMemo<Row[]>(() => {
    if (!appGroups) return [];
    const byWaId = new Map<string, Group[]>();
    for (const g of appGroups) {
      for (const link of g.whatsappGroups ?? []) {
        byWaId.set(link.id, [...(byWaId.get(link.id) ?? []), g]);
      }
    }
    return waGroups
      .map<Row>((wa) => {
        const linked = byWaId.get(wa.id) ?? [];
        // A cycle that is running or about to start must never be hit by an
        // "archive" broadcast, even if the same WhatsApp group is also linked
        // to an older cycle.
        const live = linked.find((g) => isGroupActive(g.startDate, g.program) || isGroupUpcoming(g.startDate));
        if (live) {
          return { id: wa.id, name: wa.name, participants: wa.participants, kind: "active", appGroup: live, label: `${live.program} · ${live.name}`, note: "פעילה" };
        }
        const g = linked[0];
        if (g) {
          const days = daysSinceProgramEnded(g.startDate, g.program);
          return {
            id: wa.id,
            name: wa.name,
            participants: wa.participants,
            kind: "finished",
            appGroup: g,
            label: `${g.program} · ${g.name}`,
            note: g.whatsappArchived ? "בארכיון" : days !== null ? `הסתיימה לפני ${days} ימים` : "הסתיימה",
          };
        }
        return { id: wa.id, name: wa.name, participants: wa.participants, kind: "unlinked", label: wa.name, note: "לא מקושרת לאפליקציה" };
      })
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.label.localeCompare(b.label, "he"));
  }, [appGroups, waGroups]);

  const counts = useMemo(
    () => ({
      finished: rows.filter((r) => r.kind === "finished").length,
      unlinked: rows.filter((r) => r.kind === "unlinked").length,
      active: rows.filter((r) => r.kind === "active").length,
    }),
    [rows]
  );

  const visibleRows = rows.filter(
    (r) => (includeActive || r.kind !== "active") && (!search.trim() || (r.label + " " + r.name).includes(search.trim()))
  );
  const targets = rows.filter((r) => (includeActive || r.kind !== "active") && !unchecked.has(r.id));

  const toggle = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const eligible = rows.filter((r) => includeActive || r.kind !== "active");
  const allChecked = eligible.length > 0 && targets.length === eligible.length;
  const toggleAll = () => setUnchecked(allChecked ? new Set(eligible.map((r) => r.id)) : new Set());

  const canSend = !sending && targets.length > 0 && (text.trim() !== "" || file !== null);

  const send = async () => {
    if (!canSend) return;
    const minutes = (targets.length - 1) * (STEP_MS / 60_000);
    if (
      !confirm(
        `לשלוח את ההודעה ל-${targets.length} קבוצות?\n\nהשליחה מדורגת: קבוצה אחת בדקה, סך הכל כ-${formatDuration(minutes)}. ` +
          `אפשר לעצור באמצע דרך "הודעות מתוזמנות".`
      )
    ) {
      return;
    }
    setSending(true);
    setError("");
    try {
      const attachment = file ? await uploadWhatsappAttachment(uid, file) : undefined;
      const start = Date.now() + START_DELAY_MS;
      for (let i = 0; i < targets.length; i += 20) {
        await Promise.all(
          targets.slice(i, i + 20).map((r, j) =>
            queueWhatsappCommand({
              uid,
              waGroupId: r.id,
              appGroupId: r.appGroup?.id,
              type: "send",
              text: text.trim() || undefined,
              attachment,
              scheduledFor: new Date(start + (i + j) * STEP_MS),
            })
          )
        );
      }
      setDone({ count: targets.length, lastAt: new Date(start + (targets.length - 1) * STEP_MS) });
      setText("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחה, נסה שוב");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 sm:p-8 max-h-[90vh] flex flex-col gap-4 overflow-y-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-black">!</span>
            הודעה לכל הקבוצות
          </h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 transition text-2xl leading-none">
            ✕
          </button>
        </div>

        {done ? (
          <div className="flex flex-col gap-4 py-4">
            <p className="text-gray-800">
              {done.count} הודעות הוכנסו לתור. הראשונה תישלח בעוד רגע, והאחרונה בסביבות{" "}
              {done.lastAt.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}.
            </p>
            <p className="text-sm text-gray-500">
              אפשר לעקוב ולעצור את השליחה דרך הכפתור &quot;הודעות מתוזמנות&quot; (שם יש &quot;בטל את כל ההודעות המתוזמנות&quot;).
            </p>
            <button onClick={onClose} className="self-start bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-5 py-2 text-sm transition">
              סגור
            </button>
          </div>
        ) : loadError ? (
          <p className="text-sm text-red-500">{loadError}</p>
        ) : appGroups === null ? (
          <p className="text-sm text-gray-400">טוען קבוצות...</p>
        ) : waGroups.length === 0 ? (
          <p className="text-sm text-gray-500">
            לא נמצאו קבוצות בחשבון הווטסאפ המחובר. אם זה לא צפוי, ייתכן ששירות הווטסאפ לא סנכרן את רשימת הקבוצות — הפעלה מחדש של השירות מרעננת אותה.
          </p>
        ) : (
          <>
            <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 leading-relaxed">
              ההודעה תישלח לכל קבוצות הווטסאפ בחשבון שאינן פעילות: {counts.finished} שהסתיימו או בארכיון, ו-{counts.unlinked} שלא מקושרות לאפליקציה.
              השליחה מדורגת, קבוצה אחת בדקה.
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-gray-600">
                  קבוצות ({targets.length} נבחרו מתוך {eligible.length})
                </label>
                <button type="button" onClick={toggleAll} className="text-xs font-semibold text-indigo-600 hover:underline">
                  {allChecked ? "בטל הכל" : "בחר הכל"}
                </button>
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש קבוצה..."
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50"
              />
              <div className="border border-gray-200 rounded-xl max-h-52 overflow-y-auto">
                {visibleRows.map((r) => {
                  const checked = !unchecked.has(r.id);
                  return (
                    <label
                      key={r.id}
                      className={`flex items-center gap-2 px-4 py-2 text-sm border-b last:border-b-0 border-gray-100 cursor-pointer transition ${
                        checked ? "bg-indigo-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggle(r.id)} className="shrink-0" />
                      <span className={`min-w-0 flex-1 truncate ${checked ? "text-indigo-800 font-medium" : "text-gray-700"}`}>{r.label}</span>
                      <span className={`text-xs shrink-0 ${r.kind === "unlinked" ? "text-amber-600" : r.kind === "active" ? "text-green-600" : "text-gray-400"}`}>
                        {r.note}
                      </span>
                    </label>
                  );
                })}
                {visibleRows.length === 0 && <p className="text-sm text-gray-400 text-center py-4">אין קבוצות להצגה</p>}
              </div>
              {counts.active > 0 && (
                <label className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                  <input type="checkbox" checked={includeActive} onChange={(e) => setIncludeActive(e.target.checked)} />
                  כלול גם קבוצות פעילות ({counts.active})
                </label>
              )}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="טקסט ההודעה (אם מצורפת תמונה, הטקסט ישמש ככיתוב)..."
              rows={4}
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300 resize-none"
            />

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-indigo-600 hover:underline cursor-pointer">
                {file ? "החלף תמונה" : "צרף תמונה"}
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
              </label>
              {file && (
                <span className="text-sm text-gray-500 flex items-center gap-2 min-w-0">
                  {previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                    ✕
                  </button>
                </span>
              )}
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button
              onClick={send}
              disabled={!canSend}
              className="self-start bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition disabled:opacity-50"
            >
              {sending ? "מכין את השליחה..." : `שלח ל-${targets.length} קבוצות (מדורג)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
