import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, ShieldCheck, UserRound, Sparkles, MessageCircle, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { createSupportConversation, getMySupportConversations, getSupportConversation, requestAdminReply, sendSupportMessage } from "../../services/supportService";
import Markdown from "../ui/Markdown";
import ChatComposer, { TypingIndicator } from "../ui/ChatComposer";

const messageText = (message) => message?.content || "";

const STATUS_STYLES = {
  bot_answered: { label: "AI Answered", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  open: { label: "TPO Queue", className: "border-amber-200 bg-amber-50 text-amber-800" },
  answered: { label: "Answered", className: "border-blue-200 bg-blue-50 text-blue-700" },
};

const STARTERS = [
  { label: "Check my eligibility", prompt: "Am I eligible for upcoming placement drives?" },
  { label: "How do I apply?", prompt: "How do I apply for a placement drive?" },
  { label: "Interview prep tips", prompt: "What are the best tips to prepare for coding and technical rounds?" },
  { label: "Update my profile", prompt: "Where can I update my placement profile?" },
];

const formatTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function StudentSupportChat() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
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

  // Keep the conversation pinned to the newest message (scrolls the chat, not the page)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [selected?._id, selected?.messages?.length, pendingMessage]);

  const chooseConversation = async (id) => {
    try { const conversation = (await getSupportConversation(id)).data; selectedIdRef.current = conversation?._id || null; setSelected(conversation); }
    catch (error) { toast.error(error.response?.data?.message || "Could not open this conversation."); }
  };

  const send = async (event) => {
    event?.preventDefault?.();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setPendingMessage(content);
    setDraft("");
    try {
      const res = selected?._id
        ? await sendSupportMessage(selected._id, content)
        : await createSupportConversation(content);
      selectedIdRef.current = res.data.conversation?._id || null;
      setSelected(res.data.conversation);
      await loadList(true);
    } catch (error) {
      setDraft(content); // give the student their text back so nothing is lost
      toast.error(error.response?.data?.message || "Message could not be sent.");
    }
    finally { setSending(false); setPendingMessage(""); }
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

  const startNew = () => {
    selectedIdRef.current = null;
    setSelected(null);
    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <section className="mx-auto flex h-[min(780px,calc(100dvh-9rem))] min-h-[min(560px,calc(100dvh-9rem))] max-w-6xl flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-sm lg:flex-row" aria-label="Student support chat">
      {/* Conversation list */}
      <aside className="flex max-h-52 w-full shrink-0 flex-col border-b border-line bg-surface-muted/70 lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:p-5">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900">Your questions</h2>
            <p className="mt-0.5 text-xs text-slate-500">Private AI &amp; TPO conversations</p>
          </div>
          <button type="button" onClick={startNew} className="cf-btn cf-btn-primary shrink-0">
            <Plus size={15} /> New
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
          {loading ? (
            <div className="space-y-2" role="status" aria-label="Loading conversations">
              {[0, 1, 2].map((n) => (
                <div key={n} className="rounded-2xl bg-white p-3 ring-1 ring-line">
                  <div className="cf-skeleton h-3.5 w-2/3" />
                  <div className="cf-skeleton mt-2 h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-3 text-sm leading-6 text-slate-500">
              Ask any question to get started. The Groq AI mentor provides instant guidance on drives, eligibility, prep, and portal actions.
            </p>
          ) : (
            conversations.map((item) => {
              const status = STATUS_STYLES[item.status];
              const isSelected = selected?._id === item._id;
              return (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => chooseConversation(item._id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    isSelected ? "border-brand-200 bg-brand-50 shadow-xs" : "border-transparent bg-white hover:border-line-strong hover:shadow-xs"
                  }`}
                >
                  <span className="block truncate text-sm font-semibold text-slate-800">{item.subject}</span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-500">{messageText(item.lastMessage)}</span>
                    <span className={`cf-badge shrink-0 text-[10px]! capitalize ${status?.className || "bg-slate-100 text-slate-600"}`}>
                      {status?.label || item.status?.replace("_", " ")}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Conversation */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-sm">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-bold text-slate-900">{selected?.subject || "CampusFlow AI Support"}</h1>
            <p className="truncate text-xs text-slate-500">Intelligent Groq AI Mentor · Instant Answers</p>
          </div>
          {selected?.status === "open" ? (
            <span className="cf-badge shrink-0 border-amber-200 bg-amber-50 text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              <span className="hidden sm:inline">In TPO support queue</span>
              <span className="sm:hidden">TPO queue</span>
            </span>
          ) : selected?.status === "bot_answered" ? (
            <span className="cf-badge shrink-0 border-emerald-200 bg-emerald-50 text-emerald-800">
              <Sparkles size={12} className="text-emerald-600" />
              <span>AI Answered</span>
            </span>
          ) : null}
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-white to-surface-muted/70" aria-live="polite">
          <div className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
            {!selected && !pendingMessage && (
              <div className="mx-auto mt-6 max-w-md text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-600/20">
                  <Sparkles size={24} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">Ask CampusFlow AI Anything</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Ask about upcoming placement drives, personal eligibility, coding preparation, resume tips, or portal workflows. Groq AI answers directly in real time.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      onClick={() => { setDraft(starter.prompt); inputRef.current?.focus(); }}
                      className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-600 shadow-xs transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700"
                    >
                      <MessageCircle size={14} className="shrink-0 text-brand-500" />
                      {starter.label}
                    </button>
                  ))}
                </div>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <Lock size={11} /> Conversations are private to you and the TPO office.
                </p>
              </div>
            )}

            {selected?.messages?.map((message) => {
              const mine = message.senderRole === "student";
              const isAdmin = message.senderRole === "admin";
              if (mine) {
                return (
                  <div key={message._id} className="flex justify-end animate-message">
                    <div className="max-w-[min(85%,34rem)]">
                      <div className="rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm leading-6 text-white shadow-sm">
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                      <p className="mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold text-slate-400">
                        <UserRound size={11} /> You {message.createdAt && `· ${formatTime(message.createdAt)}`}
                      </p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={message._id} className="flex items-start gap-3 animate-message">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${
                      isAdmin ? "bg-indigo-600" : "bg-gradient-to-br from-brand-500 to-indigo-600"
                    }`}
                    aria-hidden="true"
                  >
                    {isAdmin ? <ShieldCheck size={16} /> : <Sparkles size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      {isAdmin ? <span className="text-indigo-700">Placement Officer (TPO)</span> : <span>Groq AI Mentor</span>}
                      {message.createdAt && <span className="font-medium text-slate-400">{formatTime(message.createdAt)}</span>}
                      {message.handoffRecommended && (
                        <span className="cf-badge border-amber-200 bg-amber-50 text-[10px]! text-amber-700">Escalated to TPO</span>
                      )}
                    </p>
                    <div
                      className={`rounded-2xl rounded-tl-md border px-4 py-3 shadow-xs sm:px-5 ${
                        isAdmin ? "border-indigo-200 bg-indigo-50/40" : "border-line bg-white"
                      }`}
                    >
                      <Markdown content={message.content} />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Optimistic echo + typing state while the reply is generated */}
            {pendingMessage && (
              <>
                <div className="flex justify-end animate-message">
                  <div className="max-w-[min(85%,34rem)] rounded-2xl rounded-br-md bg-brand-600/85 px-4 py-2.5 text-sm leading-6 text-white">
                    <p className="whitespace-pre-wrap break-words">{pendingMessage}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 animate-message">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-sm">
                    <Sparkles size={14} />
                  </div>
                  <div className="rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 shadow-xs">
                    <TypingIndicator label="AI mentor is writing a reply…" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {selected && selected.status !== "closed" && selected.status !== "open" && (
          <div className="shrink-0 border-t border-line px-4 pt-3">
            <button
              type="button"
              disabled={sending}
              onClick={askAdmin}
              className="inline-flex max-w-full items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-xs font-bold text-indigo-800 transition hover:bg-indigo-100 disabled:opacity-60"
            >
              <ShieldCheck size={15} className="shrink-0" />
              <span>Need human help? Ask a TPO administrator to review</span>
            </button>
          </div>
        )}
        {selected?.status === "closed" && (
          <div className="shrink-0 border-t border-line p-3 text-center text-xs text-slate-500">
            This conversation is closed. Sending a follow-up here will reopen it.
          </div>
        )}
        <ChatComposer
          inputRef={inputRef}
          label="Your message"
          value={draft}
          onChange={setDraft}
          onSubmit={send}
          busy={sending}
          placeholder="Type your question…"
        />
      </div>
    </section>
  );
}
