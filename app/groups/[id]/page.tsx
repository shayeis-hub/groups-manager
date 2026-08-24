"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Group, getCurrentWeek, PROGRAM_WEEKS } from "@/lib/groups";
import { Client } from "@/lib/clients";
import { isDietitianEmail } from "@/lib/dietitians";
import ScheduledMessagesPanel from "@/components/ScheduledMessagesPanel";

export default function GroupClientsPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;
  const { user, loading } = useAuth();
  const isDietitian = isDietitianEmail(user?.email);
  const [group, setGroup] = useState<Group | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setFetching(true);
      try {
        const gSnap = await getDoc(doc(db, "groups", groupId));
        setGroup(gSnap.exists() ? ({ id: gSnap.id, ...gSnap.data() } as Group) : null);

        // A dietitian doesn't own this data (it belongs to whichever coach
        // owns it), so the query can't filter by userId — the security rules
        // grant dietitians read access regardless of who created the doc.
        const clientsQuery = isDietitian
          ? query(collection(db, "clients"), where("groupId", "==", groupId))
          : query(collection(db, "clients"), where("groupId", "==", groupId), where("userId", "==", user.uid));
        const snap = await getDocs(clientsQuery);
        setClients(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Client))
            .sort((a, b) => a.name.localeCompare(b.name, "he"))
        );
      } catch (err) {
        console.error("fetch clients error:", err);
      } finally {
        setFetching(false);
      }
    };
    fetchAll();
  }, [user, groupId, isDietitian]);

  if (loading || (user && fetching)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <Link href="/" className="text-indigo-600 font-semibold">יש להתחבר תחילה</Link>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4" dir="rtl">
        <p className="text-gray-400 text-lg">הקבוצה לא נמצאה</p>
        <Link href="/" className="text-indigo-600 font-semibold">חזרה לקבוצות</Link>
      </div>
    );
  }

  const week = getCurrentWeek(group.startDate, group.program);
  const total = PROGRAM_WEEKS[group.program];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-300 hover:text-gray-600 transition text-2xl leading-none shrink-0">
            ›
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-gray-800 break-words">{group.name}</h1>
            <p className="text-sm text-gray-400">
              {group.coachName ? `${group.coachName} · ` : ""}
              {group.program} · {week ? `שבוע ${week} מתוך ${total}` : "התוכנית הסתיימה"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <ScheduledMessagesPanel group={group} />
        </div>

        <p className="text-gray-400 text-sm mb-4 sm:mb-6">
          {clients.length} לקוחות ליווי
        </p>

        <div className="flex flex-col gap-3">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-3 hover:shadow-md transition-shadow"
            >
              <span className="text-lg sm:text-xl font-bold text-gray-800 min-w-0 break-words">{c.name}</span>
              <span className="text-gray-300 text-2xl leading-none shrink-0">‹</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
