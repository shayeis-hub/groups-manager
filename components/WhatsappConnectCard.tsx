"use client";

import { QRCodeSVG } from "qrcode.react";
import { WhatsappSession } from "@/lib/whatsapp";

interface Props {
  session: WhatsappSession | null;
  onConnect: () => void;
}

export default function WhatsappConnectCard({ session, onConnect }: Props) {
  const status = session?.status ?? "disconnected";

  if (status === "connected") {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 sm:px-8 sm:py-5 flex items-center justify-between gap-3" dir="rtl">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
          <span className="font-semibold text-gray-800">מחובר לוואטסאפ</span>
        </div>
        <span className="text-sm text-gray-400">{session?.groups?.length ?? 0} קבוצות זמינות</span>
      </div>
    );
  }

  if (status === "qr" && session?.qr) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-6 sm:px-8 flex flex-col items-center gap-4 text-center" dir="rtl">
        <p className="font-semibold text-gray-800">סרוק עם וואטסאפ בטלפון שלך</p>
        <p className="text-sm text-gray-400">הגדרות ← מכשירים מקושרים ← קישור מכשיר</p>
        <div className="p-3 bg-white border border-gray-100 rounded-xl">
          <QRCodeSVG value={session.qr} size={220} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-6 sm:px-8 flex flex-col items-center gap-4 text-center" dir="rtl">
      <p className="text-gray-500">חשבון הוואטסאפ שלך עדיין לא מחובר.</p>
      <button
        onClick={onConnect}
        disabled={status === "connecting"}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-6 py-3 transition disabled:opacity-50"
      >
        {status === "connecting" ? "מתחבר..." : "התחבר לוואטסאפ"}
      </button>
    </div>
  );
}
