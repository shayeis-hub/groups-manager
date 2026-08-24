"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Group } from "@/lib/groups";
import { queueWhatsappCommand } from "@/lib/whatsapp";

interface Props {
  group: Group;
}

export default function WhatsappPanel({ group }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [scheduledAt, setScheduledAt] = useState(""); // datetime-local value, empty = send now
  const [sending, setSending] = useState<"send" | "open" | "close" | null>(null);
  const [feedback, setFeedback] = useState("");

  if (!group.whatsappGroupId) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 sm:px-8 sm:py-5 text-sm text-gray-400" dir="rtl">
        לא הוגדר מזהה קבוצת וואטסאפ לקבוצה זו. ניתן להוסיף אותו דרך &quot;ערוך קבוצה&quot;.
      </div>
    );
  }

  const run = async (type: "send" | "open" | "close") => {
    if (!user) return;
    if (type === "send" && !text.trim()) return;
    setSending(type);
    setFeedback("");
    try {
      await queueWhatsappCommand({
        waGroupId: group.whatsappGroupId!,
        type,
        text: type === "send" ? text.trim() : undefined,
        scheduledFor: type === "send" && scheduledAt ? new Date(scheduledAt) : undefined,
        createdBy: user.uid,
      });
      if (type === "send") {
        setFeedback(scheduledAt ? "ההודעה תוזמנה." : "ההודעה נשלחה לתור.");
        setText("");
        setScheduledAt("");
      } else {
        setFeedback(type === "open" ? "פקודת פתיחת קבוצה נשלחה." : "פקודת סגירת קבוצה נשלחה.");
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "שגיאה בשליחת הפקודה");
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 sm:px-8 sm:py-5 flex flex-col gap-4" dir="rtl">
      <h2 className="text-lg font-bold text-gray-800">וואטסאפ</h2>

      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="טקסט ההודעה..."
          rows={3}
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300 resize-none"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-500 flex items-center gap-2">
            תזמון (אופציונלי):
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-gray-50"
            />
          </label>
          <button
            onClick={() => run("send")}
            disabled={sending !== null || !text.trim()}
            className="mr-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-5 py-2 text-sm transition disabled:opacity-50"
          >
            {sending === "send" ? "שולח..." : scheduledAt ? "תזמן שליחה" : "שלח עכשיו"}
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button
          onClick={() => run("open")}
          disabled={sending !== null}
          className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-50"
        >
          {sending === "open" ? "פותח..." : "פתח קבוצה"}
        </button>
        <button
          onClick={() => run("close")}
          disabled={sending !== null}
          className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-50"
        >
          {sending === "close" ? "סוגר..." : "סגור קבוצה"}
        </button>
      </div>

      {feedback && <p className="text-sm text-gray-500">{feedback}</p>}
    </div>
  );
}
