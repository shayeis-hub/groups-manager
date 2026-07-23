"use client";

import { useState } from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Group, getCurrentWeek, PROGRAM_WEEKS, Program } from "@/lib/groups";
import EditGroupModal from "./EditGroupModal";

interface Props {
  group: Group;
  onDeleted: () => void;
  onUpdated: () => void;
}

const PROGRAM_COLORS: Record<Program, { bg: string; text: string; border: string }> = {
  Start:          { bg: "bg-sky-100",     text: "text-sky-700",     border: "border-sky-200" },
  Pro:            { bg: "bg-violet-100",  text: "text-violet-700",  border: "border-violet-200" },
  Momentum:       { bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-200" },
  Boost:          { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200" },
  "אימון לאיזון": { bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-200" },
  Routine:        { bg: "bg-teal-100",    text: "text-teal-700",    border: "border-teal-200" },
  VIP:            { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200" },
};

export default function GroupCard({ group, onDeleted, onUpdated }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const week = getCurrentWeek(group.startDate, group.program);
  const total = PROGRAM_WEEKS[group.program];
  const colors = PROGRAM_COLORS[group.program];

  const handleDelete = async () => {
    if (!confirm(`למחוק את הקבוצה "${group.name}"?`)) return;
    await deleteDoc(doc(db, "groups", group.id));
    onDeleted();
  };

  return (
    <>
      <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-5 flex items-center justify-between hover:shadow-md transition-shadow" dir="rtl">
        <span className="text-2xl font-bold text-gray-800">{group.name}</span>

        <div className="flex items-center gap-3">
          {/* WhatsApp button — visible only when link exists */}
          {group.whatsappLink && (
            <a
              href={group.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              title="פתח קבוצת ווטסאפ"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-green-50 hover:bg-green-100 transition"
            >
              <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
                <circle cx="16" cy="16" r="16" fill="#25D366"/>
                <path d="M22.5 9.5A9 9 0 0 0 7.1 20.9L6 26l5.3-1.4A9 9 0 1 0 22.5 9.5zm-6.5 13.8a7.4 7.4 0 0 1-3.8-1l-.3-.2-3.1.8.8-3-.2-.3a7.5 7.5 0 1 1 6.6 3.7zm4.1-5.6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7 7 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.5.2-.3v-.3l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.1s.9 2.4 1 2.6c.2.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.5-.3z" fill="#fff"/>
              </svg>
            </a>
          )}

          {/* Edit button */}
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-all text-gray-300 hover:text-gray-600"
            title="ערוך קבוצה"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 0 1 2.828 2.828L11.828 15.828a2 2 0 0 1-1.415.586H8v-2.414A2 2 0 0 1 8.586 12.5z" />
            </svg>
          </button>

          {/* Week counter */}
          <div className="text-left min-w-[56px]">
            <span className={`text-4xl font-black ${colors.text}`}>{week}</span>
            <span className="text-sm text-gray-400 mr-1">/ {total}</span>
            <div className="text-xs text-gray-400 text-center">שבוע</div>
          </div>

          {/* Delete button */}
          <button
            onClick={handleDelete}
            className="text-gray-300 hover:text-red-400 transition-all text-xl leading-none p-1"
            title="מחק קבוצה"
          >
            ✕
          </button>
        </div>
      </div>

      {showEdit && (
        <EditGroupModal
          group={group}
          onClose={() => setShowEdit(false)}
          onSaved={onUpdated}
        />
      )}
    </>
  );
}
