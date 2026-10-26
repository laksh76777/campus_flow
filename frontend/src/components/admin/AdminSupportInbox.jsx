import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Inbox,
  MessageCircle,
  RotateCcw,
  UserRound,
  Sparkles,
  Bot,
  Briefcase,
  Workflow,
  ExternalLink,
  ShieldCheck,
  FileText,
  BarChart3,
  Target,
  Rocket,
  Pencil,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  getAdminSupportInbox,
  getSupportConversation,
  sendAdminSupportReply,
  updateSupportStatus,
  sendAdminCopilotPrompt,
} from "../../services/supportService";
import Markdown from "../ui/Markdown";
import ChatComposer, { TypingIndicator } from "../ui/ChatComposer";

const TICKET_FILTERS = ["open", "answered", "bot_answered", "closed", "all"];

const STATUS_BADGE = {
  open: "border-amber-200 bg-amber-50 text-amber-800",
  answered: "border-blue-200 bg-blue-50 text-blue-700",
  bot_answered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-slate-200 bg-slate-100 text-slate-600",
};

const formatTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// Keep a scrollable chat pinned to the newest message without scrolling the page.
function useScrollToBottom(dependency) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [dependency]);
  return ref;
}

export default function AdminSupportInbox() {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState("inbox"); // "inbox" | "copilot"

  // Inbox State
  const [filter, setFilter] = useState("open");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const selectedIdRef = useRef(null);

  // Copilot State
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const copilotMessageSequence = useRef(0);
  const copilotInputRef = useRef(null);
  const [copilotHistory, setCopilotHistory] = useState([
    {
      id: "welcome",
      sender: "bot",
      content:
        "👋 **Welcome to the TPO AI Operations Copilot!**\n\nI can automate several placement tasks directly from your prompt:\n\n" +
        "• **Host Placement Drives:** E.g., *\"Host a drive for Microsoft, Role: SDE, 18 LPA, 7.5 CGPA cutoff, 0 backlogs, CSE/ISE\"*\n" +
        "• **Automated Pipeline Drives:** E.g., *\"Create an automated drive for Google with 3 selection rounds: Aptitude, Tech, HR\"*\n" +
        "• **Directory & Analytics:** E.g., *\"How many students have CGPA above 8.0?\"* or *\"Show pending academic verifications\"*\n" +
        "• **Job Description (JD) Parsing:** Paste any text copied from a JD PDF to extract criteria and provision the drive.",
      createdAt: new Date(),
    },
  ]);
  const copilotScrollRef = useScrollToBottom(`${copilotHistory.length}-${copilotLoading}-${activeMode}`);
  const ticketScrollRef = useScrollToBottom(`${selected?._id}-${selected?.messages?.length}-${activeMode}`);

  // Refresh inbox
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
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load the support inbox.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(refresh, 12000);
    return () => clearInterval(timer);
  }, [refresh]);

  const openTicket = async (id) => {
    try {
      const conversation = (await getSupportConversation(id)).data;
      selectedIdRef.current = conversation?._id || null;
      setSelected(conversation);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not open this ticket.");
    }
  };

  const replyTicket = async (event) => {
    event?.preventDefault?.();
    if (!selected?._id || !draft.trim() || sending) return;
    setSending(true);
    try {
      const result = await sendAdminSupportReply(selected._id, draft.trim());
      setSelected(result.data);
      setDraft("");
      await refresh();
      toast.success("Reply sent to the student.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Reply could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const toggleTicketStatus = async () => {
    if (!selected?._id) return;
    try {
      const result = await updateSupportStatus(
        selected._id,
        selected.status === "closed" ? "open" : "closed"
      );
      setSelected(result.data);
      await refresh();
      toast.success(`Ticket marked as ${result.data?.status || "updated"}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update conversation status.");
    }
  };

  // Submit Copilot prompt
  const submitCopilotPrompt = async (promptText) => {
    const textToSend = typeof promptText === "string" ? promptText : copilotPrompt;
    if (!textToSend.trim() || copilotLoading) return;
    const messageSequence = ++copilotMessageSequence.current;

    const userMsg = {
      id: `user_${messageSequence}`,
      sender: "admin",
      content: textToSend.trim(),
      createdAt: new Date(),
    };

    const updatedHistory = [...copilotHistory, userMsg];
    setCopilotHistory(updatedHistory);
    setCopilotPrompt("");
    setCopilotLoading(true);

    try {
      const recentHistory = copilotHistory.slice(-8).map(({ sender, content, action, driveParams }) => ({
        sender,
        content: String(content || "").slice(0, 1200),
        ...(sender === "bot" && action === "DRIVE_READY" ? { action, driveParams } : {}),
      }));
      const res = await sendAdminCopilotPrompt(textToSend.trim(), recentHistory);
      const botResponse = res?.data;
      if (typeof botResponse?.answer !== "string" || !botResponse.answer.trim()) {
        throw new Error("The copilot returned an empty response. No action was confirmed.");
      }

      const botMsg = {
        id: `bot_${messageSequence}`,
        sender: "bot",
        content: botResponse.answer,
        action: botResponse?.action,
        driveId: botResponse?.driveId,
        driveTitle: botResponse?.driveTitle,
        metadata: botResponse?.metadata,
        driveParams: botResponse?.driveParams,
        createdAt: new Date(),
      };

      setCopilotHistory((prev) => [...prev, botMsg]);

      if (botResponse?.action === "DRIVE_CREATED") {
        toast.success(`Placement Drive created: ${botResponse?.driveTitle || "New Drive"}`);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Could not execute Copilot action.";
      setCopilotHistory((prev) => [
        ...prev,
        {
          id: `bot_err_${messageSequence}`,
          sender: "bot",
          content: `⚠️ ${errMsg}`,
          isError: true,
          retryPrompt: textToSend.trim(),
          createdAt: new Date(),
        },
      ]);
      toast.error(errMsg);
    } finally {
      setCopilotLoading(false);
    }
  };

  const quickPills = [
    {
      label: "Host drive (interactive)",
      icon: Target,
      prompt: "I want to host a new placement drive, please guide me through the criteria",
    },
    {
      label: "Extract JD criteria",
      icon: FileText,
      prompt: "I have a Job Description (JD) text from a recruiter. Can you extract the criteria and stage the drive?",
    },
    {
      label: "Automated drive: Google (3 rounds)",
      icon: Workflow,
      prompt: "Create an automated drive for Google with 3 rounds: Online Coding, Technical Round 1, Leadership Round, Package: 22 LPA, Min CGPA: 8.0, 0 backlogs, CSE and ISE",
    },
    {
      label: "Talent pool & CGPA stats",
      icon: BarChart3,
      prompt: "How many students are verified and how many have CGPA above 8.0?",
    },
  ];

  const openTicketCount = items.filter((i) => i.status === "open").length;
  const showQuickStart = copilotHistory.length === 1 && !copilotLoading;

  return (
    <div className="space-y-4">
      {/* Header & mode switcher */}
      <div className="cf-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
            {activeMode === "copilot" ? <Sparkles size={19} /> : <Inbox size={19} />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {activeMode === "copilot" ? "TPO AI Operations Copilot" : "Student Support Inbox"}
              </h2>
              {activeMode === "copilot" && (
                <span className="cf-badge border-indigo-200 bg-indigo-50 text-indigo-700">AI Powered</span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {activeMode === "copilot"
                ? "Prompt-driven drive creation, automated pipelines, student queries, and JD parsing"
                : "Review assistant escalations and answer private student placement tickets"}
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div
          role="tablist"
          aria-label="Support workspace mode"
          className="relative grid shrink-0 grid-cols-2 gap-1 self-start rounded-xl border border-line bg-slate-100/80 p-1 sm:self-auto"
        >
          <span
            aria-hidden="true"
            className={`absolute inset-y-1 left-1 w-[calc(50%-0.375rem)] rounded-lg shadow-sm transition-all duration-300 ease-out-soft ${
              activeMode === "copilot" ? "translate-x-[calc(100%+0.25rem)] bg-indigo-600" : "translate-x-0 bg-white"
            }`}
          />
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === "inbox"}
            onClick={() => setActiveMode("inbox")}
            className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors duration-200 ${
              activeMode === "inbox" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Inbox size={14} />
            <span>Student Tickets</span>
            {openTicketCount > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-black leading-4 text-white tabular-nums">
                {openTicketCount}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeMode === "copilot"}
            onClick={() => setActiveMode("copilot")}
            className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors duration-200 ${
              activeMode === "copilot" ? "text-white" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles size={14} />
            <span>TPO AI Copilot</span>
          </button>
        </div>
      </div>

      {activeMode === "copilot" ? (
        /* Copilot workspace */
        <section
          className="flex h-[min(780px,calc(100dvh-13rem))] min-h-[520px] w-full flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-sm animate-in fade-in duration-300"
          aria-label="TPO AI Copilot"
        >
          {/* Quick prompts (always available; shown as cards on a fresh conversation) */}
          {!showQuickStart && (
            <div className="scrollbar-none flex items-center gap-2 overflow-x-auto border-b border-line bg-surface-muted/80 px-4 py-2.5">
              <span className="cf-eyebrow shrink-0 text-[10px]!">Quick prompts</span>
              {quickPills.map((pill) => {
                const Icon = pill.icon;
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => submitCopilotPrompt(pill.prompt)}
                    disabled={copilotLoading}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 disabled:opacity-50"
                  >
                    <Icon size={13} className="text-indigo-500" />
                    {pill.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Conversation */}
          <div
            ref={copilotScrollRef}
            className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-surface-muted/60 to-white"
            aria-live="polite"
          >
            <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
              {copilotHistory.map((msg) =>
                msg.sender === "admin" ? (
                  <div key={msg.id} className="flex justify-end animate-message">
                    <div className="max-w-[min(85%,36rem)]">
                      <div className="rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm leading-6 text-white shadow-sm">
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <p className="mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold text-slate-400">
                        <ShieldCheck size={11} /> Placement Officer · {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex items-start gap-3 animate-message">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${
                        msg.isError ? "bg-rose-500" : "bg-gradient-to-br from-indigo-500 to-violet-600"
                      }`}
                      aria-hidden="true"
                    >
                      {msg.isError ? <AlertTriangle size={15} /> : <Bot size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[11px] font-bold text-slate-500">
                        TPO AI Copilot
                        <span className="ml-1.5 font-medium text-slate-400">{formatTime(msg.createdAt)}</span>
                      </p>

                      {msg.isError ? (
                        <div className="rounded-2xl rounded-tl-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                          <p className="font-semibold">The copilot couldn’t complete this request.</p>
                          <p className="mt-0.5 break-words text-rose-700">{msg.content.replace(/^⚠️\s*/, "")}</p>
                          {msg.retryPrompt && (
                            <button
                              type="button"
                              onClick={() => submitCopilotPrompt(msg.retryPrompt)}
                              disabled={copilotLoading}
                              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                            >
                              <RotateCcw size={13} /> Try again
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 shadow-xs sm:px-5">
                          <Markdown content={msg.content} />
                        </div>
                      )}

                      {/* Staged placement drive awaiting confirmation */}
                      {msg.action === "DRIVE_READY" && msg.driveParams && (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50/60 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                                <Briefcase size={15} />
                              </span>
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-extrabold text-slate-900">
                                  {msg.driveParams.companyName || "Corporate Partner"}
                                </h4>
                                <p className="truncate text-xs font-semibold text-indigo-700">
                                  {msg.driveParams.jobTitle || "Software Engineer"}
                                </p>
                              </div>
                            </div>
                            <span className="cf-badge border-indigo-200 bg-white text-indigo-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                              Staged · Awaiting approval
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 p-4 text-xs sm:grid-cols-3">
                            <div className="rounded-xl border border-line bg-surface-muted p-2.5">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Package (CTC)</span>
                              <span className="text-sm font-black text-emerald-700 tabular-nums">₹{msg.driveParams.package} LPA</span>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-2.5">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">CGPA Cutoff</span>
                              <span className="text-sm font-black text-slate-800 tabular-nums">≥ {msg.driveParams.minimumCGPA}</span>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-2.5">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Max Backlogs</span>
                              <span className="text-sm font-black text-slate-800 tabular-nums">≤ {msg.driveParams.maximumBacklogs}</span>
                            </div>
                            <div className="col-span-2 rounded-xl border border-line bg-surface-muted p-2.5 sm:col-span-3">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Programs</span>
                              <span className="text-xs font-medium text-slate-700">
                                {Array.isArray(msg.driveParams.eligibleBranches)
                                  ? msg.driveParams.eligibleBranches.join(", ")
                                  : msg.driveParams.eligibleBranches || "Not specified"}
                              </span>
                            </div>
                            {Array.isArray(msg.driveParams.rounds) && msg.driveParams.rounds.length > 0 && (
                              <div className="col-span-2 rounded-xl border border-line bg-surface-muted p-2.5 sm:col-span-3">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Selection Pipeline</span>
                                <ol className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  {msg.driveParams.rounds.map((r, i) => (
                                    <li
                                      key={i}
                                      className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-bold text-indigo-700"
                                    >
                                      <span className="text-indigo-400">{r.roundNumber || i + 1}.</span> {r.roundName}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                            <div className="col-span-2 grid grid-cols-1 gap-2 sm:col-span-3 sm:grid-cols-3">
                              {[
                                ["Applications open", msg.driveParams.applicationStartDate],
                                ["Application deadline", msg.driveParams.applicationDeadline],
                                ["Drive date", msg.driveParams.driveDate],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-xl border border-line bg-surface-muted p-2.5">
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                                  <span className="text-xs font-semibold text-slate-800">
                                    {value && !Number.isNaN(new Date(value).getTime())
                                      ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
                                      : "Not set"}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="col-span-2 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-5 text-amber-900 sm:col-span-3">
                              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                              <span>
                                These are the portal’s default dates. Review them before publishing; the drive date is four days after the default ten-day application window.
                              </span>
                            </div>
                            {msg.driveParams.eligibleCount !== null && msg.driveParams.eligibleCount !== undefined && (
                              <div className="col-span-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 sm:col-span-3">
                                <Target size={14} className="shrink-0 text-emerald-600" />
                                <span>
                                  <strong className="tabular-nums">{msg.driveParams.eligibleCount} verified students</strong> meet these criteria and qualify immediately.
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-muted/60 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => submitCopilotPrompt("Yes, confirm and publish this drive live!")}
                              disabled={copilotLoading}
                              className="cf-btn bg-indigo-600 text-white shadow-sm shadow-indigo-600/25 hover:bg-indigo-700"
                            >
                              <Rocket size={14} />
                              <span>Confirm &amp; Publish Drive Live</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCopilotPrompt(`Change criteria for ${msg.driveParams.companyName || "the drive"}: `);
                                copilotInputRef.current?.focus();
                              }}
                              className="cf-btn cf-btn-secondary"
                            >
                              <Pencil size={13} />
                              <span>Adjust Criteria</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Drive created via copilot */}
                      {msg.action === "DRIVE_CREATED" && msg.driveId && (
                        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-emerald-900">
                              <Briefcase size={14} className="shrink-0" />
                              <span className="truncate">{msg.driveTitle || "New Placement Drive"}</span>
                            </span>
                            <span className="cf-badge border-emerald-300 bg-emerald-100 text-emerald-800">
                              <Check size={11} /> Live &amp; Published
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => navigate("/admin/drives")}
                              className="cf-btn bg-emerald-700 text-white hover:bg-emerald-800"
                            >
                              <ExternalLink size={13} />
                              <span>Manage Drive</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate("/admin/automated-placement-drives")}
                              className="cf-btn border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"
                            >
                              <Workflow size={13} />
                              <span>View Pipeline</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* Starter cards on a fresh conversation */}
              {showQuickStart && (
                <div className="grid grid-cols-1 gap-2.5 pl-0 sm:grid-cols-2 sm:pl-11">
                  {quickPills.map((pill) => {
                    const Icon = pill.icon;
                    return (
                      <button
                        key={pill.label}
                        type="button"
                        onClick={() => submitCopilotPrompt(pill.prompt)}
                        className="cf-card cf-card-interactive group flex items-start gap-3 p-3.5 text-left animate-message"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-slate-900">{pill.label}</span>
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-slate-500">{pill.prompt}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {copilotLoading && (
                <div className="flex items-start gap-3 animate-message">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                    <Bot size={16} />
                  </div>
                  <div className="rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 shadow-xs">
                    <TypingIndicator label="Copilot is processing drive specifications and data…" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <ChatComposer
            inputRef={copilotInputRef}
            tone="violet"
            label="TPO prompt input"
            sendLabel="Send prompt to Copilot"
            value={copilotPrompt}
            onChange={setCopilotPrompt}
            onSubmit={() => submitCopilotPrompt()}
            busy={copilotLoading}
            placeholder="Ask about students, or type “Host a drive for [Company], [Role], [Package] LPA, [Cutoff] CGPA”…"
          />
        </section>
      ) : (
        /* Student support tickets */
        <section
          className="flex h-[min(780px,calc(100dvh-13rem))] min-h-[560px] w-full flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-sm animate-in fade-in duration-300 lg:flex-row"
          aria-label="Student support inbox"
        >
          {/* Ticket list */}
          <aside
            className={`flex min-h-0 w-full shrink-0 flex-col border-line bg-surface-muted/70 lg:w-96 lg:border-r ${
              selected ? "hidden lg:flex" : "flex flex-1 lg:flex-none"
            }`}
          >
            <div className="flex items-center gap-3 border-b border-line p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Inbox size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Student Tickets</h3>
                <p className="text-[11px] text-slate-500">Student escalations and TPO queries</p>
              </div>
            </div>

            <div className="scrollbar-none flex gap-1 overflow-x-auto p-2.5" role="tablist" aria-label="Ticket status filter">
              {TICKET_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={filter === status}
                  onClick={() => setFilter(status)}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold capitalize transition ${
                    filter === status
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-500 ring-1 ring-line hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  {status.replace("_", " ")}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-2.5">
              {loading ? (
                <div className="space-y-2 p-1" role="status" aria-label="Loading inbox">
                  {[0, 1, 2].map((n) => (
                    <div key={n} className="rounded-2xl bg-white p-3 ring-1 ring-line">
                      <div className="cf-skeleton h-3.5 w-1/2" />
                      <div className="cf-skeleton mt-2 h-3 w-3/4" />
                      <div className="cf-skeleton mt-2 h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Inbox size={26} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">No conversations here</p>
                  <p className="mt-0.5 text-xs text-slate-400">Try another status filter.</p>
                </div>
              ) : (
                items.map((item) => {
                  const isSelected = selected?._id === item._id;
                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => openTicket(item._id)}
                      aria-current={isSelected ? "true" : undefined}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        isSelected
                          ? "border-indigo-200 bg-indigo-50 shadow-xs"
                          : "border-transparent bg-white hover:border-line-strong hover:shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-slate-800">
                          {item.student?.fullName || "Student"}
                        </span>
                        {item.unreadCount > 0 && (
                          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white tabular-nums">
                            {item.unreadCount}
                          </span>
                        )}
                      </div>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {item.student?.email || "Student account"}
                      </span>
                      <span className="mt-1.5 block truncate text-xs font-semibold text-slate-700">{item.subject}</span>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-slate-500">{item.lastMessage?.content}</span>
                        <span className={`cf-badge shrink-0 text-[10px]! capitalize ${STATUS_BADGE[item.status] || STATUS_BADGE.closed}`}>
                          {item.status.replace("_", " ")}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Ticket detail & reply */}
          <div className={`min-h-0 min-w-0 flex-1 flex-col ${selected ? "flex" : "hidden lg:flex"}`}>
            <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
              {selected && (
                <button
                  type="button"
                  onClick={() => {
                    selectedIdRef.current = null;
                    setSelected(null);
                  }}
                  className="cf-icon-btn lg:hidden"
                  aria-label="Back to ticket list"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 lg:flex">
                <MessageCircle size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-slate-900">
                  {selected?.subject || "Select a student question"}
                </h3>
                <p className="truncate text-xs text-slate-500">
                  {selected?.student?.fullName || selected?.student?.email || "Choose a ticket to respond"}
                </p>
              </div>
              {selected && (
                <button type="button" onClick={toggleTicketStatus} className="cf-btn cf-btn-secondary">
                  {selected.status === "closed" ? (
                    "Reopen"
                  ) : (
                    <>
                      <Check size={14} /> Close Ticket
                    </>
                  )}
                </button>
              )}
            </header>

            <div ref={ticketScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-surface-muted/60" aria-live="polite">
              <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
                {!selected ? (
                  <div className="mx-auto mt-14 max-w-sm text-center">
                    <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-300 ring-1 ring-line">
                      <UserRound size={24} />
                    </span>
                    <p className="text-sm font-semibold text-slate-600">No ticket selected</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Choose a ticket from the list to review the assistant context and reply to the student.
                    </p>
                  </div>
                ) : (
                  selected.messages?.map((message) => {
                    const fromStudent = message.senderRole === "student";
                    const fromAssistant = message.senderRole === "assistant";
                    return (
                      <div key={message._id} className={`flex animate-message ${fromStudent ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[min(88%,40rem)] rounded-2xl px-4 py-3 text-sm leading-6 ${
                            fromStudent
                              ? "rounded-br-md bg-indigo-600 text-white shadow-sm"
                              : "rounded-bl-md border border-line bg-white text-slate-700 shadow-xs"
                          }`}
                        >
                          {fromAssistant ? (
                            <Markdown content={message.content} />
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          )}
                          <span
                            className={`mt-2 flex flex-wrap items-center gap-1 text-[10px] font-semibold ${
                              fromStudent ? "text-indigo-100" : "text-slate-400"
                            }`}
                          >
                            {fromAssistant && <Sparkles size={11} className="text-indigo-400" />}
                            {fromAssistant
                              ? `CampusFlow assistant${
                                  message.confidence != null ? ` · ${Math.round(message.confidence * 100)}% confidence` : ""
                                }`
                              : message.senderRole === "admin"
                              ? "TPO administrator"
                              : "Student"}
                            {message.handoffRecommended && <span className="font-bold text-amber-600"> · Escalated to TPO</span>}
                            {message.createdAt && <span className="font-medium opacity-80">· {formatTime(message.createdAt)}</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {selected && selected.status !== "closed" && (
              <ChatComposer
                tone="violet"
                label="Administrator reply"
                sendLabel="Send reply"
                value={draft}
                onChange={setDraft}
                onSubmit={replyTicket}
                busy={sending}
                placeholder="Write an official confirmed answer for the student…"
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
