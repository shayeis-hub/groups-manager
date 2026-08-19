"use client";

import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Group, isGroupUpcoming } from "@/lib/groups";

interface Props {
  groups: Group[]; // running + not-yet-started cycles
  onClose: () => void;
  onAdded: () => void;
}

// "10/08/2026" from "2026-08-10"
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function AddClientModal({ groups, onClose, onAdded }: Props) {
  const { user } = useAuth();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [name, setName] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupId || !name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await addDoc(collection(db, "clients"), {
        name: name.trim(),
        groupId,
        portalUrl: portalUrl.trim(),
        createdAt: Date.now(),
        userId: user.uid,
      });
      onAdded();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "שגיאה בשמירה, נסה שוב");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">הוספת לקוח ליווי</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" dir="rtl">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">קבוצה</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              required
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.program} · {g.name}
                  {isGroupUpcoming(g.startDate) ? ` — מתחילה ${formatDate(g.startDate)}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">שם הלקוח</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="הכנס שם לקוח..."
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">קישור לכרטיס לקוח</label>
            <input
              type="url"
              value={portalUrl}
              onChange={(e) => setPortalUrl(e.target.value)}
              placeholder="https://..."
              dir="ltr"
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl py-3 transition disabled:opacity-50"
            >
              {loading ? "שומר..." : "הוסף לקוח"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl py-3 transition"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
