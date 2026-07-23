"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Group, isGroupActive, getCurrentWeek, PROGRAMS, Program } from "@/lib/groups";
import AddGroupModal from "@/components/AddGroupModal";
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
  const [fetching, setFetching] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-gray-800">ניהול קבוצות</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:block">{user.displayName}</span>
            <button onClick={signOut} className="text-sm text-gray-400 hover:text-gray-600 transition">
              התנתק
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <p className="text-gray-400 text-sm">
            {groups.length === 0 ? "אין קבוצות פעילות" : `${groups.length} קבוצות פעילות`}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-sm"
          >
            <span className="text-xl leading-none">+</span>
            הוסף קבוצה
          </button>
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
    </div>
  );
}
