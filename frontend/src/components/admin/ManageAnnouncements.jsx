import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Send,
  Users,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Calendar,
  Briefcase,
  Layers,
  ChevronRight,
  Info,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Wrench,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getAnnouncementPreview,
  broadcastAnnouncement,
  getScheduledReminders,
  getSmtpStatus,
} from "../../services/notificationService";
import { getPublicDepartments } from "../../services/authService";
import { getAllPlacementSessions } from "../../services/sessionService";

export default function ManageAnnouncements({ drives = [] }) {
  const [activeSubTab, setActiveSubTab] = useState("compose"); // "compose" | "reminders" | "smtp"

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("announcement"); // "announcement" | "urgent"
  const [targetAudience, setTargetAudience] = useState("all");
  const [targetProgramCode, setTargetProgramCode] = useState("");
  const [targetSessionId, setTargetSessionId] = useState("");
  const [selectedDriveId, setSelectedDriveId] = useState("");
  const [channels, setChannels] = useState(["in_app", "email"]); // "in_app", "email"

  // Options & Metadata
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Audience Preview State
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Scheduled Reminders State
  const [reminders, setReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(false);

  // SMTP Status State
  const [smtpData, setSmtpData] = useState(null);
  const [loadingSmtp, setLoadingSmtp] = useState(false);

  // Load programs & sessions on mount
  useEffect(() => {
    let active = true;
    Promise.all([getPublicDepartments(), getAllPlacementSessions()])
      .then(([progRes, sessRes]) => {
        if (!active) return;
        setPrograms(progRes?.data || []);
        const activeSessions = (sessRes?.data || []).filter(
          (s) => !s.isClosed && !s.isArchived
        );
        setSessions(activeSessions);
        if (activeSessions.length > 0) {
          setTargetSessionId(activeSessions[0]._id);
        }
      })
      .catch((err) => {
        console.error("Failed to load options for announcements:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch Audience Preview whenever targeting changes
  const fetchPreview = useCallback(async () => {
    try {
      setLoadingPreview(true);
      const params = { targetAudience };
      if (targetAudience === "program") params.targetProgramCode = targetProgramCode;
      if (targetAudience === "session") params.targetSessionId = targetSessionId;
      if (targetAudience === "drive_applicants") params.driveId = selectedDriveId;

      if (targetAudience === "program" && !targetProgramCode) {
        setPreviewData(null);
        return;
      }
      if (targetAudience === "session" && !targetSessionId) {
        setPreviewData(null);
        return;
      }
      if (targetAudience === "drive_applicants" && !selectedDriveId) {
        setPreviewData(null);
        return;
      }

      const res = await getAnnouncementPreview(params);
      if (res?.data) {
        setPreviewData(res.data);
      }
    } catch (err) {
      console.error("Audience preview notice:", err.message);
    } finally {
      setLoadingPreview(false);
    }
  }, [targetAudience, targetProgramCode, targetSessionId, selectedDriveId]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // Load Scheduled Reminders
  const loadReminders = useCallback(async () => {
    try {
      setLoadingReminders(true);
      const res = await getScheduledReminders();
      if (Array.isArray(res?.data)) {
        setReminders(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch reminders:", err);
      toast.error("Could not fetch scheduled deadline reminders");
    } finally {
      setLoadingReminders(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === "reminders") {
      loadReminders();
    }
  }, [activeSubTab, loadReminders]);

  // Load SMTP Diagnostic Status
  const loadSmtpStatus = useCallback(async () => {
    try {
      setLoadingSmtp(true);
      const res = await getSmtpStatus();
      if (res?.data) {
        setSmtpData(res.data);
      }
    } catch (err) {
      console.warn("Failed to load SMTP diagnostic status:", err.message);
    } finally {
      setLoadingSmtp(false);
    }
  }, []);

  useEffect(() => {
    loadSmtpStatus();
  }, [loadSmtpStatus]);

  // Toggle delivery channels
  const toggleChannel = (ch) => {
    setChannels((prev) => {
      if (prev.includes(ch)) {
        if (prev.length === 1) {
          toast.error("At least one communication channel must remain active");
          return prev;
        }
        return prev.filter((c) => c !== ch);
      }
      return [...prev, ch];
    });
  };

  // Submit Broadcast Announcement
  const handleBroadcast = async () => {
    if (!title.trim()) {
      toast.error("Please enter an announcement title");
      return;
    }
    if (!message.trim()) {
      toast.error("Please write the announcement message");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: title.trim(),
        message: message.trim(),
        type: priority,
        targetAudience,
        targetProgramCode: targetAudience === "program" ? targetProgramCode : undefined,
        targetSessionId: targetAudience === "session" ? targetSessionId : undefined,
        driveId: targetAudience === "drive_applicants" ? selectedDriveId : undefined,
        channels,
      };

      const res = await broadcastAnnouncement(payload);
      setIsReviewOpen(false);
      setTitle("");
      setMessage("");

      const result = res?.data || {};
      const emailsSent = result.emailsSent || 0;
      const emailsFailed = result.emailsFailed || 0;
      const inAppCount = result.inAppCreated || 0;

      if (channels.includes("email")) {
        if (result.emailStatus === "DELIVERED") {
          toast.success(
            `Dispatched successfully: ${inAppCount} in-app alerts created, ${emailsSent} emails sent.`
          );
        } else if (result.emailStatus === "PARTIAL_FAILURE") {
          toast.error(
            `Partial delivery: ${inAppCount} in-app alerts created, ${emailsSent} emails sent, but ${emailsFailed} emails failed.`
          );
        } else if (result.emailStatus === "FAILED") {
          toast.error(
            `Email delivery failed for ${emailsFailed} candidate(s). ${inAppCount} in-app alerts were created.`
          );
        } else if (result.emailStatus === "SMTP_NOT_CONFIGURED") {
          toast(
            `Notice: ${inAppCount} in-app alerts created. Emails skipped because SMTP server is not configured in .env.`,
            { icon: "ℹ️" }
          );
        }
      } else {
        toast.success(`Dispatched ${inAppCount} in-app announcement alerts.`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to dispatch announcement");
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger manual worker run
  const handleTriggerWorker = async () => {
    try {
      setTriggeringWorker(true);
      const res = await triggerReminderWorker();
      toast.success(
        `Worker executed: ${res?.data?.processed || 0} reminder job(s) processed`
      );
      await loadReminders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to trigger reminder worker");
    } finally {
      setTriggeringWorker(false);
    }
  };

  const isSmtpConfigured = Boolean(smtpData?.configured);
  const isSmtpVerified = Boolean(smtpData?.verification?.verified);
  const isSmtpReady = isSmtpVerified || isSmtpConfigured || Boolean(previewData?.senderAddress);
  const smtpCategory = smtpData?.verification?.category || "NOT_CONFIGURED";

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Broadcasts & Alerts
            </h2>
            <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
              Placement Communications
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Dispatch announcements, urgent hiring updates, and manage automated drive deadline reminders.
          </p>
        </div>

        {/* Email Delivery Status Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold ${
              isSmtpVerified || isSmtpConfigured
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-slate-50 text-slate-700 border-slate-200"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isSmtpVerified || isSmtpConfigured
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-slate-400"
              }`}
            />
            <span>
              {isSmtpVerified || isSmtpConfigured
                ? "Email Delivery Active (Verified)"
                : "Email Delivery Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("compose")}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
            activeSubTab === "compose"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Send className="h-4 w-4" />
          <span>Compose Announcement</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("reminders")}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
            activeSubTab === "reminders"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Scheduled Reminders</span>
          {reminders.length > 0 && (
            <span className="rounded-full bg-slate-700 text-white px-2 py-0.5 text-[10px]">
              {reminders.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: COMPOSE ANNOUNCEMENT */}
      {activeSubTab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form (2 cols) */}
          <div className="lg:col-span-2 space-y-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            {/* Title & Priority */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Announcement Title
                </label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Mandatory Pre-Placement Talk for Google / Technical OA Guidelines"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex justify-end mt-1">
                  <span className="text-[11px] text-slate-400">
                    {title.length}/200 characters
                  </span>
                </div>
              </div>

              {/* Priority Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Broadcast Priority
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPriority("announcement")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-bold transition text-left ${
                      priority === "announcement"
                        ? "bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Bell className="h-4 w-4 text-indigo-600" />
                    <div>
                      <div className="font-bold">Standard Notice</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Regular information & drive updates
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriority("urgent")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-bold transition text-left ${
                      priority === "urgent"
                        ? "bg-rose-50 border-rose-300 text-rose-900 shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ShieldAlert className="h-4 w-4 text-rose-600" />
                    <div>
                      <div className="font-bold">Urgent Alert</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Immediate action required / interview calls
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Target Audience */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-700">
                  Target Audience
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "all", label: "All Students", icon: Users },
                    { id: "program", label: "By Academic Program", icon: Layers },
                    { id: "session", label: "Placement Session", icon: Calendar },
                    { id: "drive_applicants", label: "Drive Applicants", icon: Briefcase },
                  ].map((aud) => {
                    const Icon = aud.icon;
                    const isSelected = targetAudience === aud.id;
                    return (
                      <button
                        type="button"
                        key={aud.id}
                        onClick={() => setTargetAudience(aud.id)}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-center transition ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs font-bold"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 text-xs font-medium"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[11px] leading-tight">{aud.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Conditional Sub-selectors */}
                {targetAudience === "program" && (
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Select Approved Academic Program
                    </label>
                    <select
                      value={targetProgramCode}
                      onChange={(e) => setTargetProgramCode(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                    >
                      <option value="">-- Choose program --</option>
                      {programs.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {targetAudience === "session" && (
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Select Configured Placement Session
                    </label>
                    <select
                      value={targetSessionId}
                      onChange={(e) => setTargetSessionId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                    >
                      <option value="">-- Choose session --</option>
                      {sessions.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name || `Session ${s.sessionYear}`} ({s.sessionYear})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {targetAudience === "drive_applicants" && (
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Select Placement Drive
                    </label>
                    <select
                      value={selectedDriveId}
                      onChange={(e) => setSelectedDriveId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                    >
                      <option value="">-- Choose recruitment drive --</option>
                      {drives.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.company?.companyName || "Drive"} — {d.jobTitle}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Delivery Channels */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-700">
                  Delivery Channels
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => toggleChannel("in_app")}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition w-full ${
                      channels.includes("in_app")
                        ? "bg-blue-50/80 border-blue-300 text-blue-900"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={channels.includes("in_app")}
                      readOnly
                      tabIndex={-1}
                      className="pointer-events-none rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <Bell className="h-3.5 w-3.5 text-blue-600" />
                        <span>In-App Notification</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Displays in student dashboard bell icon & inbox
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleChannel("email")}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition w-full ${
                      channels.includes("email")
                        ? "bg-indigo-50/80 border-indigo-300 text-indigo-900"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={channels.includes("email")}
                      readOnly
                      tabIndex={-1}
                      className="pointer-events-none rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Registered Student Email</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Sends official email via placement sender address
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Announcement Body & Instructions
                </label>
                <textarea
                  rows={6}
                  maxLength={5000}
                  placeholder="Enter detailed announcement instructions, event schedule, requirements, or links..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[11px] text-slate-400">
                    Supports line breaks and paragraphs
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {message.length}/5000 characters
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={!title.trim() || !message.trim() || submitting}
                  onClick={() => setIsReviewOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                  <span>Review Audience & Broadcast</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Live Audience Preview & Verification (1 col) */}
          <div className="space-y-5">
            {/* Live Audience Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Targeted Audience
                  </h3>
                </div>
                {loadingPreview && (
                  <RefreshCw className="h-3.5 w-3.5 text-slate-400 animate-spin" />
                )}
              </div>

              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {loadingPreview ? "..." : previewData?.totalEligibleRecipients ?? 0}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">
                  Eligible student recipient(s) selected
                </div>
              </div>

              {/* Sample Recipients */}
              {previewData?.sampleRecipients?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Sample Recipients Preview
                  </span>
                  <div className="space-y-1.5">
                    {previewData.sampleRecipients.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {s.fullName}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {s.email}
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                          {s.branch}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SMTP Disclaimer Warning */}
              {channels.includes("email") && !isSmtpReady && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong>SMTP Notice:</strong> Email server credentials are not set in environment variables. In-app notifications will be created, but emails will be skipped.
                  </div>
                </div>
              )}

              {channels.includes("email") && isSmtpReady && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <strong>Sender Address:</strong>
                    <div className="font-mono text-[10px] text-emerald-900 mt-0.5">
                      {previewData?.senderAddress || "Configured TPO Sender"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Information Callout */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/30 p-5 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-indigo-600" />
                <span>Delivery Guarantees</span>
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                CampusFlow verifies audience membership on the backend before sending. In-app alerts are persisted directly to the student portal and emails are dispatched only with valid provider acceptance.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEDULED REMINDERS */}
      {activeSubTab === "reminders" && (
        <div className="space-y-4">
          {/* Action & Stats Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-2xl border border-slate-200 p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Scheduled Placement Drive Deadline Reminders
              </h3>
              <p className="text-xs text-slate-500">
                Automated persistent background reminders scheduled for upcoming application deadlines.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Automated Engine Active (60s cycle)</span>
              </div>
              <button
                type="button"
                onClick={loadReminders}
                disabled={loadingReminders}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loadingReminders ? "animate-spin" : ""}`}
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Automated System Notice */}
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-purple-50/40 p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-900 font-bold block mb-0.5">How Automated Deadline Reminders Notify Candidates:</strong>
              CampusFlow's persistent background worker runs continuously every 60 seconds without requiring manual triggers. When an upcoming drive application deadline approaches (24 hours, 12 hours, or 2 hours prior to closing), urgent reminder notifications and official emails are automatically dispatched to all eligible students who have not yet submitted their applications.
            </div>
          </div>

          {/* Reminders Table / Cards */}
          {loadingReminders ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading scheduled reminders...</p>
            </div>
          ) : reminders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <Clock className="h-10 w-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900">
                No Scheduled Reminders
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Deadline reminders are automatically generated when placement drives are published with reminder settings enabled.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Drive & Company</th>
                      <th className="py-3 px-4">Scheduled Execution</th>
                      <th className="py-3 px-4">Offset</th>
                      <th className="py-3 px-4">Channels</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Delivery Results</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reminders.map((job) => {
                      const isPending = job.status === "PENDING";
                      const isCompleted = job.status === "COMPLETED";
                      const isCancelled = job.status === "CANCELLED";
                      const isFailed = job.status === "FAILED";

                      return (
                        <tr key={job._id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <div>{job.drive?.company?.companyName || "Placement Drive"}</div>
                            <div className="text-[11px] text-slate-500 font-normal">
                              {job.drive?.jobTitle || "Role"}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            <div>{new Date(job.scheduledTime).toLocaleDateString()}</div>
                            <div className="text-[11px] text-slate-400">
                              {new Date(job.scheduledTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {job.offsetHours}h before deadline
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex gap-1">
                              {job.channels?.map((c) => (
                                <span
                                  key={c}
                                  className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                                >
                                  {c === "in_app" ? "In-App" : "Email"}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isPending
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : isCompleted
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : isCancelled
                                  ? "bg-slate-100 text-slate-600 border border-slate-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isPending
                                    ? "bg-amber-500"
                                    : isCompleted
                                    ? "bg-emerald-500"
                                    : isCancelled
                                    ? "bg-slate-400"
                                    : "bg-rose-500"
                                }`}
                              />
                              <span>{job.status}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                            {job.deliverySummary ? (
                              <div className="space-y-0.5">
                                <div>
                                  Targeted: <strong>{job.deliverySummary.targetedCandidates || 0}</strong>
                                </div>
                                <div>
                                  In-App: {job.deliverySummary.inAppCreated || 0} | Sent: {job.deliverySummary.emailAccepted || 0}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  Skipped: {job.deliverySummary.skippedAlreadyApplied || 0} already applied
                                </div>
                              </div>
                            ) : job.errorCategory ? (
                              <span className="text-slate-500 text-[11px]">
                                {job.errorCategory}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Awaiting trigger</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}



      {/* REVIEW & CONFIRMATION MODAL */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg w-full space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">
                Confirm Broadcast Dispatch
              </h3>
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div>
                  <span className="text-slate-400 font-medium">Title:</span>
                  <div className="font-bold text-slate-900 text-sm">{title}</div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Priority:</span>
                  <span
                    className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${
                      priority === "urgent"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-indigo-100 text-indigo-800"
                    }`}
                  >
                    {priority.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Targeted Candidates:</span>
                  <span className="ml-2 font-bold text-slate-900">
                    {previewData?.totalEligibleRecipients ?? 0} students
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Channels:</span>
                  <span className="ml-2 font-bold text-slate-900">
                    {channels.join(", ").toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-slate-700 max-h-32 overflow-y-auto leading-relaxed">
                {message}
              </div>

              {channels.includes("email") && !isSmtpVerified && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                  <strong>Warning:</strong>{" "}
                  {isSmtpConfigured
                    ? "SMTP connection verification is failing (check SMTP Diagnostic tab). Real email delivery will fail until credentials are corrected."
                    : "SMTP is not configured in .env. In-app alerts will be created, but outbound emails will be skipped."}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsReviewOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleBroadcast}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{submitting ? "Broadcasting..." : "Confirm & Send"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
