"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Group, isGroupActive, canAssignClients, getCurrentWeek, PROGRAMS, Program } from "@/lib/groups";
import AddGroupModal from "@/components/AddGroupModal";
import AddClientModal from "@/components/AddClientModal";
import ProgramSection from "@/components/ProgramSection";

const PROGRAM_COLORS: Record<Program, string> = {
  Start:          "text-sky-700",
  Pro:            "text-violet-700",
  Momentum:       "text-orange-700",
  Boost:          "text-green-700",
  "אימון לאיזון": "text-rose-700",
  Routine:        "text-teal-700",
  VIP:            "text-amber-700",
};

export default function Home() {
  const { user, loading, signIn, signOut } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [assignableGroups, setAssignableGroups] = useState<Group[]>([]);
  const [clientCounts, setClientCounts] = useState<Record<string, number>>({});
  const [fetching, setFetching] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);

  const fetchGroups = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const q = query(
        collection(db, "groups"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);
      const all = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Group))
        .sort((a, b) => (getCurrentWeek(a.startDate, a.program) ?? 0) - (getCurrentWeek(b.startDate, b.program) ?? 0));
      setGroups(all.filter((g) => isGroupActive(g.startDate, g.program)));

      // Cards on this page show running cycles only, but a new client can also
      // be pre-assigned to a cycle that hasn't started yet (finished ones can't).
      setAssignableGroups(
        all
          .filter((g) => canAssignClients(g.startDate, g.program))
          .sort((a, b) => b.startDate.localeCompare(a.startDate)) // newest cycle first
      );

      // How many coaching clients each group has — drives whether the
      // "לקוחות ליווי" button shows on that group's card at all.
      const clientSnap = await getDocs(
        query(collection(db, "clients"), where("userId", "==", user.uid))
      );
      const counts: Record<string, number> = {};
      clientSnap.docs.forEach((d) => {
        const gid = d.data().groupId as string;
        counts[gid] = (counts[gid] ?? 0) + 1;
      });
      setClientCounts(counts);
    } catch (err) {
      console.error("fetchGroups error:", err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (user) fetchGroups();
    else setGroups([]);
  }, [user]);

  const grouped = PROGRAMS.reduce<Record<Program, Group[]>>((acc, p) => {
    acc[p] = groups.filter((g) => g.program === p);
    return acc;
  }, {} as Record<Program, Group[]>);

  const activePrograms = PROGRAMS.filter((p) => grouped[p].length > 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-white gap-8">
        <div className="text-center">
          <h1 className="text-5xl font-black text-gray-800 mb-3">ניהול קבוצות</h1>
          <p className="text-gray-400 text-lg">התחבר כדי לנהל את הקבוצות שלך</p>
        </div>
        <button
          onClick={signIn}
          className="flex items-center gap-3 bg-white border border-gray-200 shadow-md hover:shadow-lg text-gray-700 font-semibold px-8 py-4 rounded-2xl transition-all text-lg"
        >
          <svg className="w-6 h-6" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          התחבר עם Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-black text-gray-800">ניהול קבוצות</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:block">{user.displayName}</span>
            <button onClick={signOut} className="text-sm text-gray-400 hover:text-gray-600 transition">
              התנתק
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
          <p className="text-gray-400 text-sm">
            {groups.length === 0 ? "אין קבוצות פעילות" : `${groups.length} קבוצות פעילות`}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowClientModal(true)}
              disabled={assignableGroups.length === 0}
              className="flex-1 sm:flex-none justify-center bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold px-4 sm:px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span className="text-xl leading-none">+</span>
              הוסף לקוח ליווי
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex-1 sm:flex-none justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 sm:px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-sm whitespace-nowrap"
            >
              <span className="text-xl leading-none">+</span>
              הוסף קבוצה
            </button>
          </div>
        </div>

        {fetching ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-xl font-semibold text-gray-400">אין קבוצות פעילות</p>
            <p className="text-gray-300 mt-2">לחץ על ״הוסף קבוצה״ כדי להתחיל</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activePrograms.map((program) => (
              <ProgramSection
                key={program}
                program={program}
                groups={grouped[program]}
                color={PROGRAM_COLORS[program]}
                clientCounts={clientCounts}
                onDeleted={fetchGroups}
                onUpdated={fetchGroups}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <AddGroupModal onClose={() => setShowModal(false)} onAdded={fetchGroups} />
      )}

      {showClientModal && (
        <AddClientModal
          groups={assignableGroups}
          onClose={() => setShowClientModal(false)}
          onAdded={fetchGroups}
        />
      )}
    </div>
  );
}
