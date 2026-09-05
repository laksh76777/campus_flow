import {
  LayoutDashboard,
  Briefcase,
  FileCheck2,
  User,
  LogOut,
  X,
  GraduationCap,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function StudentSidebar({
  isOpen,
  setIsOpen,
  activeTab,
  setActiveTab,
  user,
  studentProfile,
  onLogout,
}) {
  const navigate = useNavigate();

  const navItems = [
    {
      id: "overview",
      label: "Dashboard",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: "drives",
      label: "Placement Drives",
      icon: Briefcase,
      badge: "Active",
    },
    {
      id: "applications",
      label: "My Applications",
      icon: FileCheck2,
      badge: null,
    },
    {
      id: "profile",
      label: "Academic Profile",
      icon: User,
      badge: null,
    },
  ];

  const displayName = user?.fullName || studentProfile?.user?.fullName || "Student User";
  const displayEmail = user?.email || studentProfile?.user?.email || "student@college.edu";
  const branch = studentProfile?.branch || "Computer Science";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  // Reusable sidebar navigation content
  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white">
      {/* Top Section */}
      <div>
        {/* Brand Header */}
        <div className="flex h-18 items-center justify-between border-b border-slate-100 px-5">
          <div
            onClick={() => navigate("/")}
            className="flex cursor-pointer items-center gap-3 group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-slate-900 text-base">
                  PlaceTrack
                </span>
                <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-100">
                  STUDENT
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">Campus Portal</p>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Student Profile Quick Card */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
            <div className="relative shrink-0">
              {user?.avatar?.url ? (
                <img
                  src={user.avatar.url}
                  alt={displayName}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-blue-500/30"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-xs">
                  {avatarLetter}
                </div>
              )}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900">{displayName}</p>
              <p className="truncate text-[11px] text-slate-400">{branch}</p>
              <p className="truncate text-[10px] text-slate-400 font-mono">{displayEmail}</p>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="p-3 space-y-1">
          <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Menu
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? "text-white" : "text-slate-400 group-hover:text-blue-600"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1">
                  {item.badge && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-blue-700 text-white"
                          : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="h-3.5 w-3.5 text-blue-200" />}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Actions */}
      <div className="p-3 border-t border-slate-100 space-y-1.5">
        <button
          onClick={() => navigate("/")}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
        >
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          <span>Portal Home</span>
        </button>

        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100/70 transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar (Flex item in normal document flow: IMPOSSIBLE to overlap main content!) */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 sticky top-0 h-screen border-r border-slate-200 bg-white z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Only visible when toggled via hamburger on small screens) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] flex-1 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
