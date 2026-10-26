import {
  LayoutDashboard,
  Briefcase,
  FileCheck2,
  User,
  LogOut,
  X,
  GraduationCap,
  ExternalLink,
  Bell,
  MessageCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { SidebarGroupLabel, SidebarNavItem } from "../ui/SidebarNav";
import useOverlay from "../../hooks/useOverlay";

export default function StudentSidebar({
  isOpen,
  setIsOpen,
  activeTab,
  setActiveTab,
  user,
  studentProfile,
  onLogout,
  unreadCount = 0,
}) {
  const navigate = useNavigate();
  useOverlay(isOpen, () => setIsOpen(false));

  const navItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "drives", label: "Placement Drives", icon: Briefcase },
    { id: "applications", label: "My Applications", icon: FileCheck2 },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unreadCount },
    { id: "support", label: "Ask TPO / Support", icon: MessageCircle, tag: "AI" },
    { id: "profile", label: "Academic Profile", icon: User },
  ];

  const displayName = user?.fullName || studentProfile?.user?.fullName || "Student";
  const displayEmail = user?.email || studentProfile?.user?.email || "Student account";
  const branch = studentProfile?.branch || "Department not set";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white select-none">
      {/* Brand */}
      <div className="shrink-0">
        <div className="flex h-16 items-center justify-between gap-2 border-b border-line px-4">
          <Link to="/" aria-label="CampusFlow home" className="group flex min-w-0 items-center gap-3 rounded-xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-600/20 transition-transform duration-200 group-hover:scale-[1.04]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-extrabold leading-tight tracking-tight text-slate-900">
                  CampusFlow
                </span>
                <span className="rounded-md border border-brand-100 bg-brand-50 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-brand-700">
                  STUDENT
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">Campus Portal</p>
            </div>
          </Link>

          <button
            type="button"
            aria-label="Close navigation drawer"
            onClick={() => setIsOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Student navigation" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        <SidebarGroupLabel>Menu</SidebarGroupLabel>
        {navItems.map((item) => (
          <SidebarNavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
            tag={item.tag}
            isActive={activeTab === item.id}
            onClick={() => {
              setActiveTab(item.id);
              setIsOpen(false);
            }}
          />
        ))}
      </nav>

      {/* Account + footer actions */}
      <div className="shrink-0 space-y-2 border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-2.5 ring-1 ring-line">
          {user?.avatar?.url ? (
            <img
              src={user.avatar.url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
              {avatarLetter}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900">{displayName}</p>
            <p className="truncate text-[11px] text-slate-500" title={`${branch} · ${displayEmail}`}>
              {branch}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-2 py-2 text-xs font-semibold text-slate-600 transition hover:border-line-strong hover:bg-slate-50 hover:text-slate-900"
          >
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            <span>Portal</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50/70 px-2 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100/80"
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
      {/* Desktop: sticky flex child, never overlaps content */}
      <aside className="sticky top-0 z-20 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white lg:flex xl:w-72">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Student navigation"
        >
          <button
            type="button"
            aria-label="Close student navigation drawer"
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
