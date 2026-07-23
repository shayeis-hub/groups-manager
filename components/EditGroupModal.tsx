"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Group } from "@/lib/groups";

interface Props {
  group: Group;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditGroupModal({ group, onClose, onSaved }: Props) {
  const [name, setName] = useState(group.name);
  const [startDate, setStartDate] = useState(group.startDate);
  const [whatsappLink, setWhatsappLink] = useState(group.whatsappLink ?? "");
  const [whatsappLink2, setWhatsappLink2] = useState(group.whatsappLink2 ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate) return;
    setLoading(true);
    setError("");
    try {
      await updateDoc(doc(db, "groups", group.id), {
        name: name.trim(),
        startDate,
        whatsappLink: whatsappLink.trim() || null,
        whatsappLink2: group.program === "Start" ? (whatsappLink2.trim() || null) : null,
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה, נסה שוב");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">עריכת קבוצה</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" dir="rtl">

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">שם הקבוצה</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">תאריך התחלה</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">
              {group.program === "Start" ? "קישור ווטסאפ 1" : "קישור קבוצת ווטסאפ"}
            </label>
            <input
              type="url"
              value={whatsappLink}
              onChange={(e) => setWhatsappLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300 text-left"
              dir="ltr"
            />
          </div>

          {group.program === "Start" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">קישור ווטסאפ 2</label>
              <input
                type="url"
                value={whatsappLink2}
                onChange={(e) => setWhatsappLink2(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300 text-left"
                dir="ltr"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl py-3 transition disabled:opacity-50"
            >
              {loading ? "שומר..." : "שמור"}
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
