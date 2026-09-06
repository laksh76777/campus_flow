import {
  LayoutDashboard,
  BarChart3,
  Users,
  Briefcase,
  Building2,
  FileCheck2,
  LogOut,
  X,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminSidebar({
  isOpen,
  setIsOpen,
  activeTab,
  setActiveTab,
  adminUser,
  onLogout,
}) {
  const navigate = useNavigate();

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: "analytics",
      label: "Placement Analytics",
      icon: BarChart3,
      badge: "TPO",
    },
    {
      id: "students",
      label: "Registered Students",
      icon: Users,
      badge: "Cohort",
    },
    {
      id: "drives",
      label: "Placement Drives",
      icon: Briefcase,
      badge: "Manage",
    },
    {
      id: "companies",
      label: "Companies Directory",
      icon: Building2,
      badge: null,
    },
    {
      id: "applications",
      label: "Applicant Review",
      icon: FileCheck2,
      badge: "Actions",
    },
  ];

  const displayName = adminUser?.fullName || "Placement Admin";
  const displayEmail = adminUser?.email || "admin@placement.edu";

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-slate-900 text-slate-300">
      {/* Top Header */}
      <div>
        <div className="flex h-18 items-center justify-between border-b border-slate-800 px-5">
          <div
            onClick={() => navigate("/")}
            className="flex cursor-pointer items-center gap-3 group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-white text-base">
                  PlaceTrack
                </span>
                <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                  TPO
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">Administration Console</p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Admin User Chip */}
        <div className="p-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800/60 p-3 border border-slate-800">
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-xs">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{displayName}</p>
              <p className="truncate text-[11px] text-slate-400">Head of Placements</p>
              <p className="truncate text-[10px] text-indigo-300 font-mono">{displayEmail}</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Console Management
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
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:bg-slate-800/70 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1">
                  {item.badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-indigo-700 text-white"
                          : "bg-slate-800 text-indigo-300 border border-indigo-500/20"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="h-3.5 w-3.5 text-indigo-200" />}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Actions */}
      <div className="p-3 border-t border-slate-800/80 space-y-1.5">
        <button
          onClick={() => navigate("/")}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          <span>Public Portal Home</span>
        </button>

        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 sticky top-0 h-screen border-r border-slate-800 bg-slate-900 z-20">
        {sidebarContent}
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] flex-1 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
