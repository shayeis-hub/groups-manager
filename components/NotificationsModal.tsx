"use client";

import Link from "next/link";
import { AppNotification, markNotificationRead, markAllNotificationsRead } from "@/lib/notifications";

interface Props {
  notifications: AppNotification[]; // unread only, newest first
  onClose: () => void;
}

// "2026-10-13" -> "13/10/26"
function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export default function NotificationsModal({ notifications, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-8 max-h-[80vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">התראות</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 transition text-2xl leading-none">
            ✕
          </button>
        </div>

        {notifications.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">אין התראות חדשות</p>
        ) : (
          <>
            <button
              onClick={() => markAllNotificationsRead(notifications.map((n) => n.id))}
              className="self-start text-xs font-semibold text-indigo-600 hover:underline mb-3"
            >
              סמן הכל כנקראו
            </button>
            <div className="overflow-y-auto flex flex-col gap-2 -mx-2 px-2">
              {notifications.map((n) => (
                <div key={n.id} className="border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 break-words">
                      <span className="font-semibold">{n.authorName}</span> ביצעה שיחה עם{" "}
                      <Link
                        href={`/clients/${n.clientId}`}
                        onClick={onClose}
                        className="font-semibold text-indigo-700 hover:underline"
                      >
                        {n.clientName}
                      </Link>{" "}
                      בתאריך {formatShortDate(n.sessionDate)}
                    </p>
                  </div>
                  <button
                    onClick={() => markNotificationRead(n.id)}
                    className="shrink-0 text-xs font-semibold text-gray-400 hover:text-green-600 border border-gray-200 hover:border-green-300 rounded-full px-3 py-1 transition"
                  >
                    נקראה
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
