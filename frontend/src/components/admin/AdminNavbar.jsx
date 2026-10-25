import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  Bell,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  LogOut,
  ShieldAlert,
  UserPlus,
  Briefcase,
  FileCheck,
  ArrowRight,
  Sparkles,
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tabTitles = {
    overview: "Dashboard & Analytics",
    students: "Registered Students Directory",
    drives: "Manage Placement Drives",
    companies: "Corporate Partners Directory",
    applications: "Applicant Review & Shortlisting",
    sessions: "Placement Sessions & Academic Cohorts",
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

    // 4. Default realistic JSSATEB alerts if empty database
    if (list.length === 0) {
      list.push(
        {
          id: "default-1",
          type: "permission_request",
          title: "Profile Edit Permission Request",
          description: "Ananya Sharma (1JS21CS042 • CSE) requested TPO approval to update 6th sem CGPA & marksheet.",
          time: "15m ago",
          targetTab: "students",
          badgeText: "Permission Request",
          badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
          iconType: "shield",
        },
        {
          id: "default-2",
          type: "student_added",
          title: "New Student Registered",
          description: "Rohan Gowda (1JS21IS088 • ISE) enrolled on JSSATEB Placement Portal.",
          time: "1h ago",
          targetTab: "students",
          badgeText: "New Student",
          badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
          iconType: "user",
        },
        {
          id: "default-3",
          type: "permission_request",
          title: "Academic Verification Pending",
          description: "Sneha Patil (1JS21EC104 • ECE) uploaded verified semester grade cards awaiting approval.",
          time: "3h ago",
          targetTab: "students",
          badgeText: "Verification",
          badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
          iconType: "shield",
        }
      );
    }

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
    <header className="sticky top-0 z-30 flex flex-col w-full shadow-2xs">
      {/* Official JSS Institutional Top Ribbon (End-to-End Edge, Very Thin, Responsive) */}
      <div className="w-full bg-gradient-to-r from-red-950 via-red-900 to-orange-900 text-white text-[10px] sm:text-[11px] font-semibold py-1 px-3 sm:px-6 lg:px-8 border-b border-orange-800/40 shrink-0">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate min-w-0">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400 animate-pulse" />
            <span className="font-bold tracking-wide truncate">
              JSS Mahavidyapeetha <span className="hidden sm:inline">• JSS Academy of Technical Education, Bengaluru</span>
            </span>
          </div>
          <span className="hidden lg:inline text-orange-200/90 font-medium text-[10px] shrink-0">
            Affiliated to VTU Belagavi
          </span>
        </div>
      </div>

      {/* Main Admin Navbar Row - Light Creamy Background, Compact & Non-overlapping */}
      <div className="flex h-14 sm:h-15 w-full items-center justify-between border-b border-orange-200/90 bg-gradient-to-r from-orange-50/90 via-white/95 to-rose-50/80 px-3 sm:px-6 lg:px-8 backdrop-blur-md">
        {/* Left: Mobile Drawer Trigger, JSSATEB Crest & Single-Line Tab Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onMenuClick}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-200 bg-white/90 text-slate-700 hover:bg-orange-50 lg:hidden transition shadow-2xs shrink-0"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* JSSATEB College Crest Thumbnail */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-orange-200 shadow-2xs p-0.5 shrink-0">
            <img
              src="/images/jssateb/college-logo.png"
              alt="JSSATEB"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-black tracking-tight text-red-950 uppercase shrink-0">
              JSSATEB
            </span>
            <span className="text-orange-400 font-bold shrink-0 hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-orange-950/70 shrink-0 hidden sm:inline">
              TPO
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-orange-400 shrink-0 hidden sm:inline-block" />
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
              {tabTitles[activeTab] || "TPO Console"}
            </h1>

            <span className="hidden xl:inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300 shrink-0 ml-1">
              <ShieldCheck className="h-3 w-3 text-amber-700" />
              Verified Admin
            </span>
          </div>
        </div>

        {/* Right: Actions & User Chip - Compact Single Line */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Notifications Dropdown */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-orange-200 bg-white/90 text-slate-600 hover:bg-orange-50 hover:text-orange-900 transition shadow-2xs shrink-0"
              title="Admin Alerts"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-orange-200/90 bg-white p-3.5 sm:p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-slate-900 text-sm">Admin Alerts</h3>
                    <span className="text-[10px] text-slate-400 font-medium">• Student Activity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        unreadCount > 0
                          ? "bg-orange-100 text-orange-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {unreadCount > 0 ? `${unreadCount} Unread` : "All Read"}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-bold text-orange-700 hover:text-orange-900 hover:underline transition"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2 divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {adminNotifications.map((n) => {
                    const isShield = n.iconType === "shield";
                    const isUser = n.iconType === "user";
                    const isRead = readAlertIds.includes(n.id);

                    return (
                      <div
                        key={n.id}
                        onClick={() => handleAlertClick(n)}
                        className={`p-2.5 rounded-xl transition cursor-pointer group flex items-start gap-2.5 ${
                          isRead
                            ? "opacity-65 hover:opacity-100 hover:bg-slate-50/80"
                            : "bg-orange-50/40 hover:bg-orange-100/60 border-l-2 border-l-orange-500 font-medium"
                        }`}
                      >
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 mt-0.5 border ${
                            isShield
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : isUser
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {isShield ? (
                            <ShieldAlert className="h-3.5 w-3.5" />
                          ) : isUser ? (
                            <UserPlus className="h-3.5 w-3.5" />
                          ) : (
                            <Briefcase className="h-3.5 w-3.5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-1.5 truncate">
                              {!isRead && (
                                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                              )}
                              <p className="text-xs font-bold text-slate-900 group-hover:text-orange-950 transition truncate">
                                {n.title}
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                              {n.time}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.description}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold border ${n.badgeClass}`}
                            >
                              {n.badgeText}
                            </span>
                            <span className="text-[10px] text-orange-600/80 font-semibold group-hover:text-orange-700 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">
                              <span>{isRead ? "View" : "Review & Mark Read"}</span>
                              <ArrowRight className="h-2.5 w-2.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (onNavigateTab) onNavigateTab("students");
                      setShowNotifications(false);
                    }}
                    className="text-[11px] font-bold text-orange-700 hover:text-orange-800 flex items-center gap-1 transition"
                  >
                    <span>Manage Student Profiles & Permissions</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="hidden sm:block h-5 w-px bg-orange-200/80" />

          {/* Admin User Chip - Compact Single Line */}
          <div className="flex items-center gap-2 rounded-lg border border-orange-200/90 bg-white/95 p-1 pr-2.5 shadow-2xs shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-red-800 via-orange-700 to-amber-600 font-bold text-white text-xs shadow-xs shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block text-left min-w-0">
              <p className="text-xs font-bold text-slate-900 leading-none truncate max-w-[120px] whitespace-nowrap">
                {displayName}
              </p>
              <p className="text-[10px] text-orange-800/80 font-medium leading-none mt-1 whitespace-nowrap">
                Placement Officer
              </p>
            </div>
          </div>

          {/* Sign Out Button */}
          {/* <button
            onClick={onLogout}
            title="Sign Out"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/80 text-rose-600 hover:bg-rose-100 transition shadow-2xs shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button> */}
        </div>
      </div>
    </header>
  );
}
