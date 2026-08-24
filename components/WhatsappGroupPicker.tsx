"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { WhatsappGroupOption } from "@/lib/whatsapp";

interface Props {
  uid: string;
  value: string; // waGroupId
  excludeGroupId?: string; // this app group's own id, so it doesn't conflict with its own existing link
  onChange: (waGroupId: string, waGroupName: string) => void;
}

export default function WhatsappGroupPicker({ uid, value, excludeGroupId, onChange }: Props) {
  const [groups, setGroups] = useState<WhatsappGroupOption[] | null>(null);
  const [manual, setManual] = useState(false);
  const [filter, setFilter] = useState("");
  // waGroupId -> name of the app group it's already linked to
  const [taken, setTaken] = useState<Map<string, string>>(new Map());
  const [conflictMsg, setConflictMsg] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "whatsappSessions", uid), (snap) => {
      setGroups(snap.data()?.groups ?? []);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    const q = query(collection(db, "groups"), where("whatsappGroupId", "!=", ""));
    const unsub = onSnapshot(q, (snap) => {
      const map = new Map<string, string>();
      snap.docs.forEach((d) => {
        if (d.id === excludeGroupId) return;
        map.set(d.data().whatsappGroupId, d.data().name);
      });
      setTaken(map);
    });
    return unsub;
  }, [excludeGroupId]);

  const selected = groups?.find((g) => g.id === value);
  const filtered = groups?.filter((g) => g.name.includes(filter.trim())) ?? [];

  const trySelect = (waGroupId: string, waGroupName: string) => {
    const conflictWith = taken.get(waGroupId);
    if (conflictWith) {
      setConflictMsg(`קבוצת וואטסאפ זו כבר מקושרת ל-"${conflictWith}" — כל קבוצת וואטסאפ יכולה להיות מקושרת לקבוצה אחת בלבד באפליקציה.`);
      return;
    }
    setConflictMsg("");
    onChange(waGroupId, waGroupName);
  };

  if (manual || (groups !== null && groups.length === 0)) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-600">מזהה קבוצת וואטסאפ</label>
          {groups && groups.length > 0 && (
            <button type="button" onClick={() => setManual(false)} className="text-xs text-indigo-600 hover:underline">
              בחר מרשימה
            </button>
          )}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => trySelect(e.target.value.trim(), "")}
          placeholder="לדוגמה: 120363...@g.us"
          dir="ltr"
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300 text-left"
        />
        {conflictMsg && <p className="text-xs text-red-500">{conflictMsg}</p>}
        {groups !== null && groups.length === 0 && (
          <p className="text-xs text-gray-400">
            לא נמצאו קבוצות וואטסאפ מחוברות. אפשר להתחבר דרך &quot;ניהול וואטסאפ&quot; ואז לבחור מרשימה, או להדביק מזהה ידנית.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-600">קבוצת וואטסאפ</label>
        <button type="button" onClick={() => setManual(true)} className="text-xs text-indigo-600 hover:underline">
          הזנה ידנית
        </button>
      </div>

      {selected && (
        <div className="flex items-center justify-between gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-sm">
          <span className="text-indigo-800 font-medium break-words">{selected.name}</span>
          <button
            type="button"
            onClick={() => onChange("", "")}
            className="text-indigo-400 hover:text-indigo-700 shrink-0"
          >
            הסר
          </button>
        </div>
      )}

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="חפש קבוצה לפי שם... (יש הרבה קבוצות דומות — בדוק היטב לפני בחירה)"
        className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300"
      />

      {conflictMsg && <p className="text-xs text-red-500">{conflictMsg}</p>}

      <div className="border border-gray-200 rounded-xl max-h-56 overflow-y-auto">
        {groups === null ? (
          <p className="px-4 py-3 text-sm text-gray-400">טוען...</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400">אין תוצאות</p>
        ) : (
          filtered.map((g) => {
            const conflictWith = taken.get(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => trySelect(g.id, g.name)}
                disabled={!!conflictWith}
                title={conflictWith ? `כבר מקושר ל-"${conflictWith}"` : undefined}
                className={`w-full text-right px-4 py-2.5 text-sm border-b last:border-b-0 border-gray-100 transition ${
                  conflictWith
                    ? "text-gray-300 cursor-not-allowed bg-gray-50"
                    : g.id === value
                    ? "bg-indigo-100 font-semibold text-indigo-800"
                    : "text-gray-700 hover:bg-indigo-50"
                }`}
              >
                {g.name} <span className="text-gray-400">({g.participants})</span>
                {conflictWith && <span className="text-gray-400"> — מקושר ל-{conflictWith}</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
