import { Briefcase, FileCheck2, Trophy, GraduationCap } from "lucide-react";
import StatCard, { StatCardSkeleton } from "../ui/StatCard";

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
  const interviewCount = stats?.applications?.interview ?? 0;
  const selectedCount = stats?.applications?.selected ?? 0;
  const appliedCount = stats?.applications?.applied ?? 0;
  const withdrawnCount = stats?.applications?.withdrawn ?? 0;
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
      tone: "blue",
      actionText: "Browse Drives",
      actionTab: "drives",
    },
    {
      title: "Applications Sent",
      value: totalApplications,
      subtext:
        appliedCount > 0
          ? `${appliedCount} in active review`
          : withdrawnCount > 0
          ? `${withdrawnCount} withdrawn`
          : "0 in active review",
      badge:
        appliedCount > 0
          ? "In Progress"
          : withdrawnCount > 0
          ? "Withdrawn"
          : "No Pending",
      badgeColor:
        appliedCount > 0
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : withdrawnCount > 0
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-slate-100 text-slate-600 border-slate-200",
      icon: FileCheck2,
      tone: "indigo",
      actionText: "View History",
      actionTab: "applications",
    },
    {
      title: "Interviews & Offers",
      value: interviewCount + shortlistedCount + selectedCount,
      subtext:
        selectedCount > 0
          ? `${selectedCount} offer extended`
          : interviewCount > 0
          ? `${interviewCount} interview scheduled`
          : shortlistedCount > 0
          ? `${shortlistedCount} round(s) cleared`
          : "No active stages yet",
      badge:
        selectedCount > 0
          ? "Offer Secured"
          : interviewCount > 0
          ? "Interview Live"
          : shortlistedCount > 0
          ? "Shortlisted"
          : "In Pipeline",
      badgeColor:
        selectedCount > 0
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : interviewCount > 0
          ? "bg-purple-50 text-purple-700 border-purple-200"
          : shortlistedCount > 0
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-slate-100 text-slate-600 border-slate-200",
      icon: Trophy,
      tone: selectedCount > 0 ? "emerald" : interviewCount > 0 ? "purple" : "amber",
      actionText: "View Pipeline",
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
      tone: "emerald",
      actionText: "Academic Profile",
      actionTab: "profile",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading dashboard statistics">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statCards.map((card) => (
        <StatCard
          key={card.title}
          label={card.title}
          value={card.value}
          icon={card.icon}
          tone={card.tone}
          sub={card.subtext}
          badge={card.badge}
          badgeClassName={card.badgeColor}
          actionLabel={card.actionText}
          onClick={onTabChange ? () => onTabChange(card.actionTab) : undefined}
        />
      ))}
    </div>
  );
}
