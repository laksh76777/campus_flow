import { useState, useMemo } from "react";
import {
  MapPin,
  ArrowRight,
  Search,
  CheckCircle,
  Briefcase,
  GraduationCap,
  RotateCcw,
  AlertTriangle,
  FileText,
  XCircle,
} from "lucide-react";

export default function RecentDrives({
  drives = [],
  appliedDriveIds = new Set(),
  withdrawnDriveIds = new Set(),
  onApplyClick,
  title = "Campus Placement Drives",
  description = "Active campus recruitment drives with your live eligibility status",
  showSearch = true,
  maxItems = null,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Filter drives
  const filteredDrives = useMemo(() => {
    return drives.filter((drive) => {
      const companyName = drive.company?.companyName || drive.companyName || "";
      const jobTitle = drive.jobTitle || "";
      const location = drive.location || "";

      const matchesSearch =
        companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        typeFilter === "all" || drive.jobType === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [drives, searchTerm, typeFilter]);

  const displayList = maxItems ? filteredDrives.slice(0, maxItems) : filteredDrives;

  const formatDate = (dateStr) => {
    if (!dateStr) return "TBD";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatDeadline = (dateStr) => {
    if (!dateStr) return null;
    const diffDays = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: "Ended", color: "text-rose-600 bg-rose-50 border-rose-200" };
    if (diffDays === 0) return { label: "Ends Today", color: "text-amber-700 bg-amber-50 border-amber-200" };
    if (diffDays <= 3) return { label: `${diffDays}d left`, color: "text-amber-700 bg-amber-50 border-amber-200" };
    return { label: `Deadline: ${formatDate(dateStr)}`, color: "text-slate-600 bg-slate-100 border-slate-200" };
  };

  const getCompanyColor = (name = "") => {
    const colors = [
      "from-blue-600 to-indigo-600",
      "from-emerald-600 to-teal-600",
      "from-purple-600 to-violet-600",
      "from-amber-500 to-orange-600",
      "from-rose-600 to-pink-600",
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{title}</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-100">
              {filteredDrives.length}
            </span>
          </h2>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>

        {showSearch && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search company or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500"
            >
              <option value="all">All Job Types</option>
              <option value="full-time">Full Time</option>
              <option value="internship">Internship</option>
              <option value="internship-to-full-time">Intern to FTE</option>
            </select>
          </div>
        )}
      </div>

      {/* Drives Grid */}
      {displayList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-2">
            <Briefcase className="h-5 w-5" />
          </div>
          <h3 className="text-xs font-bold text-slate-800">No placement drives found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-xs">
            {searchTerm
              ? "No drives match your filters."
              : "No active drives available right now."}
          </p>
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
                setTypeFilter("all");
              }}
              className="mt-2 text-xs font-bold text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {displayList.map((drive) => {
            const companyName = drive.company?.companyName || drive.companyName || "Partner Company";
            const driveIdStr = drive._id ? String(drive._id) : "";
            const isApplied = appliedDriveIds.has(drive._id) || (driveIdStr && appliedDriveIds.has(driveIdStr));
            const isWithdrawn = !isApplied && (withdrawnDriveIds.has(drive._id) || (driveIdStr && withdrawnDriveIds.has(driveIdStr)));
            const deadlineInfo = formatDeadline(drive.applicationDeadline);
            const isEnded = deadlineInfo?.label === "Ended";
            const isEligible = drive.isEligible !== false;

            return (
              <div
                key={drive._id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  {/* Top Row: Company & Package Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${getCompanyColor(
                          companyName
                        )} text-base font-extrabold text-white shadow-xs`}
                      >
                        {companyName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {companyName}
                        </h3>
                        <p className="text-xs font-semibold text-slate-500 truncate">
                          {drive.jobTitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200/80 whitespace-nowrap">
                        ₹{drive.package} LPA
                      </span>
                      {drive.isEligible !== undefined && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${
                            isEligible
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {isEligible ? (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              <span>Eligible</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" />
                              <span>Not Eligible</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata Tags */}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 font-semibold capitalize">
                      <Briefcase className="h-3 w-3 text-slate-400" />
                      {drive.jobType?.replace(/-/g, " ") || "Full Time"}
                    </span>

                    {/* Paid / Unpaid Internship Badge */}
                    {drive.internshipType === "paid" && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                        Paid Internship {drive.stipend ? `• ${drive.stipend}` : ""}
                      </span>
                    )}
                    {drive.internshipType === "unpaid" && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
                        Unpaid Internship
                      </span>
                    )}

                    {drive.internshipDuration && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                        {drive.internshipDuration}
                      </span>
                    )}

                    {drive.location && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 font-semibold">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {drive.location}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 font-semibold border border-blue-100">
                      <GraduationCap className="h-3 w-3 text-blue-500" />
                      Min {drive.minimumCGPA} CGPA
                    </span>

                    {/* JD PDF Attachment Link */}
                    {drive.jdPdf?.url && (
                      <a
                        href={drive.jdPdf.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                        title="View Official Job Description PDF"
                      >
                        <FileText className="h-3 w-3" />
                        <span>JD (PDF)</span>
                      </a>
                    )}
                  </div>

                  {/* Ineligible Explanation Note Banner */}
                  {!isEligible && (
                    <div className="mt-2.5 rounded-xl bg-amber-50/80 border border-amber-200 p-2 text-xs text-amber-900 space-y-0.5">
                      <div className="flex items-center gap-1 font-bold text-amber-800 text-[11px]">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>Not Eligible to Apply:</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        {drive.eligibilityReasons?.[0] || drive.eligibilitySummary || "Academic criteria thresholds not satisfied."}
                      </p>
                      <p className="text-[10px] text-slate-500 italic">
                        Update your academic profile settings if your records have changed to unlock eligibility.
                      </p>
                    </div>
                  )}

                  {/* Branches Pill */}
                  <div className="mt-2.5 rounded-xl bg-slate-50 p-2 text-[11px] text-slate-600 border border-slate-100">
                    <span className="font-medium text-slate-400">Branches: </span>
                    <span className="font-semibold text-slate-800">
                      {Array.isArray(drive.eligibleBranches)
                        ? drive.eligibleBranches.join(", ")
                        : "All Branches"}
                    </span>
                  </div>
                </div>

                {/* Card Bottom: Deadline & Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    {deadlineInfo && (
                      <span
                        className={`inline-block font-bold px-2 py-0.5 rounded-md border text-[10px] ${deadlineInfo.color}`}
                      >
                        {deadlineInfo.label}
                      </span>
                    )}
                  </div>

                  {isApplied ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Applied
                    </span>
                  ) : isWithdrawn ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        Withdrawn
                      </span>
                      {!isEnded && (
                        <button
                          onClick={() => onApplyClick(drive)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition active:scale-95"
                          title="Re-apply to this placement drive"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Re-apply</span>
                        </button>
                      )}
                    </div>
                  ) : !isEligible ? (
                    <button
                      onClick={() => onApplyClick(drive)}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition active:scale-95"
                      title="Inspect eligibility criteria and job details"
                    >
                      <span>View Details</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onApplyClick(drive)}
                      className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-95"
                    >
                      <span>Apply Now</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
