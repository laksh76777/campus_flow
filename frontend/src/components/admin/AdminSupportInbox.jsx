import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Inbox,
  LoaderCircle,
  MessageCircle,
  Send,
  UserRound,
  Sparkles,
  Bot,
  Briefcase,
  Workflow,
  ExternalLink,
  ShieldCheck,
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
  const copilotEndRef = useRef(null);

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

  useEffect(() => {
    if (activeMode === "copilot") {
      copilotEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [copilotHistory, activeMode]);

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
    event.preventDefault();
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
    const textToSend = promptText || copilotPrompt;
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
      label: "🎯 Host Drive (Interactive)",
      prompt: "I want to host a new placement drive, please guide me through the criteria",
    },
    {
      label: "📄 Paste / Extract JD Criteria",
      prompt: "I have a Job Description (JD) text from a recruiter. Can you extract the criteria and stage the drive?",
    },
    {
      label: "⚡ Automated Drive: Google (3 Rounds)",
      prompt: "Create an automated drive for Google with 3 rounds: Online Coding, Technical Round 1, Leadership Round, Package: 22 LPA, Min CGPA: 8.0, 0 backlogs, CSE and ISE",
    },
    {
      label: "📊 Talent Pool & CGPA Statistics",
      prompt: "How many students are verified and how many have CGPA above 8.0?",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20">
            {activeMode === "copilot" ? <Sparkles size={20} /> : <Inbox size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {activeMode === "copilot" ? "TPO AI Operations Copilot" : "Student Support Inbox"}
              </h2>
              {activeMode === "copilot" && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700 border border-indigo-200">
                  AI Powered
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {activeMode === "copilot"
                ? "Prompt-driven drive creation, automated pipelines, student queries, and JD parsing"
                : "Review assistant escalations and answer private student placement tickets"}
            </p>
          </div>
        </div>

        {/* Mode Toggle Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveMode("inbox")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeMode === "inbox"
                ? "bg-white text-slate-800 shadow-2xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Inbox size={14} />
            <span>Student Tickets</span>
            {items.filter((i) => i.status === "open").length > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-black text-white">
                {items.filter((i) => i.status === "open").length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("copilot")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeMode === "copilot"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles size={14} />
            <span>TPO AI Copilot</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      {activeMode === "copilot" ? (
        /* Copilot AI Workspace */
        <section
          className="flex h-[min(760px,calc(100vh-14rem))] min-h-[540px] w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          aria-label="TPO AI Copilot"
        >
          {/* Quick Action Pills */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 scrollbar-none">
            <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Quick Prompts:
            </span>
            {quickPills.map((pill, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => submitCopilotPrompt(pill.prompt)}
                disabled={copilotLoading}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 transition disabled:opacity-50"
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Conversation Area */}
          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4 sm:p-6" aria-live="polite">
            {copilotHistory.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    msg.sender === "admin"
                      ? "rounded-br-md bg-indigo-600 text-white shadow-xs"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {msg.sender === "bot" ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
                        <Bot size={12} />
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500 text-white">
                        <ShieldCheck size={12} />
                      </div>
                    )}
                    <span
                      className={`text-[10px] font-bold ${
                        msg.sender === "admin" ? "text-indigo-100" : "text-slate-400"
                      }`}
                    >
                      {msg.sender === "admin" ? "Placement Officer" : "TPO AI Copilot"}
                    </span>
                  </div>

                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                  {/* Staged Placement Drive - Ready for Admin Confirmation */}
                  {msg.action === "DRIVE_READY" && msg.driveParams && (
                    <div className="mt-3 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/70 p-4 text-slate-800 shadow-xs">
                      <div className="flex items-center justify-between gap-2 border-b border-indigo-100 pb-2.5 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                            <Briefcase size={15} />
                          </span>
                          <div>
                            <h4 className="text-sm font-extrabold text-slate-900">
                              {msg.driveParams.companyName || "Corporate Partner"}
                            </h4>
                            <p className="text-xs text-indigo-700 font-semibold">
                              {msg.driveParams.jobTitle || "Software Engineer"}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-black text-indigo-800 border border-indigo-300">
                          ⚡ Staged · Awaiting Approval
                        </span>
                      </div>

                      {/* Criteria Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-3">
                        <div className="bg-white/80 p-2 rounded-xl border border-indigo-100/80">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Package (CTC)</span>
                          <span className="text-xs font-black text-emerald-700">₹{msg.driveParams.package} LPA</span>
                        </div>
                        <div className="bg-white/80 p-2 rounded-xl border border-indigo-100/80">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">CGPA Cutoff</span>
                          <span className="text-xs font-black text-slate-800">≥ {msg.driveParams.minimumCGPA}</span>
                        </div>
                        <div className="bg-white/80 p-2 rounded-xl border border-indigo-100/80">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Max Backlogs</span>
                          <span className="text-xs font-black text-slate-800">≤ {msg.driveParams.maximumBacklogs}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-3 bg-white/80 p-2 rounded-xl border border-indigo-100/80">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Target Programs</span>
                          <span className="text-xs font-medium text-slate-700">
                            {Array.isArray(msg.driveParams.eligibleBranches)
                              ? msg.driveParams.eligibleBranches.join(", ")
                              : msg.driveParams.eligibleBranches || "Not specified"}
                          </span>
                        </div>
                        {Array.isArray(msg.driveParams.rounds) && msg.driveParams.rounds.length > 0 && (
                          <div className="col-span-2 sm:col-span-3 bg-white/80 p-2 rounded-xl border border-indigo-100/80">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Selection Pipeline</span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {msg.driveParams.rounds.map((r, i) => (
                                <span key={i} className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                                  <span>{r.roundNumber || i + 1}.</span> {r.roundName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="col-span-2 sm:col-span-3 grid gap-2 sm:grid-cols-3">
                          {[
                            ["Applications open", msg.driveParams.applicationStartDate],
                            ["Application deadline", msg.driveParams.applicationDeadline],
                            ["Drive date", msg.driveParams.driveDate],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-indigo-100/80 bg-white/80 p-2">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                              <span className="text-xs font-semibold text-slate-800">
                                {value && !Number.isNaN(new Date(value).getTime())
                                  ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
                                  : "Not set"}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="col-span-2 sm:col-span-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
                          These are the portal’s default dates. Review them before publishing; the drive date is four days after the default ten-day application window.
                        </div>
                        {msg.driveParams.eligibleCount !== null && msg.driveParams.eligibleCount !== undefined && (
                          <div className="col-span-2 sm:col-span-3 bg-emerald-50/80 p-2 rounded-xl border border-emerald-200">
                            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                              🎯 <strong>{msg.driveParams.eligibleCount} verified students</strong> meet these criteria and qualify immediately.
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action Confirmation Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => submitCopilotPrompt("Yes, confirm and publish this drive live!")}
                          disabled={copilotLoading}
                          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-black text-white hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-600/30 transition disabled:opacity-50"
                        >
                          <span>🚀 Confirm & Publish Drive Live</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCopilotPrompt(`Change criteria for ${msg.driveParams.companyName || "the drive"}: `);
                          }}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                        >
                          <span>✏️ Adjust Criteria</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* If a Placement Drive was created via Copilot */}
                  {msg.action === "DRIVE_CREATED" && msg.driveId && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-slate-800">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
                          <Briefcase size={14} />
                          <span>{msg.driveTitle || "New Placement Drive"}</span>
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-800 border border-emerald-300">
                          Live & Published
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => navigate("/admin/drives")}
                          className="flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-800 transition"
                        >
                          <ExternalLink size={12} />
                          <span>Manage Drive</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate("/admin/automated-placement-drives")}
                          className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition"
                        >
                          <Workflow size={12} />
                          <span>View Pipeline</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {copilotLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-500 shadow-2xs">
                  <LoaderCircle size={16} className="animate-spin text-indigo-600" />
                  <span>AI Copilot is processing drive specifications and data...</span>
                </div>
              </div>
            )}
            <div ref={copilotEndRef} />
          </div>

          {/* Prompt Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitCopilotPrompt();
            }}
            className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 sm:p-4"
          >
            <textarea
              aria-label="TPO prompt input"
              rows={2}
              maxLength={4000}
              value={copilotPrompt}
              onChange={(e) => setCopilotPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitCopilotPrompt();
                }
              }}
              placeholder="Ask anything about students, or type 'Host a drive for [Company] with [Role], [Package] LPA, [Cutoff] CGPA'…"
              className="min-h-12 flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!copilotPrompt.trim() || copilotLoading}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300 transition"
              aria-label="Send prompt to Copilot"
            >
              {copilotLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={17} />}
            </button>
          </form>
        </section>
      ) : (
        /* Student Support Tickets View */
        <section
          className="flex h-[min(760px,calc(100vh-14rem))] min-h-[540px] w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:flex-row"
          aria-label="Student support inbox"
        >
          {/* Left Tickets List */}
          <aside className="flex w-full flex-col border-b border-slate-200 bg-slate-50/70 lg:w-96 lg:border-b-0 lg:border-r shrink-0">
            <div className="flex items-center gap-3 p-4 border-b border-slate-200/80">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Inbox size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Student Tickets</h3>
                <p className="text-[11px] text-slate-500">Student escalations and TPO queries</p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 p-2.5 overflow-x-auto">
              {["open", "answered", "bot_answered", "closed", "all"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition shrink-0 ${
                    filter === status
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "bg-white text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {status.replace("_", " ")}
                </button>
              ))}
            </div>

            {/* Tickets Scroll List */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5">
              {loading ? (
                <p className="p-4 text-sm text-slate-500">Loading inbox…</p>
              ) : items.length === 0 ? (
                <div className="p-5 text-center text-sm text-slate-500">
                  No conversations found in this view.
                </div>
              ) : (
                items.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => openTicket(item._id)}
                    className={`mb-2 w-full rounded-2xl border p-3 text-left transition ${
                      selected?._id === item._id
                        ? "border-indigo-200 bg-indigo-50"
                        : "border-transparent bg-white hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-slate-800">
                        {item.student?.fullName || "Student"}
                      </span>
                      {item.unreadCount > 0 && (
                        <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                          {item.unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {item.student?.email || "Student account"}
                    </span>
                    <span className="mt-1.5 block truncate text-xs font-semibold text-slate-700">
                      {item.subject}
                    </span>
                    <div className="mt-1 flex justify-between gap-2">
                      <span className="truncate text-[11px] text-slate-500">
                        {item.lastMessage?.content}
                      </span>
                      <span className="shrink-0 text-[10px] capitalize text-slate-400">
                        {item.status.replace("_", " ")}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Right Ticket Detail & Reply */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <MessageCircle size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold text-sm text-slate-900">
                  {selected?.subject || "Select a student question"}
                </h3>
                <p className="truncate text-xs text-slate-500">
                  {selected?.student?.fullName || selected?.student?.email || "Choose a ticket to respond"}
                </p>
              </div>
              {selected && (
                <button
                  type="button"
                  onClick={toggleTicketStatus}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  {selected.status === "closed" ? "Reopen" : <><Check size={14} /> Close Ticket</>}
                </button>
              )}
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4 sm:p-6" aria-live="polite">
              {!selected ? (
                <div className="mx-auto mt-12 max-w-sm text-center text-sm leading-6 text-slate-500">
                  <UserRound size={28} className="mx-auto mb-3 text-slate-300" />
                  Choose a ticket from the list to review the assistant context and reply to the student.
                </div>
              ) : (
                selected.messages?.map((message) => (
                  <div
                    key={message._id}
                    className={`flex ${message.senderRole === "student" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                        message.senderRole === "student"
                          ? "rounded-br-md bg-indigo-600 text-white"
                          : "rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-2xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      <span
                        className={`mt-2 block text-[10px] font-semibold ${
                          message.senderRole === "student" ? "text-indigo-100" : "text-slate-400"
                        }`}
                      >
                        {message.senderRole === "assistant"
                          ? `CampusFlow assistant${
                              message.confidence != null ? ` · ${Math.round(message.confidence * 100)}% confidence` : ""
                            }`
                          : message.senderRole === "admin"
                          ? "TPO administrator"
                          : "Student"}
                        {message.handoffRecommended ? " · Escalated to TPO" : ""}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selected && selected.status !== "closed" && (
              <form
                onSubmit={replyTicket}
                className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 sm:p-4 shrink-0"
              >
                <textarea
                  aria-label="Administrator reply"
                  rows={2}
                  maxLength={4000}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write an official confirmed answer for the student…"
                  className="min-h-12 flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300"
                  aria-label="Send reply"
                >
                  {sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={17} />}
                </button>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
