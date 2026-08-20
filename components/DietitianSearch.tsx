"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Group, PROGRAM_COLORS, isGroupActive } from "@/lib/groups";
import { Client } from "@/lib/clients";

interface GroupWithClients {
  group: Group;
  clients: Client[];
}

export default function DietitianSearch() {
  const { user, signOut } = useAuth();
  const [rows, setRows] = useState<GroupWithClients[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = "ממשק תזונאית - מערכת ליווי לקוחות";
    return () => {
      document.title = "ניהול קבוצות";
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      setFetching(true);
      try {
        // Not scoped by userId — a dietitian works across every coach's
        // groups, and the security rules grant her read access regardless
        // of who owns the data.
        const [groupSnap, clientSnap] = await Promise.all([
          getDocs(collection(db, "groups")),
          getDocs(collection(db, "clients")),
        ]);
        const groups = groupSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
        const clients = clientSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Client));

        const built = groups
          .filter((group) => isGroupActive(group.startDate, group.program))
          .map((group) => ({
            group,
            clients: clients
              .filter((c) => c.groupId === group.id)
              .sort((a, b) => a.name.localeCompare(b.name, "he")),
          }))
          .filter((row) => row.clients.length > 0)
          .sort((a, b) =>
            (a.group.coachName ?? "").localeCompare(b.group.coachName ?? "", "he") ||
            a.group.name.localeCompare(b.group.name, "he")
          );

        setRows(built);
      } catch (err) {
        console.error("dietitian search fetch error:", err);
      } finally {
        setFetching(false);
      }
    };
    run();
  }, []);

  const isSearching = search.trim().length > 0;

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;

    return rows
      .map(({ group, clients }) => {
        const groupMatches =
          (group.coachName ?? "").toLowerCase().includes(term) ||
          `${group.program} ${group.name}`.toLowerCase().includes(term);
        if (groupMatches) return { group, clients };

        const matchingClients = clients.filter((c) => c.name.toLowerCase().includes(term));
        if (matchingClients.length > 0) return { group, clients: matchingClients };

        return null;
      })
      .filter((r): r is GroupWithClients => r !== null);
  }, [rows, search]);

  const toggleOpen = (groupId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-black text-gray-800">ממשק תזונאית - מערכת ליווי לקוחות</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:block">{user?.displayName}</span>
            <button onClick={signOut} className="text-sm text-gray-400 hover:text-gray-600 transition">
              התנתק
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם לקוח, מאמן, או תוכנית..."
          className="w-full border-2 border-gray-200 rounded-xl px-5 py-4 text-lg font-semibold text-gray-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-400 placeholder:font-normal mb-6"
        />

        {fetching ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-20">
            {rows.length === 0 ? "אין עדיין קבוצות עם לקוחות ליווי" : "אין תוצאות תואמות"}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {results.map(({ group, clients }) => {
              const colors = PROGRAM_COLORS[group.program];
              const isOpen = isSearching || openIds.has(group.id);
              return (
              <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow" dir="rtl">
                <button
                  onClick={() => toggleOpen(group.id)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 sm:px-8 sm:py-5"
                >
                  <div className="min-w-0 text-right">
                    <div className="text-xl sm:text-2xl font-bold text-gray-800 break-words">
                      {group.name}
                    </div>
                    <div className="text-sm text-gray-400 mt-0.5">
                      {group.program} · {group.coachName || "ללא מאמן משויך"}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border whitespace-nowrap ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      <span className="opacity-70">{clients.length}</span>
                      לקוחות
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="flex flex-wrap gap-2 px-5 sm:px-8 pb-4 sm:pb-5">
                    {clients.map((c) => (
                      <Link
                        key={c.id}
                        href={`/clients/${c.id}`}
                        className="text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-full px-3 py-1.5 transition"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
