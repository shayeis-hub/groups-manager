"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Group, isGroupActive, getCurrentWeek, getWeekForDate } from "@/lib/groups";
import { Client, SessionKind } from "@/lib/clients";

const KINDS: SessionKind[] = ["coachSessions", "dietitianSessions"];

interface Row {
  client: Client;
  group: Group;
  currentWeek: number;
  lastCoachWeek: number | null;
  lastDietitianWeek: number | null;
}

export default function SessionsOverviewPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      setRows(null);

      const [groupSnap, clientSnap] = await Promise.all([
        getDocs(query(collection(db, "groups"), where("userId", "==", user.uid))),
        getDocs(query(collection(db, "clients"), where("userId", "==", user.uid))),
      ]);
      const groups = new Map(
        groupSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Group])
      );
      const clients = clientSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Client));

      const lastSessionWeek = async (clientId: string, kind: SessionKind, group: Group) => {
        const snap = await getDocs(
          query(collection(db, "clients", clientId, kind), orderBy("date", "desc"), limit(1))
        );
        if (snap.empty) return null;
        return getWeekForDate(group.startDate, snap.docs[0].data().date as string);
      };

      const built = (
        await Promise.all(
          clients.map(async (client) => {
            const group = groups.get(client.groupId);
            if (!group || !isGroupActive(group.startDate, group.program)) return null;
            const [lastCoachWeek, lastDietitianWeek] = await Promise.all([
              lastSessionWeek(client.id, "coachSessions", group),
              lastSessionWeek(client.id, "dietitianSessions", group),
            ]);
            const currentWeek = getCurrentWeek(group.startDate, group.program);
            if (currentWeek === null) return null;
            return { client, group, currentWeek, lastCoachWeek, lastDietitianWeek };
          })
        )
      ).filter((r): r is Row => r !== null)
        .sort((a, b) => a.client.name.localeCompare(b.client.name, "he"));

      setRows(built);
    };
    run();
  }, [user]);

  if (loading) {
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

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-300 hover:text-gray-600 transition text-2xl leading-none shrink-0">
            ›
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-gray-800">ממשק ניהול שיחות</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {rows === null ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-20">אין לקוחות ליווי בקבוצות פעילות כרגע</p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map(({ client, group, currentWeek, lastCoachWeek, lastDietitianWeek }) => (
              <div
                key={client.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <Link href={`/clients/${client.id}`} className="block px-5 sm:px-6 py-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-lg font-bold text-gray-800 min-w-0 break-words">{client.name}</span>
                    <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{group.program} · {group.name}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <p className={client.openingQuestionnaire ? "text-green-600" : "text-red-500"}>
                      {client.openingQuestionnaire ? "✓ מילא שאלון פתיחה" : "לא מילא שאלון פתיחה"}
                    </p>
                    <p className="text-gray-600">
                      שבוע נוכחי בתוכנית: <span className="font-semibold text-gray-800">{currentWeek}</span>
                    </p>
                    <p className={lastCoachWeek === null ? "text-red-500" : "text-gray-600"}>
                      {lastCoachWeek === null
                        ? "אין עדיין שיחה עם מאמן"
                        : <>שיחה אחרונה עם מאמן בוצעה בשבוע: <span className="font-semibold text-gray-800">{lastCoachWeek}</span></>}
                    </p>
                    <p className={lastDietitianWeek === null ? "text-red-500" : "text-gray-600"}>
                      {lastDietitianWeek === null
                        ? "אין עדיין שיחה עם תזונאית"
                        : <>שיחה אחרונה עם תזונאית בוצעה בשבוע: <span className="font-semibold text-gray-800">{lastDietitianWeek}</span></>}
                    </p>
                  </div>
                </Link>
                {client.portalUrl && (
                  <a
                    href={client.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 border-t border-gray-100 px-5 sm:px-6 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition rounded-b-2xl"
                  >
                    כרטיס לקוח ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
