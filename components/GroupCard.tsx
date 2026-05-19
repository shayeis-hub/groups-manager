"use client";

import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Group, getCurrentWeek, PROGRAM_WEEKS, Program } from "@/lib/groups";

interface Props {
  group: Group;
  onDeleted: () => void;
}

const PROGRAM_COLORS: Record<Program, { bg: string; text: string; border: string }> = {
  Start:          { bg: "bg-sky-100",     text: "text-sky-700",     border: "border-sky-200" },
  Pro:            { bg: "bg-violet-100",  text: "text-violet-700",  border: "border-violet-200" },
  Momentum:       { bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-200" },
  Boost:          { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200" },
  "אימון לאיזון": { bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-200" },
};

export default function GroupCard({ group, onDeleted }: Props) {
  const week = getCurrentWeek(group.startDate, group.program);
  const total = PROGRAM_WEEKS[group.program];
  const colors = PROGRAM_COLORS[group.program];

  const handleDelete = async () => {
    if (!confirm(`למחוק את הקבוצה "${group.name}"?`)) return;
    await deleteDoc(doc(db, "groups", group.id));
    onDeleted();
  };

  return (
    <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-5 flex items-center justify-between hover:shadow-md transition-shadow" dir="rtl">
      <div className="flex items-center gap-5">
        <span className={`text-base font-bold px-4 py-1.5 rounded-xl border ${colors.bg} ${colors.text} ${colors.border} whitespace-nowrap`}>
          {group.program}
        </span>
        <span className="text-2xl font-bold text-gray-800">{group.name}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-left">
          <span className={`text-4xl font-black ${colors.text}`}>{week}</span>
          <span className="text-sm text-gray-400 mr-1">/ {total}</span>
          <div className="text-xs text-gray-400 text-center">שבוע</div>
        </div>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-xl leading-none p-1"
          title="מחק קבוצה"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
