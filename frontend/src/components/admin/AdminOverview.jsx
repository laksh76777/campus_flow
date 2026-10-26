import {
  Users,
  Building2,
  Briefcase,
  FileCheck2,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import StatCard from "../ui/StatCard";

function FunnelRow({ icon: Icon, iconClass, label, count, unit, total, barClass, valueClass = "text-slate-900" }) {
  const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="flex min-w-0 items-center gap-2 text-slate-700">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} aria-hidden="true" />
          <span className="truncate">{label}</span>
        </span>
        <span className={`shrink-0 tabular-nums ${valueClass}`}>
          {count}
          {unit ? ` ${unit}` : ""}
          <span className="ml-1.5 font-medium text-slate-400">{pct}%</span>
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full transition-[width] duration-700 ease-out-soft ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminOverview({
  stats,
  students = [],
  drives = [],
  companies = [],
  applications = [],
  onNavigateTab,
  onOpenCreateDrive,
  onOpenCreateCompany,
}) {
  // Aggregate stats from API stats or directly from live collections - NO hardcoded fake numbers
  const totalStudents = stats?.students?.total ?? students.length;
  const totalCompanies = stats?.companies?.total ?? companies.length;
  const activeCompanies =
    stats?.companies?.active ??
    companies.filter((c) => c.isActive !== false).length;
  const totalDrives = stats?.placementDrives?.total ?? drives.length;
  const activeDrives =
    stats?.placementDrives?.active ??
    drives.filter((d) => d.isActive !== false).length;

  const appStats = {
    total: stats?.applications?.total ?? applications.length,
    applied:
      stats?.applications?.applied ??
      applications.filter((a) => a.status === "applied").length,
    shortlisted:
      stats?.applications?.shortlisted ??
      applications.filter((a) => a.status === "shortlisted").length,
    selected:
      stats?.applications?.selected ??
      applications.filter((a) => a.status === "selected").length,
    rejected:
      stats?.applications?.rejected ??
      applications.filter((a) => a.status === "rejected").length,
    withdrawn:
      stats?.applications?.withdrawn ??
      applications.filter((a) => a.status === "withdrawn").length,
  };

  const kpis = [
    {
      title: "Registered Students",
      value: totalStudents,
      sub: `${totalStudents} registered ${totalStudents === 1 ? "candidate" : "candidates"}`,
      icon: Users,
      tone: "blue",
      targetTab: "students",
    },
    {
      title: "Corporate Partners",
      value: totalCompanies,
      sub: `${activeCompanies} active of ${totalCompanies} registered`,
      icon: Building2,
      tone: "indigo",
      targetTab: "companies",
    },
    {
      title: "Placement Drives",
      value: totalDrives,
      sub: `${activeDrives} active of ${totalDrives} scheduled`,
      icon: Briefcase,
      tone: "emerald",
      targetTab: "drives",
    },
    {
      title: "Student Applications",
      value: appStats.total,
      sub: `${appStats.applied} pending review (${appStats.total} total)`,
      icon: FileCheck2,
      tone: "amber",
      targetTab: "applications",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero with quick actions */}
      <div className="relative overflow-hidden rounded-3xl border border-jss-900/40 bg-slate-950 p-6 text-white shadow-lg sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(167_60_24/0.45),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgb(30_48_168/0.35),transparent_50%)]"
        />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-bold text-amber-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              JSSATEB • TPO Administrative Command
            </div>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Placement Overview &amp; Recruitment Hub
            </h2>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
              JSS Academy of Technical Education, Bengaluru — Track recruitment metrics, publish corporate drives, evaluate applicant qualifications, and approve student job offers.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenCreateDrive}
              className="cf-btn min-h-10 bg-white px-4 text-slate-900 shadow-md hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
              <span>Create Placement Drive</span>
            </button>
            <button
              type="button"
              onClick={onOpenCreateCompany}
              className="cf-btn min-h-10 border-white/15 bg-white/10 px-4 text-white hover:bg-white/15"
            >
              <Plus className="h-4 w-4" />
              <span>Add Recruiter Company</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards (each opens its module) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.title}
            label={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            tone={kpi.tone}
            sub={kpi.sub}
            actionLabel="Manage"
            onClick={onNavigateTab ? () => onNavigateTab(kpi.targetTab) : undefined}
          />
        ))}
      </div>

      {/* Funnel & outcomes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="cf-card p-5 sm:p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">Application Review Funnel</h3>
              <p className="text-xs text-slate-500">Distribution across all placement drives</p>
            </div>
            <button type="button" onClick={() => onNavigateTab("applications")} className="cf-btn cf-btn-ghost shrink-0 text-brand-600">
              <span>Review All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <FunnelRow icon={Clock} iconClass="text-blue-500" label="Submitted / Under Initial Review" count={appStats.applied} unit="applications" total={appStats.total} barClass="bg-blue-500" />
            <FunnelRow icon={TrendingUp} iconClass="text-amber-500" label="Shortlisted for Interviews / OA" count={appStats.shortlisted} unit="candidates" total={appStats.total} barClass="bg-amber-500" />
            <FunnelRow icon={CheckCircle2} iconClass="text-emerald-500" label="Offers Extended / Placed" count={appStats.selected} unit="offers" total={appStats.total} barClass="bg-emerald-500" valueClass="font-bold text-emerald-600" />
            <FunnelRow icon={XCircle} iconClass="text-rose-400" label="Not Selected" count={appStats.rejected} total={appStats.total} barClass="bg-rose-400" valueClass="text-slate-500" />
          </div>
        </div>

        <div className="cf-card flex flex-col justify-between p-5 sm:p-6 lg:col-span-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recruitment Outcomes</h3>
            <p className="text-xs text-slate-500">Current application statuses from the selected dataset</p>

            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-black text-emerald-700 shadow-xs ring-1 ring-emerald-100 tabular-nums">
                {appStats.selected}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900">Selected applications</h4>
                <p className="mt-0.5 text-xs text-slate-500">Applications currently marked as selected.</p>
              </div>
            </div>

            <dl className="mt-4 divide-y divide-slate-100 text-xs">
              <div className="flex items-center justify-between px-1 py-2.5">
                <dt className="text-slate-500">Active companies</dt>
                <dd className="font-bold text-slate-800 tabular-nums">{activeCompanies}</dd>
              </div>
              <div className="flex items-center justify-between px-1 py-2.5">
                <dt className="text-slate-500">Active drives</dt>
                <dd className="font-bold text-brand-600 tabular-nums">{activeDrives}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => onNavigateTab("drives")}
              className="cf-btn min-h-10 w-full bg-slate-900 text-white hover:bg-slate-800"
            >
              <span>Manage Campus Placement Drives</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
