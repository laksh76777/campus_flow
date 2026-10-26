/*
  Shared sidebar navigation primitives used by the student portal (light)
  and the TPO console (dark). Same spacing, active indicator and motion in
  both; only the colour tone differs.
*/

const TONES = {
  light: {
    label: "text-slate-400",
    base: "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
    active: "bg-brand-50 text-brand-700",
    icon: "text-slate-400 group-hover:text-slate-600",
    iconActive: "text-brand-600",
    indicator: "bg-brand-600",
  },
  dark: {
    label: "text-slate-500",
    base: "text-slate-400 hover:bg-white/[0.06] hover:text-white",
    active: "bg-white/[0.09] text-white",
    icon: "text-slate-500 group-hover:text-slate-300",
    iconActive: "text-amber-300",
    indicator: "bg-amber-400",
  },
};

export function SidebarGroupLabel({ children, tone = "light" }) {
  return (
    <p className={`px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] ${TONES[tone].label}`}>
      {children}
    </p>
  );
}

export function SidebarNavItem({ icon: Icon, label, isActive, onClick, badge, tag, tone = "light" }) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
      className={`group relative flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-colors duration-150 ${
        isActive ? t.active : t.base
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-200 ease-out-soft ${
          isActive ? `${t.indicator} opacity-100` : "scale-y-50 opacity-0"
        }`}
      />
      <Icon
        aria-hidden="true"
        className={`h-[18px] w-[18px] shrink-0 transition-colors duration-150 ${isActive ? t.iconActive : t.icon}`}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {tag && (
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
            tone === "dark" ? "bg-violet-500/20 text-violet-200" : "bg-violet-50 text-violet-700"
          }`}
        >
          {tag}
        </span>
      )}
      {badge > 0 && (
        <span
          className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black leading-none text-white tabular-nums"
          aria-label={`${badge} unread`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
