import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, CircleHelp, LoaderCircle, MessageCircle, Plus, Send, ShieldCheck, UserRound, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { createSupportConversation, getMySupportConversations, getSupportConversation, requestAdminReply, sendSupportMessage } from "../../services/supportService";

const messageText = (message) => message?.content || "";

export default function StudentSupportChat() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listEndRef = useRef(null);
  const selectedIdRef = useRef(null);

  const loadList = useCallback(async (keepSelection = true) => {
    try {
      const res = await getMySupportConversations();
      const items = Array.isArray(res?.data) ? res.data : [];
      setConversations(items);
      if (!keepSelection || !selectedIdRef.current) {
        if (items[0]?._id) {
          const detail = await getSupportConversation(items[0]._id);
          selectedIdRef.current = detail.data?._id || null;
          setSelected(detail.data);
        } else { selectedIdRef.current = null; setSelected(null); }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load support conversations.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadList(false); }, [loadList]);
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await getMySupportConversations();
        setConversations(Array.isArray(res?.data) ? res.data : []);
        if (selectedIdRef.current) {
          const detail = await getSupportConversation(selectedIdRef.current);
          setSelected(detail.data);
        }
      } catch { /* keep the current conversation visible during temporary network loss */ }
    }, 12000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { listEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selected?.messages?.length]);

  const chooseConversation = async (id) => {
    try { const conversation = (await getSupportConversation(id)).data; selectedIdRef.current = conversation?._id || null; setSelected(conversation); }
    catch (error) { toast.error(error.response?.data?.message || "Could not open this conversation."); }
  };

  const send = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = selected?._id
        ? await sendSupportMessage(selected._id, content)
        : await createSupportConversation(content);
      selectedIdRef.current = res.data.conversation?._id || null;
      setSelected(res.data.conversation);
      setDraft("");
      await loadList(true);
    } catch (error) { toast.error(error.response?.data?.message || "Message could not be sent."); }
    finally { setSending(false); }
  };

  const askAdmin = async () => {
    if (!selected?._id || sending) return;
    setSending(true);
    try {
      const res = await requestAdminReply(selected._id);
      selectedIdRef.current = res.data?._id || null;
      setSelected(res.data);
      await loadList(true);
      toast.success("Your question is in the TPO inbox.");
    } catch (error) { toast.error(error.response?.data?.message || "Could not request a TPO reply."); }
    finally { setSending(false); }
  };

  return (
    <section className="mx-auto flex h-[min(760px,calc(100vh-9rem))] min-h-[520px] max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:flex-row" aria-label="Student support chat">
      <aside className="flex w-full flex-col border-b border-slate-200 bg-slate-50/70 lg:w-80 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between p-5">
          <div><h2 className="font-bold text-slate-900">Your questions</h2><p className="mt-1 text-xs text-slate-500">Private AI & TPO conversations</p></div>
          <button type="button" onClick={() => { selectedIdRef.current = null; setSelected(null); setDraft(""); }} className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"><Plus size={15}/> New</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {loading ? <p className="p-4 text-sm text-slate-500">Loading conversations…</p> : conversations.length === 0 ? <p className="p-4 text-sm leading-6 text-slate-500">Ask any question to get started. The Gemini AI mentor provides instant guidance on drives, eligibility, prep, and portal actions.</p> : conversations.map((item) => (
            <button key={item._id} type="button" onClick={() => chooseConversation(item._id)} className={`mb-2 w-full rounded-2xl border p-3 text-left transition ${selected?._id === item._id ? "border-blue-200 bg-blue-50" : "border-transparent bg-white hover:border-slate-200"}`}>
              <span className="block truncate text-sm font-semibold text-slate-800">{item.subject}</span>
              <span className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-500">{messageText(item.lastMessage)}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                  item.status === "bot_answered"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : item.status === "open"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : item.status === "answered"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-slate-100 text-slate-600"
                }`}>
                  {item.status === "bot_answered" ? "AI Answered" : item.status === "open" ? "TPO Queue" : item.status?.replace("_", " ")}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
            <Sparkles size={19}/>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-bold text-slate-900">{selected?.subject || "CampusFlow AI Support"}</h1>
            <p className="text-xs text-slate-500">Intelligent Gemini AI Mentor · Instant Answers</p>
          </div>
          {selected?.status === "open" ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold capitalize text-amber-800 border border-amber-200">
              In TPO support queue
            </span>
          ) : selected?.status === "bot_answered" ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <Sparkles size={12} className="text-emerald-600" />
              <span>AI Answered</span>
            </span>
          ) : null}
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-white to-slate-50/70 p-4 sm:p-6" aria-live="polite">
          {!selected && (
            <div className="mx-auto mt-10 max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white shadow-sm">
                <Sparkles size={25}/>
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">Ask CampusFlow AI Anything</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Ask about upcoming placement drives, personal eligibility, coding preparation, resume tips, or portal workflows. Gemini AI answers directly in real time.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setDraft("Am I eligible for upcoming placement drives?")} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700">Check my eligibility</button>
                <button type="button" onClick={() => setDraft("How do I apply for a placement drive?")} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700">How do I apply?</button>
                <button type="button" onClick={() => setDraft("What are the best tips to prepare for coding and technical rounds?")} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700">Interview prep tips</button>
                <button type="button" onClick={() => setDraft("Where can I update my placement profile?")} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700">Update my profile</button>
              </div>
            </div>
          )}
          {selected?.messages?.map((message) => {
            const mine = message.senderRole === "student";
            return (
              <div key={message._id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  mine
                    ? "order-2 bg-blue-600 text-white"
                    : message.senderRole === "admin"
                    ? "bg-indigo-600 text-white"
                    : "bg-gradient-to-tr from-indigo-500 to-blue-600 text-white shadow-xs"
                }`}>
                  {mine ? <UserRound size={15}/> : message.senderRole === "admin" ? <ShieldCheck size={16}/> : <Sparkles size={14}/>}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-xs ${
                  mine ? "order-1 rounded-br-md bg-blue-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                }`}>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  {message.senderRole === "assistant" && (
                    <span className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                      <Sparkles size={11} className="text-indigo-500" />
                      <span>Gemini AI Mentor</span>
                      {message.handoffRecommended && <span className="ml-1 text-amber-600 font-bold">· Escalated to TPO</span>}
                    </span>
                  )}
                  {message.senderRole === "admin" && (
                    <span className="mt-2 block text-[10px] font-bold text-indigo-700">Placement Officer (TPO)</span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={listEndRef}/>
        </div>
        {selected && selected.status !== "closed" && selected.status !== "open" && (
          <div className="border-t border-slate-100 px-4 pt-3">
            <button type="button" disabled={sending} onClick={askAdmin} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-60">
              <ShieldCheck size={15}/> Need human help? Ask a TPO administrator to review
            </button>
          </div>
        )}
        {selected?.status === "closed" && <div className="border-t border-slate-100 p-3 text-center text-xs text-slate-500">This conversation is closed. Sending a follow-up here will reopen it.</div>}
        <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 sm:p-4"><textarea aria-label="Your message" rows={2} maxLength={4000} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }} placeholder="Type your question… (Enter to send · Shift+Enter for a new line)" className="min-h-12 max-h-32 flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"/><button type="submit" disabled={!draft.trim() || sending} aria-label="Send message" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">{sending ? <LoaderCircle size={18} className="animate-spin"/> : <Send size={17}/>}</button></form>
      </div>
    </section>
  );
}
