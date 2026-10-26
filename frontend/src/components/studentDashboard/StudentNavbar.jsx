import { useState, useRef, useEffect, useCallback } from "react";
import {
  Menu,
  Bell,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Calendar,
  Clock,
  XCircle,
  MessageSquare,
  Trash2,
} from "lucide-react";
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
} from "../../services/notificationService";

export default function StudentNavbar({
  onMenuClick,
  activeTab,
  user,
  studentProfile,
  onOpenProfile,
  onSelectTab,
  unreadCount: externalUnreadCount,
  onRefreshNotifications,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(externalUnreadCount ?? 0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const notificationRef = useRef(null);

  useEffect(() => {
    if (typeof externalUnreadCount === "number") {
      setUnreadCount(externalUnreadCount);
    }
  }, [externalUnreadCount]);

  const displayName = user?.fullName || studentProfile?.user?.fullName || "Student User";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifs(true);
      setNotificationError("");
      const res = await getMyNotifications();
      if (res?.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      setNotificationError("Couldn't load notifications. Please try again.");
      console.warn("Notifications sync notice:", err.message);
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  // Initial fetch and auto-polling (only when not managed by parent StudentDashboard)
  useEffect(() => {
    fetchNotifications();
    if (onRefreshNotifications) return;
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, [fetchNotifications, onRefreshNotifications]);

  // Close dropdown on outside click
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

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      onRefreshNotifications?.();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleMarkOneRead = async (id, isRead) => {
    if (isRead) return;
    try {
      await markNotificationAsRead(id);
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      onRefreshNotifications?.();
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const handleDeleteOne = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      onRefreshNotifications?.();
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      onRefreshNotifications?.();
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await handleMarkOneRead(notification._id, false);
    }
    setShowNotifications(false);
    const titleLower = (notification.title || "").toLowerCase();
    const messageLower = (notification.message || "").toLowerCase();
    if (
      notification.type === "urgent" ||
      titleLower.includes("deadline") ||
      titleLower.includes("drive") ||
      messageLower.includes("deadline") ||
      messageLower.includes("drive")
    ) {
      onSelectTab?.("drives");
    } else if (
      notification.interviewDate ||
      notification.status ||
      titleLower.includes("application") ||
      messageLower.includes("status")
    ) {
      onSelectTab?.("applications");
    } else {
      onSelectTab?.("notifications");
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "Just now";
    const diffSec = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "selected":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />;
      case "interview":
        return <Calendar className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />;
      case "shortlisted":
        return <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />;
    }
  };

  const tabTitles = {
    overview: "Dashboard Overview",
    drives: "Placement Drives",
    applications: "My Applications",
    notifications: "Message & Notification Center",
    profile: "Academic Profile",
    support: "Student Support",
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-3 border-b border-line bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      {/* Left: drawer trigger + breadcrumb title */}
      <div className="flex min-w-0 items-center gap-3">
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
            <span>Student Portal</span>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span className="text-slate-500">Placement workspace</span>
          </nav>
          <h1 className="truncate text-[15px] font-extrabold tracking-tight text-slate-900 sm:text-base">
            {tabTitles[activeTab] || "Dashboard Overview"}
          </h1>
        </div>
      </div>

      {/* Right: notifications + profile */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="sm:relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => {
              const nextState = !showNotifications;
              setShowNotifications(nextState);
              if (nextState) fetchNotifications();
            }}
            className="cf-icon-btn"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            aria-expanded={showNotifications}
            aria-haspopup="true"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-white tabular-nums">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              role="dialog"
              aria-label="Notifications"
              className="cf-popover fixed inset-x-3 top-[4.5rem] z-50 p-3.5 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 sm:p-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                      {unreadCount} New
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      Up to date
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 max-h-[min(22rem,60vh)] overflow-y-auto">
                {notifications.length === 0 && loadingNotifs ? (
                  <div className="py-8 text-center text-slate-500" role="status">
                    <span className="mx-auto mb-2 block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <p className="text-xs font-medium">Loading notifications…</p>
                  </div>
                ) : notifications.length === 0 && notificationError ? (
                  <div className="py-8 text-center" role="alert">
                    <p className="text-xs font-medium text-rose-700">{notificationError}</p>
                    <button
                      type="button"
                      onClick={fetchNotifications}
                      className="mt-2 text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="text-xs font-medium">No notifications yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Status updates and interview alerts will appear here
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleNotificationClick(n)}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          handleNotificationClick(n);
                        }
                      }}
                      className={`my-1 cursor-pointer rounded-xl border p-3 transition ${
                        !n.isRead
                          ? "border-brand-100 bg-brand-50/60 hover:bg-brand-50"
                          : "border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {getStatusIcon(n.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <p
                              className={`text-xs ${
                                !n.isRead
                                  ? "font-bold text-slate-900"
                                  : "font-semibold text-slate-700"
                              }`}
                            >
                              {n.title}
                            </p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                {formatTimeAgo(n.createdAt)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteOne(e, n._id)}
                                className="rounded-md p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600"
                                title="Delete notification"
                                aria-label="Delete notification"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {n.message}
                          </p>

                          {/* Extra Details (Interview / Package / Location) */}
                          {(n.interviewDate || n.offeredPackage || n.interviewLocation) && (
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                              {n.interviewDate && (
                                <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 font-semibold text-purple-800">
                                  <Calendar className="h-2.5 w-2.5" />
                                  {new Date(n.interviewDate).toLocaleString([], {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                              {n.interviewLocation && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 font-medium">
                                  📍 {n.interviewLocation}
                                </span>
                              )}
                              {n.offeredPackage && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">
                                  ₹{n.offeredPackage} LPA CTC
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col gap-1.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    onSelectTab?.("notifications");
                  }}
                  className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 py-1 hover:underline cursor-pointer flex items-center justify-center gap-1"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  View All Messages & Notifications Center
                </button>
                <p className="text-[10px] text-slate-400">
                  Live synced with Placement Admin Portal
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />

        {/* Profile pill */}
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label={`Open profile for ${displayName}`}
          className="flex items-center gap-2.5 rounded-xl border border-line bg-white p-1 shadow-xs transition hover:border-line-strong hover:shadow-sm active:scale-[0.98] sm:pr-3"
        >
          {user?.avatar?.url ? (
            <img
              src={user.avatar.url}
              alt={displayName}
              className="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-100"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
              {avatarLetter}
            </div>
          )}
          <div className="hidden sm:block text-left">
            <p className="max-w-[150px] truncate text-xs font-bold leading-tight text-slate-900">
              {displayName}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              {studentProfile?.enrollmentNumber || "Student"}
            </p>
          </div>
        </button>
      </div>
    </header>
  );
}
