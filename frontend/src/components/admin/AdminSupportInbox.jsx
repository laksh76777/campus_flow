import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Inbox, LoaderCircle, MessageCircle, Send, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { getAdminSupportInbox, getSupportConversation, sendAdminSupportReply, updateSupportStatus } from "../../services/supportService";

export default function AdminSupportInbox() {
  const [filter, setFilter] = useState("open");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const selectedIdRef = useRef(null);
  const refresh = useCallback(async () => {
    try {
      const res = await getAdminSupportInbox(filter);
      const conversations = Array.isArray(res?.data) ? res.data : [];
      setItems(conversations);
      if (selectedIdRef.current) {
        if (conversations.some((item) => item._id === selectedIdRef.current)) {
          const conversation = (await getSupportConversation(selectedIdRef.current)).data;
          setSelected(conversation);
        }
      }
    } catch (error) { toast.error(error.response?.data?.message || "Could not load the support inbox."); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { const timer = setInterval(refresh, 12000); return () => clearInterval(timer); }, [refresh]);

  const open = async (id) => {
    try { const conversation = (await getSupportConversation(id)).data; selectedIdRef.current = conversation?._id || null; setSelected(conversation); }
    catch (error) { toast.error(error.response?.data?.message || "Could not open this question."); }
  };
  const reply = async (event) => {
    event.preventDefault();
    if (!selected?._id || !draft.trim() || sending) return;
    setSending(true);
    try {
      const result = await sendAdminSupportReply(selected._id, draft.trim());
      setSelected(result.data); setDraft(""); await refresh(); toast.success("Reply sent to the student.");
    } catch (error) { toast.error(error.response?.data?.message || "Reply could not be sent."); }
    finally { setSending(false); }
  };
  const close = async () => {
    if (!selected?._id) return;
    try { const result = await updateSupportStatus(selected._id, selected.status === "closed" ? "open" : "closed"); setSelected(result.data); await refresh(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not update conversation status."); }
  };

  return <section className="mx-auto flex h-[min(760px,calc(100vh-9rem))] min-h-[520px] max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:flex-row" aria-label="Student support inbox">
    <aside className="flex w-full flex-col border-b border-slate-200 bg-slate-50/70 lg:w-96 lg:border-b-0 lg:border-r"><div className="flex items-center gap-3 p-5"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Inbox size={19}/></div><div><h2 className="font-bold text-slate-900">Student support</h2><p className="text-xs text-slate-500">Assistant escalations and TPO questions</p></div></div><div className="flex gap-1 px-3 pb-3">{["open", "answered", "bot_answered", "closed", "all"].map((status) => <button key={status} type="button" onClick={() => setFilter(status)} className={`rounded-lg px-2 py-1.5 text-[10px] font-bold capitalize ${filter === status ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-100"}`}>{status.replace("_", " ")}</button>)}</div><div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{loading ? <p className="p-4 text-sm text-slate-500">Loading inbox…</p> : items.length === 0 ? <div className="p-5 text-center text-sm text-slate-500">No conversations in this view.</div> : items.map((item) => <button key={item._id} type="button" onClick={() => open(item._id)} className={`mb-2 w-full rounded-2xl border p-3 text-left ${selected?._id === item._id ? "border-indigo-200 bg-indigo-50" : "border-transparent bg-white hover:border-slate-200"}`}><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold text-slate-800">{item.student?.fullName || "Student"}</span>{item.unreadCount > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">{item.unreadCount}</span>}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{item.student?.email || "Student account"}</span><span className="mt-2 block truncate text-xs font-semibold text-slate-700">{item.subject}</span><span className="mt-1 flex justify-between gap-2"><span className="truncate text-[11px] text-slate-500">{item.lastMessage?.content}</span><span className="shrink-0 text-[10px] capitalize text-slate-400">{item.status.replace("_", " ")}</span></span></button>)}</div></aside>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col"><header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><MessageCircle size={18}/></div><div className="min-w-0 flex-1"><h1 className="truncate font-bold text-slate-900">{selected?.subject || "Select a student question"}</h1><p className="truncate text-xs text-slate-500">{selected?.student?.fullName || selected?.student?.email || "Student conversations are private to the student and TPO team."}</p></div>{selected && <button type="button" onClick={close} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{selected.status === "closed" ? "Reopen" : <><Check size={14}/> Close</>}</button>}</header>
      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4 sm:p-6" aria-live="polite">{!selected ? <div className="mx-auto mt-12 max-w-sm text-center text-sm leading-6 text-slate-500"><UserRound size={28} className="mx-auto mb-3 text-slate-300"/>Choose a question to review the assistant context and reply as the placement team.</div> : selected.messages?.map((message) => <div key={message._id} className={`flex ${message.senderRole === "student" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.senderRole === "student" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"}`}><p className="whitespace-pre-wrap break-words">{message.content}</p><span className={`mt-2 block text-[10px] font-semibold ${message.senderRole === "student" ? "text-indigo-100" : "text-slate-400"}`}>{message.senderRole === "assistant" ? `CampusFlow assistant${message.confidence != null ? ` · ${Math.round(message.confidence * 100)}% confidence` : ""}` : message.senderRole === "admin" ? "TPO administrator" : "Student"}{message.handoffRecommended ? " · Requested review" : ""}</span></div></div>)}</div>
      {selected && selected.status !== "closed" && <form onSubmit={reply} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 sm:p-4"><textarea aria-label="Administrator reply" rows={2} maxLength={4000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a confirmed answer for the student…" className="min-h-12 flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"/><button type="submit" disabled={!draft.trim() || sending} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300" aria-label="Send reply">{sending ? <LoaderCircle size={18} className="animate-spin"/> : <Send size={17}/>}</button></form>}
    </div>
  </section>;
}
