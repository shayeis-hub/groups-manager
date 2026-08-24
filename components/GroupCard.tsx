"use client";

import { useState } from "react";
import Link from "next/link";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Group, getCurrentWeek, PROGRAM_WEEKS, PROGRAM_COLORS } from "@/lib/groups";
import EditGroupModal from "./EditGroupModal";

interface Props {
  group: Group;
  clientCount: number;
  onDeleted: () => void;
  onUpdated: () => void;
}

export default function GroupCard({ group, clientCount, onDeleted, onUpdated }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const week = getCurrentWeek(group.startDate, group.program);
  const total = PROGRAM_WEEKS[group.program];
  const colors = PROGRAM_COLORS[group.program];

  const handleDelete = async () => {
    if (!confirm(`למחוק את הקבוצה "${group.name}"?`)) return;
    await deleteDoc(doc(db, "groups", group.id));
    onDeleted();
  };

  // Rendered in the inline row on desktop and in the stacked row on mobile.
  const clientsPill = clientCount > 0 && (
    <Link
      href={`/groups/${group.id}`}
      title="לקוחות ליווי"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border whitespace-nowrap transition ${colors.bg} ${colors.text} ${colors.border} hover:brightness-95`}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
      </svg>
      <span className="opacity-70">{clientCount}</span>
      לקוחות ליווי
    </Link>
  );

  const editButton = (
    <button
      onClick={() => setShowEdit(true)}
      className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-all text-gray-400 hover:text-gray-600 shrink-0"
      title="ערוך קבוצה"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 0 1 2.828 2.828L11.828 15.828a2 2 0 0 1-1.415.586H8v-2.414A2 2 0 0 1 8.586 12.5z" />
      </svg>
    </button>
  );

  const deleteButton = (
    <button
      onClick={handleDelete}
      className="flex items-center justify-center w-9 h-9 rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all text-xl leading-none shrink-0"
      title="מחק קבוצה"
    >
      ✕
    </button>
  );

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 sm:px-8 sm:py-5 hover:shadow-md transition-shadow" dir="rtl">
        {/* Name + week counter — always share the first line */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/groups/${group.id}`}
            className="text-xl sm:text-2xl font-bold text-gray-800 min-w-0 break-words hover:text-indigo-700 transition"
          >
            {group.name}
          </Link>

          <div className="flex items-center gap-3 shrink-0">
            {/* Actions sit inline on desktop, and move to their own row on mobile */}
            <div className="hidden sm:flex items-center gap-3">
              {clientsPill}
              {editButton}
            </div>

            <div className="text-left min-w-[52px]">
              <span className={`text-3xl sm:text-4xl font-black ${colors.text}`}>{week}</span>
              <span className="text-sm text-gray-400 mr-1">/ {total}</span>
              <div className="text-xs text-gray-400 text-center">שבוע</div>
            </div>

            <div className="hidden sm:block">{deleteButton}</div>
          </div>
        </div>

        {/* Mobile-only action row */}
        <div className="flex sm:hidden items-center gap-2 mt-3">
          {clientsPill}
          <div className="flex items-center gap-1 mr-auto">
            {editButton}
            {deleteButton}
          </div>
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
