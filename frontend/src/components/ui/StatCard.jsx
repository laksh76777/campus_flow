import { ArrowUpRight } from "lucide-react";

const ICON_TONES = {
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  brand: "bg-brand-50 text-brand-600 ring-brand-100",
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  purple: "bg-purple-50 text-purple-600 ring-purple-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  jss: "bg-jss-50 text-jss-700 ring-jss-100",
};

/*
  Metric card shared by the student and TPO dashboards.
  When `onClick` is given the whole card is a single button (keyboard and
  screen-reader friendly) and `actionLabel` is shown as its affordance.
*/
export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
  sub,
  badge,
  badgeClassName = "border-slate-200 bg-slate-100 text-slate-600",
  actionLabel,
  onClick,
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button", onClick } : {})}
      className={`cf-card group relative flex w-full flex-col p-5 text-left ${onClick ? "cf-card-interactive" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="cf-eyebrow pt-1 transition-colors group-hover:text-slate-700">{label}</span>
        {Icon && (
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-200 group-hover:scale-105 ${
              ICON_TONES[tone] || ICON_TONES.brand
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">{value}</span>
        {badge && <span className={`cf-badge text-[10px]! ${badgeClassName}`}>{badge}</span>}
      </div>
      {sub && <p className="mt-1 text-xs font-medium text-slate-500">{sub}</p>}

      {actionLabel && (
        <span className="mt-4 flex items-center gap-1 border-t border-slate-100 pt-3 text-xs font-bold text-brand-600 transition-colors group-hover:text-brand-700">
          {actionLabel}
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      )}
    </Wrapper>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="cf-card p-5" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="cf-skeleton h-3 w-24" />
        <div className="cf-skeleton h-10 w-10 rounded-xl" />
      </div>
      <div className="cf-skeleton mt-4 h-8 w-16" />
      <div className="cf-skeleton mt-2 h-3 w-32" />
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="cf-skeleton h-3 w-20" />
      </div>
    </div>
  );
}
