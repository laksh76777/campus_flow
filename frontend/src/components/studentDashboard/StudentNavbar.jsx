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
} from "lucide-react";
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../../services/notificationService";

export default function StudentNavbar({
  onMenuClick,
  activeTab,
  user,
  studentProfile,
  onOpenProfile,
  onSelectTab,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const notificationRef = useRef(null);

  const displayName = user?.fullName || studentProfile?.user?.fullName || "Student User";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifs(true);
      const res = await getMyNotifications();
      if (res?.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.warn("Notifications sync notice:", err.message);
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  // Initial fetch and auto-polling every 25 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
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
    } catch (err) {
      console.error("Failed to mark notification read:", err);
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
    profile: "Academic Profile",
  };

  return (
    <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
      {/* Left: Mobile Drawer Trigger & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 lg:hidden transition"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 hidden sm:inline-block">
            Portal
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 hidden sm:inline-block" />
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {tabTitles[activeTab] || "Dashboard Overview"}
          </h1>

          <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-100 ml-2">
            <Sparkles className="h-3 w-3 text-blue-500" />
            Placement workspace
          </span>
        </div>
      </div>

      {/* Right: Notifications & Profile */}
      <div className="flex items-center gap-3">
        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition active:scale-95"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <>
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-xs animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
              </>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
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
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="mt-2 divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
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
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 rounded-xl transition cursor-pointer my-1 ${
                        !n.isRead
                          ? "bg-blue-50/60 border border-blue-100 shadow-xs"
                          : "hover:bg-slate-50"
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
                            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                              {formatTimeAgo(n.createdAt)}
                            </span>
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

              {notifications.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100 text-center">
                  <p className="text-[10px] text-slate-400">
                    Live synced with Placement Admin Portal
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden sm:block h-6 w-px bg-slate-200" />

        {/* Profile Pill */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-1 pr-3 hover:border-slate-300 hover:shadow-xs transition"
        >
          {user?.avatar?.url ? (
            <img
              src={user.avatar.url}
              alt={displayName}
              className="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-100"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white text-xs shadow-xs">
              {avatarLetter}
            </div>
          )}
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-slate-900 leading-tight line-clamp-1">
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
