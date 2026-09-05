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

  const placementRatio =
    totalStudents > 0
      ? Math.min(100, Math.round(((appStats.selected || 0) / totalStudents) * 100))
      : 0;

  const kpis = [
    {
      title: "Registered Students",
      value: totalStudents,
      sub: `${totalStudents} registered candidates`,
      icon: Users,
      color: "bg-blue-600 text-white shadow-blue-500/25",
      targetTab: "students",
    },
    {
      title: "Corporate Partners",
      value: totalCompanies,
      sub: `${activeCompanies} active of ${totalCompanies} registered`,
      icon: Building2,
      color: "bg-indigo-600 text-white shadow-indigo-500/25",
      targetTab: "companies",
    },
    {
      title: "Placement Drives",
      value: totalDrives,
      sub: `${activeDrives} active of ${totalDrives} scheduled`,
      icon: Briefcase,
      color: "bg-emerald-600 text-white shadow-emerald-500/25",
      targetTab: "drives",
    },
    {
      title: "Student Applications",
      value: appStats.total,
      sub: `${appStats.applied} pending review (${appStats.total} total)`,
      icon: FileCheck2,
      color: "bg-amber-500 text-white shadow-amber-500/25",
      targetTab: "applications",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
              <Sparkles className="h-3.5 w-3.5" />
              TPO Administrative Command
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Placement Season 2025–26 Overview
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300 max-w-xl">
              Track recruitment metrics, publish new corporate drives, evaluate applicant qualifications, and approve final student job offers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenCreateDrive}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Create Placement Drive</span>
            </button>
            <button
              onClick={onOpenCreateCompany}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Recruiter Company</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Top KPI Cards - Clickable Navigators */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              onClick={() => onNavigateTab && onNavigateTab(kpi.targetTab)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onNavigateTab && onNavigateTab(kpi.targetTab);
                }
              }}
              title={`Click to open ${kpi.title}`}
              className="group relative cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg active:scale-98 select-none"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">
                  {kpi.title}
                </span>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {kpi.value}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>{kpi.sub}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Manage</span>
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Funnel & Application Pipeline Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Application Status Conversion Funnel */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Application Review Funnel
              </h3>
              <p className="text-xs text-slate-500">
                Distribution across all placement drives
              </p>
            </div>
            <button
              onClick={() => onNavigateTab("applications")}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>Review All</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {/* Applied */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  Submitted / Under Initial Review
                </span>
                <span className="text-slate-900">{appStats.applied} applications</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      appStats.total > 0
                        ? Math.min(100, Math.round((appStats.applied / appStats.total) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Shortlisted */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                  Shortlisted for Interviews / OA
                </span>
                <span className="text-slate-900">{appStats.shortlisted} candidates</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      appStats.total > 0
                        ? Math.min(100, Math.round((appStats.shortlisted / appStats.total) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Selected */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Offers Extended / Placed
                </span>
                <span className="text-slate-900 font-bold text-emerald-600">
                  {appStats.selected} offers
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      appStats.total > 0
                        ? Math.min(100, Math.round((appStats.selected / appStats.total) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Rejected */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <XCircle className="h-3.5 w-3.5 text-rose-400" />
                  Not Selected
                </span>
                <span className="text-slate-500">{appStats.rejected}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-rose-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      appStats.total > 0
                        ? Math.min(100, Math.round((appStats.rejected / appStats.total) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Insights & Next Steps */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Campus Placement Health
            </h3>
            <p className="text-xs text-slate-500">
              Real-time placement efficiency index
            </p>

            <div className="mt-6 flex items-center gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-black text-xl shadow-xs">
                {placementRatio}%
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Cohort Placement Conversion
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Percentage of candidates holding at least 1 verified offer letter.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                <span className="text-slate-500">Active Companies:</span>
                <span className="font-bold text-slate-800">{activeCompanies} verified</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                <span className="text-slate-500">Upcoming Drive Dates:</span>
                <span className="font-bold text-blue-600">{activeDrives} scheduled</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigateTab("drives")}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
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
