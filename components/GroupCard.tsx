"use client";

import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Group, getCurrentWeek, PROGRAM_WEEKS, Program } from "@/lib/groups";

interface Props {
  group: Group;
  onDeleted: () => void;
}

const PROGRAM_COLORS: Record<Program, string> = {
  Start:          "text-sky-700",
  Pro:            "text-violet-700",
  Momentum:       "text-orange-700",
  Boost:          "text-green-700",
  "אימון לאיזון": "text-rose-700",
};

export default function GroupCard({ group, onDeleted }: Props) {
  const week = getCurrentWeek(group.startDate, group.program);
  const total = PROGRAM_WEEKS[group.program];
  const color = PROGRAM_COLORS[group.program];

  const handleDelete = async () => {
    if (!confirm(`למחוק את הקבוצה "${group.name}"?`)) return;
    await deleteDoc(doc(db, "groups", group.id));
    onDeleted();
  };

  return (
    <div className="group flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-white hover:shadow-sm transition-all" dir="rtl">
      <span className="text-gray-800 font-medium text-base">{group.name}</span>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-bold tabular-nums ${color}`}>
          שבוע {week}
          <span className="text-gray-300 font-normal"> / {total}</span>
        </span>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-base leading-none"
          title="מחק קבוצה"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
