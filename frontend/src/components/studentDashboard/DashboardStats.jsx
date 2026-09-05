import {
  Briefcase,
  FileCheck2,
  Trophy,
  GraduationCap,
  ArrowUpRight,
} from "lucide-react";

export default function DashboardStats({
  stats,
  studentProfile,
  onTabChange,
  loading = false,
}) {
  const activeEligible = stats?.placementDrives?.activeEligible ?? 0;
  const totalEligible = stats?.placementDrives?.eligible ?? 0;
  const totalApplications = stats?.applications?.total ?? 0;
  const shortlistedCount = stats?.applications?.shortlisted ?? 0;
  const selectedCount = stats?.applications?.selected ?? 0;
  const appliedCount = stats?.applications?.applied ?? 0;
  const cgpa = studentProfile?.cgpa != null ? studentProfile.cgpa : "--";
  const backlogs = studentProfile?.backlogs ?? 0;

  const statCards = [
    {
      title: "Eligible Drives",
      value: activeEligible,
      subtext: `${totalEligible} total matched opportunities`,
      badge: activeEligible > 0 ? "Open Now" : "None Open",
      badgeColor: activeEligible > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200",
      icon: Briefcase,
      iconBg: "bg-blue-600 text-white shadow-blue-500/20",
      actionText: "Browse Drives",
      actionTab: "drives",
    },
    {
      title: "Applications Sent",
      value: totalApplications,
      subtext: `${appliedCount} in active review`,
      badge: appliedCount > 0 ? "In Progress" : "No Pending",
      badgeColor: appliedCount > 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200",
      icon: FileCheck2,
      iconBg: "bg-indigo-600 text-white shadow-indigo-500/20",
      actionText: "View History",
      actionTab: "applications",
    },
    {
      title: "Shortlisted & Offers",
      value: shortlistedCount + selectedCount,
      subtext: selectedCount > 0 ? `${selectedCount} offer received` : shortlistedCount > 0 ? `${shortlistedCount} round(s) cleared` : "No offers yet",
      badge: selectedCount > 0 ? "Offered" : shortlistedCount > 0 ? "Shortlisted" : "In Review",
      badgeColor: selectedCount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : shortlistedCount > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200",
      icon: Trophy,
      iconBg: "bg-amber-500 text-white shadow-amber-500/20",
      actionText: "Check Status",
      actionTab: "applications",
    },
    {
      title: "Academic Standing",
      value: typeof cgpa === "number" ? cgpa.toFixed(2) : cgpa,
      subtext: backlogs === 0 ? "Zero Active Backlogs" : `${backlogs} Backlog(s)`,
      badge: backlogs === 0 ? "Eligible" : "Needs Review",
      badgeColor:
        backlogs === 0
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-rose-50 text-rose-700 border-rose-200",
      icon: GraduationCap,
      iconBg: "bg-emerald-600 text-white shadow-emerald-500/20",
      actionText: "Academic Profile",
      actionTab: "profile",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-36 rounded-2xl border border-slate-200 bg-white p-5 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-10 w-10 rounded-xl bg-slate-200" />
            </div>
            <div className="mt-4 h-8 w-16 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statCards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                {card.title}
              </span>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-md transition-transform group-hover:scale-105 ${card.iconBg}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-2">
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {card.value}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${card.badgeColor}`}
                >
                  {card.badge}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 font-medium">
                {card.subtext}
              </p>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <button
                onClick={() => onTabChange && onTabChange(card.actionTab)}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 transition group-hover:text-blue-700 hover:underline"
              >
                <span>{card.actionText}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
