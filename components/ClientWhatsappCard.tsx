"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Client } from "@/lib/clients";
import { queueWhatsappCommand, phoneToJid } from "@/lib/whatsapp";

interface Props {
  client: Client;
  onPhoneSaved: (phone: string) => void;
}

// Personal WhatsApp message to one coaching client, sent through the same
// bridge service as the group messages (the client's number is just another
// JID). Tracks the queued command so the coach sees whether it actually went
// out, instead of "queued" and silence if the bridge is down.
export default function ClientWhatsappCard({ client, onPhoneSaved }: Props) {
  const { user } = useAuth();
  const [phone, setPhone] = useState(client.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [text, setText] = useState("");
  const [queueing, setQueueing] = useState(false);
  const [commandId, setCommandId] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "processing" | "done" | "error" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!commandId) return;
    return onSnapshot(doc(db, "whatsappCommands", commandId), (snap) => {
      const data = snap.data();
      if (!data) return;
      setStatus(data.status);
      if (data.status === "done") setText("");
      if (data.status === "error") setError(data.error || "השליחה נכשלה");
    });
  }, [commandId]);

  const jid = phoneToJid(phone);
  const phoneChanged = phone.trim() !== (client.phone ?? "");
  const waiting = queueing || status === "pending" || status === "processing";

  const savePhone = async () => {
    setSavingPhone(true);
    try {
      await updateDoc(doc(db, "clients", client.id), { phone: phone.trim() });
      onPhoneSaved(phone.trim());
    } finally {
      setSavingPhone(false);
    }
  };

  const send = async () => {
    if (!user || !jid || !text.trim()) return;
    setQueueing(true);
    setError("");
    setStatus(null);
    try {
      // Save the number first if it was just typed in, so the next message
      // doesn't need it entered again.
      if (phoneChanged) await savePhone();
      const id = await queueWhatsappCommand({
        uid: user.uid,
        waGroupId: jid,
        type: "send",
        text: text.trim(),
      });
      setCommandId(id);
      setStatus("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחה, נסה שוב");
    } finally {
      setQueueing(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 flex flex-col gap-4">
      <h2 className="text-base sm:text-lg font-bold text-gray-800">הודעת וואטסאפ ללקוח</h2>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="מספר טלפון, למשל 050-1234567"
          dir="ltr"
          className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300"
        />
        {phoneChanged && (
          <button
            onClick={savePhone}
            disabled={savingPhone}
            className="text-sm font-semibold text-indigo-600 hover:underline disabled:opacity-50"
          >
            {savingPhone ? "שומר..." : "שמור מספר"}
          </button>
        )}
      </div>
      {phone.trim() && !jid && <p className="text-xs text-red-500 -mt-2">המספר לא נראה תקין</p>}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="טקסט ההודעה..."
        rows={3}
        className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder:text-gray-300 resize-none"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={send}
          disabled={waiting || !jid || !text.trim()}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl px-5 py-2 text-sm transition disabled:opacity-50"
        >
          {waiting ? "שולח..." : "שלח בוואטסאפ"}
        </button>
        {status === "pending" || status === "processing" ? (
          <span className="text-sm text-gray-400">ממתין לשירות השליחה...</span>
        ) : status === "done" ? (
          <span className="text-sm text-green-600">✓ ההודעה נשלחה</span>
        ) : null}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </section>
  );
}
