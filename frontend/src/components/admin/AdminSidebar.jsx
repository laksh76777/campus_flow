import {
  LayoutDashboard,
  BarChart3,
  Users,
  Briefcase,
  Workflow,
  Building2,
  FileCheck2,
  LogOut,
  X,
  ExternalLink,
  Calendar,
  FileSpreadsheet,
  Bell,
  MessageCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { SidebarGroupLabel, SidebarNavItem } from "../ui/SidebarNav";
import useOverlay from "../../hooks/useOverlay";

// Same items and order as before, grouped under section labels for scanning.
const NAV_GROUPS = [
  {
    label: "Insights",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "analytics", label: "Placement Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Placement Operations",
    items: [
      { id: "students", label: "Registered Students", icon: Users },
      { id: "drives", label: "Placement Drives", icon: Briefcase },
      { id: "automated_drives", label: "Automated Placement Drive", icon: Workflow },
      { id: "companies", label: "Companies Directory", icon: Building2 },
      { id: "applications", label: "Applicant Review", icon: FileCheck2 },
    ],
  },
  {
    label: "Administration",
    items: [
      { id: "sessions", label: "Placement Sessions", icon: Calendar },
      { id: "excel_hub", label: "Excel Import & Exports", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Communication",
    items: [
      { id: "announcements", label: "Broadcasts & Alerts", icon: Bell },
      { id: "support", label: "Student Support Inbox", icon: MessageCircle, tag: "AI" },
    ],
  },
];

export default function AdminSidebar({
  isOpen,
  setIsOpen,
  activeTab,
  setActiveTab,
  adminUser,
  onLogout,
}) {
  const navigate = useNavigate();
  useOverlay(isOpen, () => setIsOpen(false));

  const displayName = adminUser?.fullName || "Placement Administrator";
  const displayEmail = adminUser?.email || "Admin account";

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-300 select-none">
      {/* Brand */}
      <div className="shrink-0">
        <div className="flex h-16 items-center justify-between gap-2 border-b border-white/[0.06] px-4">
          <Link
            to="/"
            aria-label="JSSATEB Placement Portal home"
            className="group flex min-w-0 items-center gap-3 rounded-xl"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-md ring-1 ring-amber-400/30 transition-transform duration-200 group-hover:scale-[1.04]">
              <img
                src="/images/jssateb/college-logo.png"
                alt=""
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-extrabold leading-tight tracking-tight text-white">
                  JSSATEB
                </span>
                <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-amber-300">
                  TPO
                </span>
              </div>
              <p className="truncate text-[11px] font-medium text-slate-400">Placement Management</p>
            </div>
          </Link>

          <button
            type="button"
            aria-label="Close navigation drawer"
            onClick={() => setIsOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation (scrolls independently, footer stays pinned) */}
      <nav
        aria-label="Admin navigation"
        className="dark-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <SidebarGroupLabel tone="dark">{group.label}</SidebarGroupLabel>
            {group.items.map((item) => (
              <SidebarNavItem
                key={item.id}
                tone="dark"
                icon={item.icon}
                label={item.label}
                tag={item.tag}
                isActive={activeTab === item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Account + footer actions */}
      <div className="shrink-0 space-y-2 border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/[0.06]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-jss-700 to-amber-600 text-xs font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{displayName}</p>
            <p className="truncate text-[11px] text-slate-400" title={displayEmail}>
              {displayEmail}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-slate-300 ring-1 ring-white/[0.08] transition hover:bg-white/[0.06] hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            <span>Portal</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-rose-500/10 px-2 py-2 text-xs font-bold text-rose-300 ring-1 ring-rose-500/20 transition hover:bg-rose-500/20 hover:text-rose-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 z-20 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-900 bg-slate-950 lg:flex xl:w-72">
        {sidebarContent}
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
        >
          <button
            type="button"
            aria-label="Close admin navigation drawer"
            tabIndex={-1}
            className="cf-backdrop"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative z-10 h-full w-72 max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
