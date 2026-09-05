import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  Bell,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../context/authContextDef";

export default function AdminNavbar({
  onMenuClick,
  activeTab,
  adminUser,
  onLogout,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const { user } = useAuth();

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
  };

  const adminNotifications = [
    {
      id: 1,
      title: "New Student Applications",
      description: "14 students applied for Google SDE 1 drive.",
      time: "25m ago",
    },
    {
      id: 2,
      title: "Company Registration",
      description: "Atlassian profile updated with new hiring roles.",
      time: "2h ago",
    },
    {
      id: 3,
      title: "Drive Deadline Approaching",
      description: "Microsoft Cloud Engineer application closes tomorrow.",
      time: "5h ago",
    },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
      {/* Left: Mobile Drawer Trigger & Tab Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 lg:hidden transition"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 hidden sm:inline-block">
            TPO Admin
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 hidden sm:inline-block" />
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {tabTitles[activeTab] || "TPO Console"}
          </h1>

          <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-100 ml-2">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
            Verified Admin
          </span>
        </div>
      </div>

      {/* Right: Actions & User Chip */}
      <div className="flex items-center gap-3">
        {/* Link back to public home */}
        <Link
          to="/"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
        >
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          <span>View Public Site</span>
        </Link>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Admin Alerts</h3>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                  3 Updates
                </span>
              </div>
              <div className="mt-2 divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {adminNotifications.map((n) => (
                  <div key={n.id} className="p-2.5 rounded-xl transition hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-bold text-slate-800">{n.title}</p>
                      <span className="text-[10px] text-slate-400">{n.time}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{n.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:block h-6 w-px bg-slate-200" />

        {/* Admin Badge */}
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-1 pr-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-xs shadow-xs">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-slate-900 leading-tight">
              {displayName}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              Placement Officer
            </p>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={onLogout}
          title="Sign Out"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 text-rose-600 hover:bg-rose-100 transition"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
