"use client";

import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Group, getCurrentWeek, PROGRAM_WEEKS } from "@/lib/groups";

interface Props {
  group: Group;
  onDeleted: () => void;
}

export default function GroupCard({ group, onDeleted }: Props) {
  const week = getCurrentWeek(group.startDate, group.program);
  const total = PROGRAM_WEEKS[group.program];

  const handleDelete = async () => {
    if (!confirm(`למחוק את הקבוצה "${group.name}"?`)) return;
    await deleteDoc(doc(db, "groups", group.id));
    onDeleted();
  };

  return (
    <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-6 flex items-center justify-between hover:shadow-md transition-shadow" dir="rtl">
      <div className="flex items-center gap-6">
        <span className="text-sm font-medium bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full whitespace-nowrap">
          {group.program}
        </span>
        <span className="text-2xl font-bold text-gray-800">{group.name}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-left">
          <span className="text-4xl font-black text-indigo-600">{week}</span>
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
