"use client";

import { useState } from "react";
import { Group, Program } from "@/lib/groups";
import GroupCard from "./GroupCard";

interface Props {
  program: Program;
  groups: Group[];
  color: string;
  onDeleted: () => void;
  onUpdated: () => void;
}

export default function ProgramSection({ program, groups, color, onDeleted, onUpdated }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        dir="rtl"
      >
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold ${color}`}>{program}</span>
          <span className="text-sm text-gray-400">{groups.length} קבוצות</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} onDeleted={onDeleted} onUpdated={onUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}
