"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { WhatsappAttachment } from "@/lib/whatsapp";
import { TemplateSet, MessageTemplate } from "@/lib/messageTemplates";

interface Props {
  onClose: () => void;
  onSelect: (attachment: WhatsappAttachment) => void;
}

interface SetWithTemplates {
  set: TemplateSet;
  templates: MessageTemplate[];
}

// Lets the coach pick a video that's already in the message-template
// library instead of re-attaching the same file from disk every time —
// avoids re-uploading (and duplicating) the same recurring content.
export default function LibraryAttachmentModal({ onClose, onSelect }: Props) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<SetWithTemplates[] | null>(null);
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      const [setSnap, templateSnap] = await Promise.all([
        getDocs(query(collection(db, "templateSets"), where("uid", "==", user.uid))),
        getDocs(query(collection(db, "messageTemplates"), where("uid", "==", user.uid))),
      ]);
      const sets = setSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TemplateSet));
      const templates = templateSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as MessageTemplate))
        .filter((t) => !!t.attachment);

      const byId = new Map(sets.map((s) => [s.id, s]));
      const grouped = new Map<string, MessageTemplate[]>();
      for (const t of templates) {
        if (!byId.has(t.setId)) continue; // orphaned template, no set to show it under
        const list = grouped.get(t.setId) ?? [];
        list.push(t);
        grouped.set(t.setId, list);
      }

      const built = Array.from(grouped.entries())
        .map(([setId, list]) => ({
          set: byId.get(setId)!,
          templates: list.sort((a, b) => a.weekOffset - b.weekOffset || a.dayOfWeek - b.dayOfWeek),
        }))
        .filter((g) => g.templates.length > 0)
        .sort((a, b) => a.set.program.localeCompare(b.set.program, "he") || a.set.name.localeCompare(b.set.name, "he"));

      setGroups(built);
    };
    run();
  }, [user]);

  const filtered = useMemo(() => {
    if (!groups) return [];
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups
      .map(({ set, templates }) => ({
        set,
        templates: templates.filter(
          (t) =>
            t.name.toLowerCase().includes(term) ||
            set.name.toLowerCase().includes(term) ||
            set.program.toLowerCase().includes(term)
        ),
      }))
      .filter((g) => g.templates.length > 0);
  }, [groups, search]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-8 max-h-[80vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">צירוף קובץ מספרייה</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 transition text-2xl leading-none">
            ✕
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי תוכנית, עונה, או שם..."
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300 mb-4"
        />

        <div className="overflow-y-auto flex flex-col gap-2 -mx-2 px-2">
          {groups === null ? (
            <p className="text-sm text-gray-400 text-center py-8">טוען...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {groups.length === 0 ? "אין עדיין קבצים בספריית ההודעות" : "אין תוצאות תואמות"}
            </p>
          ) : (
            filtered.map(({ set, templates }) => {
              const isOpen = search.trim().length > 0 || openSetId === set.id;
              return (
                <div key={set.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenSetId((id) => (id === set.id ? null : set.id))}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-right"
                  >
                    <span className="text-sm font-bold text-gray-800">
                      {set.program} · {set.name}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="flex flex-wrap gap-2 px-4 pb-3">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            onSelect(t.attachment!);
                            onClose();
                          }}
                          title={t.attachment?.name}
                          className="text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-full px-3 py-1.5 transition"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
