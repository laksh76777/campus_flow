import { useState, useRef, useEffect } from "react";
import {
  Menu,
  Bell,
  Sparkles,
  ChevronRight,
} from "lucide-react";

export default function StudentNavbar({
  onMenuClick,
  activeTab,
  user,
  studentProfile,
  onOpenProfile,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  const displayName = user?.fullName || studentProfile?.user?.fullName || "Student User";
  const avatarLetter = displayName.charAt(0).toUpperCase();

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

  const tabTitles = {
    overview: "Dashboard Overview",
    drives: "Placement Drives",
    applications: "My Applications",
    profile: "Academic Profile",
  };

  const sampleNotifications = [
    {
      id: 1,
      title: "Google Drive Application Open",
      description: "Software Engineer application deadline is in 5 days.",
      time: "15m ago",
      unread: true,
    },
    {
      id: 2,
      title: "Shortlist Announcement",
      description: "You have been shortlisted for Microsoft Online Assessment.",
      time: "2h ago",
      unread: true,
    },
    {
      id: 3,
      title: "Resume Verification",
      description: "Your academic profile is ready for campus recruitment.",
      time: "1d ago",
      unread: false,
    },
  ];

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
            2025-26 Live Season
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
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  2 New
                </span>
              </div>
              <div className="mt-2 divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {sampleNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl transition hover:bg-slate-50 ${
                      n.unread ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-bold text-slate-800">{n.title}</p>
                      <span className="text-[10px] text-slate-400">{n.time}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{n.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-center">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Mark all as read
                </button>
              </div>
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
