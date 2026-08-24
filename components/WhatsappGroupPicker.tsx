"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { WhatsappGroupOption } from "@/lib/whatsapp";
import { WhatsappGroupLink } from "@/lib/groups";

interface Props {
  uid: string;
  value: WhatsappGroupLink[];
  excludeGroupId?: string; // this app group's own id, so its own links don't conflict with themselves
  onChange: (links: WhatsappGroupLink[]) => void;
}

export default function WhatsappGroupPicker({ uid, value, excludeGroupId, onChange }: Props) {
  const [groups, setGroups] = useState<WhatsappGroupOption[] | null>(null);
  const [manual, setManual] = useState("");
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
    // Scoped to this coach's own groups: a WhatsApp JID from one coach's
    // phone can never collide with another coach's (different accounts), and
    // the security rules only allow a non-dietitian to list their own groups.
    const q = query(collection(db, "groups"), where("userId", "==", uid));
    const unsub = onSnapshot(q, (snap) => {
      const map = new Map<string, string>();
      snap.docs.forEach((d) => {
        if (d.id === excludeGroupId) return;
        const links = (d.data().whatsappGroups ?? []) as WhatsappGroupLink[];
        for (const l of links) map.set(l.id, d.data().name);
      });
      setTaken(map);
    });
    return unsub;
  }, [uid, excludeGroupId]);

  const selectedIds = new Set(value.map((v) => v.id));
  const filterLower = filter.trim().toLowerCase();
  const filtered = groups?.filter((g) => !selectedIds.has(g.id) && g.name.toLowerCase().includes(filterLower)) ?? [];

  const addLink = (link: WhatsappGroupLink) => {
    const conflictWith = taken.get(link.id);
    if (conflictWith) {
      setConflictMsg(`קבוצת וואטסאפ זו כבר מקושרת ל-"${conflictWith}" — כל קבוצת וואטסאפ יכולה להיות מקושרת לקבוצה אחת בלבד באפליקציה.`);
      return;
    }
    setConflictMsg("");
    onChange([...value, link]);
  };

  const removeLink = (id: string) => {
    onChange(value.filter((l) => l.id !== id));
  };

  const addManual = () => {
    const id = manual.trim();
    if (!id) return;
    addLink({ id, name: "" });
    setManual("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-600">קבוצות וואטסאפ</label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((l) => (
            <span
              key={l.id}
              className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1.5 text-sm text-indigo-800"
            >
              {l.name || l.id}
              <button type="button" onClick={() => removeLink(l.id)} className="text-indigo-400 hover:text-indigo-700">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="חפש קבוצה להוספה... (יש הרבה קבוצות דומות — בדוק היטב לפני בחירה)"
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
                onClick={() => addLink({ id: g.id, name: g.name })}
                disabled={!!conflictWith}
                title={conflictWith ? `כבר מקושר ל-"${conflictWith}"` : undefined}
                className={`w-full text-right px-4 py-2.5 text-sm border-b last:border-b-0 border-gray-100 transition ${
                  conflictWith ? "text-gray-300 cursor-not-allowed bg-gray-50" : "text-gray-700 hover:bg-indigo-50"
                }`}
              >
                {g.name} <span className="text-gray-400">({g.participants})</span>
                {conflictWith && <span className="text-gray-400"> — מקושר ל-{conflictWith}</span>}
              </button>
            );
          })
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="או הדבק מזהה ידנית: 120363...@g.us"
          dir="ltr"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300 text-left"
        />
        <button
          type="button"
          onClick={addManual}
          disabled={!manual.trim()}
          className="text-sm font-semibold text-indigo-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          הוסף
        </button>
      </div>
    </div>
  );
}
