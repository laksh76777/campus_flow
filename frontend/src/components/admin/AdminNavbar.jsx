import { useState, useRef, useEffect, useMemo } from "react";
import {
  Menu,
  Bell,
  ShieldCheck,
  ChevronRight,
  ShieldAlert,
  UserPlus,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../../context/authContextDef";

function formatRelativeTime(dateString) {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now - date) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function AdminNavbar({
  onMenuClick,
  activeTab,
  adminUser,
  onLogout,
  students = [],
  applications = [],
  onNavigateTab,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const { user } = useAuth();

  // Persist read alert IDs in localStorage
  const [readAlertIds, setReadAlertIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("admin_read_alert_ids") || "[]");
    } catch {
      return [];
    }
  });

  const displayName = adminUser?.fullName || user?.fullName || "Admin Officer";

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") setShowNotifications(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const tabTitles = {
    overview: "Dashboard Overview",
    analytics: "Placement Analytics",
    students: "Registered Students Directory",
    drives: "Manage Placement Drives",
    automated_drives: "Automated Placement Drives",
    companies: "Corporate Partners Directory",
    applications: "Applicant Review & Shortlisting",
    sessions: "Placement Sessions & Academic Cohorts",
    excel_hub: "Excel Import & Exports",
    announcements: "Broadcasts & Alerts",
    support: "Student Support Inbox",
  };

  // Dynamically compute real admin alerts based on student registrations, profile edit permissions, and drive applications
  const adminNotifications = useMemo(() => {
    const list = [];

    // 1. Student Profile Modification Requests (Before vs After)
    (students || []).forEach((s) => {
      if (Array.isArray(s.modificationRequests)) {
        s.modificationRequests
          .filter((r) => r.status === "PENDING")
          .forEach((reqItem) => {
            const studentName = s.user?.fullName || s.fullName || s.enrollmentNumber || "Student";
            const usn = s.enrollmentNumber || s.usn || "";
            const branch = s.branch || s.department || "Engineering";
            const changeDesc = (reqItem.changes || [])
              .map((c) => `${c.fieldLabel || c.field}: ${c.beforeValue ?? "none"} → ${c.afterValue}`)
              .join(", ");
            list.push({
              id: `mod-req-${reqItem._id || Math.random()}`,
              type: "modification_request",
              title: "Requested Profile Modification",
              description: `${studentName} (${usn ? `${usn} • ` : ""}${branch}) requested update: [${changeDesc || "Academic record"}]. Reason: "${reqItem.reason || "Cleared backlog / updated record"}"`,
              time: formatRelativeTime(reqItem.requestedAt || s.updatedAt),
              targetTab: "students",
              badgeText: "Modification Request",
              badgeClass: "bg-amber-100 text-amber-900 border-amber-300 font-extrabold",
              iconType: "shield",
            });
          });
      }
    });

    // 2. Student Verification Requests
    const pendingStudents = (students || []).filter(
      (s) => s.verificationStatus === "PENDING" || s.academicVerificationStatus === "PENDING"
    );

    pendingStudents.slice(0, 3).forEach((s, idx) => {
      const studentName = s.user?.fullName || s.fullName || s.enrollmentNumber || "Student";
      const usn = s.enrollmentNumber || s.usn || "";
      const branch = s.branch || s.department || "Engineering";
      list.push({
        id: `profile-req-${s._id || idx}`,
        type: "permission_request",
        title: "Academic Verification Pending",
        description: `${studentName} (${usn ? `${usn} • ` : ""}${branch}) locked dossier awaiting TPO verification.`,
        time: formatRelativeTime(s.updatedAt || s.createdAt),
        targetTab: "students",
        badgeText: "Verification",
        badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
        iconType: "shield",
      });
    });

    // 2. Newly Registered Students (When students add/register)
    const sortedStudents = [...(students || [])].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    sortedStudents.slice(0, 3).forEach((s, idx) => {
      if (!list.some((item) => item.id === `profile-req-${s._id}`)) {
        const studentName = s.user?.fullName || s.fullName || "New Student";
        const usn = s.enrollmentNumber || s.usn || "";
        const branch = s.branch || s.department || "JSSATEB";
        list.push({
          id: `student-add-${s._id || idx}`,
          type: "student_added",
          title: "New Student Registered",
          description: `${studentName} (${usn ? `${usn} • ` : ""}${branch}) enrolled in JSSATEB Placement Portal.`,
          time: formatRelativeTime(s.createdAt),
          targetTab: "students",
          badgeText: "New Student",
          badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
          iconType: "user",
        });
      }
    });

    // 3. Recent Drive Applications
    const sortedApps = [...(applications || [])].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    sortedApps.slice(0, 3).forEach((app, idx) => {
      const studentName = app.student?.user?.fullName || app.student?.enrollmentNumber || "Candidate";
      const driveName = app.drive?.title || app.drive?.companyName || "Placement Drive";
      list.push({
        id: `app-${app._id || idx}`,
        type: "application",
        title: "Drive Application Submitted",
        description: `${studentName} applied for ${driveName}.`,
        time: formatRelativeTime(app.createdAt),
        targetTab: "applications",
        badgeText: "Drive Application",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
        iconType: "briefcase",
      });
    });

    return list;
  }, [students, applications]);

  // Compute unread alert count
  const unreadCount = useMemo(() => {
    return adminNotifications.filter((n) => !readAlertIds.includes(n.id)).length;
  }, [adminNotifications, readAlertIds]);

  // Mark single alert as read on click and navigate
  const handleAlertClick = (item) => {
    if (!readAlertIds.includes(item.id)) {
      const updated = [...readAlertIds, item.id];
      setReadAlertIds(updated);
      try {
        localStorage.setItem("admin_read_alert_ids", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save read alert state:", err);
      }
    }
    if (onNavigateTab && item.targetTab) {
      onNavigateTab(item.targetTab);
      setShowNotifications(false);
    }
  };

  // Mark all alerts as read
  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    const allIds = adminNotifications.map((n) => n.id);
    setReadAlertIds(allIds);
    try {
      localStorage.setItem("admin_read_alert_ids", JSON.stringify(allIds));
    } catch (err) {
      console.error("Failed to save read alert state:", err);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex w-full flex-col">
      {/* Institutional ribbon (thin, keeps the JSS identity) */}
      <div className="w-full shrink-0 bg-gradient-to-r from-jss-950 via-jss-900 to-jss-800 px-3 py-1 text-[10px] font-semibold text-white sm:px-6 sm:text-[11px] lg:px-8">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 truncate">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
            <span className="truncate tracking-wide">
              JSS Mahavidyapeetha <span className="hidden sm:inline">• JSS Academy of Technical Education, Bengaluru</span>
            </span>
          </div>
          <span className="hidden shrink-0 text-[10px] font-medium text-amber-100/80 lg:inline">
            Affiliated to VTU Belagavi
          </span>
        </div>
      </div>

      {/* Main bar */}
      <div className="flex h-14 w-full items-center justify-between gap-3 border-b border-line bg-white/85 px-3 backdrop-blur-md sm:h-16 sm:px-6 lg:px-8">
        {/* Left: drawer trigger + breadcrumb title */}
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onMenuClick}
            className="cf-icon-btn lg:hidden"
            aria-label="Open navigation drawer"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>

          <div className="flex min-w-0 flex-col justify-center">
            <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-[11px] font-semibold text-slate-400 sm:flex">
              <span className="text-jss-800">JSSATEB</span>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <span>TPO Console</span>
            </nav>
            <h1 className="truncate text-[15px] font-extrabold tracking-tight text-slate-900 sm:text-base">
              {tabTitles[activeTab] || "TPO Console"}
            </h1>
          </div>

          <span className="ml-1 hidden shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 xl:inline-flex">
            <ShieldCheck className="h-3 w-3 text-amber-700" />
            Verified Admin
          </span>
        </div>

        {/* Right: alerts + account */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="sm:relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="cf-icon-btn"
              aria-label={unreadCount > 0 ? `Admin alerts, ${unreadCount} unread` : "Admin alerts"}
              aria-expanded={showNotifications}
              aria-haspopup="true"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-jss-600 px-1 text-[10px] font-black text-white ring-2 ring-white tabular-nums">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                role="dialog"
                aria-label="Admin alerts"
                className="cf-popover fixed inset-x-3 top-[5.25rem] z-50 p-3.5 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 sm:p-4"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">Admin Alerts</h3>
                    <p className="text-[11px] text-slate-400">Student activity across the portal</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`cf-badge ${
                        unreadCount > 0 ? "border-jss-200 bg-jss-50 text-jss-800" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {unreadCount > 0 ? `${unreadCount} unread` : "All read"}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="rounded-md px-1.5 py-1 text-[11px] font-bold text-jss-700 transition hover:bg-jss-50 hover:text-jss-900"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>

                <div className="-mx-1 mt-2 max-h-[min(22rem,60vh)] space-y-1 overflow-y-auto px-1">
                  {adminNotifications.length === 0 && (
                    <div className="py-8 text-center">
                      <Bell className="mx-auto mb-2 h-8 w-8 stroke-1 text-slate-300" />
                      <p className="text-xs font-semibold text-slate-600">No alerts right now</p>
                      <p className="mx-auto mt-0.5 max-w-xs text-[11px] text-slate-400">
                        New registrations, verification and modification requests, and applications appear here.
                      </p>
                    </div>
                  )}
                  {adminNotifications.map((n) => {
                    const isShield = n.iconType === "shield";
                    const isUser = n.iconType === "user";
                    const isRead = readAlertIds.includes(n.id);

                    return (
                      <button
                        type="button"
                        key={n.id}
                        onClick={() => handleAlertClick(n)}
                        className={`group relative flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition ${
                          isRead ? "opacity-70 hover:bg-slate-50 hover:opacity-100" : "bg-jss-50/50 hover:bg-jss-50"
                        }`}
                      >
                        {!isRead && (
                          <span className="absolute left-0 top-3 h-5 w-[3px] rounded-r-full bg-jss-500" aria-hidden="true" />
                        )}
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                            isShield
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : isUser
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                          }`}
                        >
                          {isShield ? (
                            <ShieldAlert className="h-4 w-4" />
                          ) : isUser ? (
                            <UserPlus className="h-4 w-4" />
                          ) : (
                            <Briefcase className="h-4 w-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-xs font-bold text-slate-900">{n.title}</p>
                            <span className="shrink-0 text-[10px] font-medium text-slate-400">{n.time}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600">{n.description}</p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${n.badgeClass}`}>
                              {n.badgeText}
                            </span>
                            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-jss-700 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                              <span>{isRead ? "View" : "Review & mark read"}</span>
                              <ArrowRight className="h-2.5 w-2.5" />
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 border-t border-slate-100 pt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateTab) onNavigateTab("students");
                      setShowNotifications(false);
                    }}
                    className="flex items-center gap-1 rounded-md px-1 py-1 text-[11px] font-bold text-jss-700 transition hover:text-jss-900"
                  >
                    <span>Manage student profiles &amp; permissions</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />

          {/* Account chip */}
          <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-line bg-white p-1 shadow-xs lg:pr-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-jss-700 to-amber-600 text-xs font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden min-w-0 text-left lg:block">
              <p className="max-w-[140px] truncate text-xs font-bold leading-tight text-slate-900">{displayName}</p>
              <p className="mt-0.5 whitespace-nowrap text-[10px] font-medium leading-none text-slate-500">
                Placement Officer
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
