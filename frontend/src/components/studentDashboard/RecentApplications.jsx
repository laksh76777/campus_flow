import { useState, useMemo } from "react";
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Search,
} from "lucide-react";

export default function RecentApplications({
  applications = [],
  onWithdraw,
  title = "My Applications",
  description = "Real-time tracker of companies you have applied to",
  showSearch = true,
  maxItems = null,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const drive = app.placementDrive || {};
      const companyName = drive.company?.companyName || drive.companyName || "";
      const jobTitle = drive.jobTitle || "";

      const matchesSearch =
        companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        jobTitle.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || app.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [applications, searchTerm, statusFilter]);

  const displayList = maxItems
    ? filteredApplications.slice(0, maxItems)
    : filteredApplications;

  const formatDate = (dateStr) => {
    if (!dateStr) return "Recently";
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

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "selected":
        return {
          label: "Selected / Offered",
          color: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: CheckCircle2,
        };
      case "shortlisted":
        return {
          label: "Shortlisted",
          color: "bg-amber-50 text-amber-700 border-amber-200",
          icon: Sparkles,
        };
      case "rejected":
        return {
          label: "Not Selected",
          color: "bg-rose-50 text-rose-700 border-rose-200",
          icon: XCircle,
        };
      case "withdrawn":
        return {
          label: "Withdrawn",
          color: "bg-slate-100 text-slate-600 border-slate-200",
          icon: RotateCcw,
        };
      case "applied":
      default:
        return {
          label: "Under Review",
          color: "bg-blue-50 text-blue-700 border-blue-200",
          icon: Clock,
        };
    }
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
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{title}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
              {filteredApplications.length}
            </span>
          </h2>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>

        {showSearch && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="applied">Under Review</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="selected">Selected</option>
              <option value="rejected">Not Selected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        )}
      </div>

      {/* Applications List */}
      {displayList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-2">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <h3 className="text-xs font-bold text-slate-800">No applications found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-xs">
            {searchTerm
              ? "No applications match your search criteria."
              : "You haven't submitted any placement applications yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Company & Role</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Applied Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {displayList.map((app) => {
                  const drive = app.placementDrive || {};
                  const companyName =
                    drive.company?.companyName || drive.companyName || "Company";
                  const statusInfo = getStatusBadge(app.status);
                  const StatusIcon = statusInfo.icon;
                  const canWithdraw = app.status === "applied" || app.status === "shortlisted";

                  return (
                    <tr key={app._id} className="transition hover:bg-slate-50/50">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${getCompanyColor(
                              companyName
                            )} text-xs font-bold text-white shadow-xs`}
                          >
                            {companyName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{companyName}</p>
                            <p className="text-slate-500 text-[11px]">{drive.jobTitle || "Job Position"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">
                        ₹{drive.package || "N/A"} LPA
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                        {formatDate(app.appliedAt || app.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusInfo.color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {canWithdraw ? (
                          <button
                            onClick={() => onWithdraw && onWithdraw(app._id, companyName)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline transition"
                          >
                            Withdraw
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="divide-y divide-slate-100 sm:hidden">
            {displayList.map((app) => {
              const drive = app.placementDrive || {};
              const companyName =
                drive.company?.companyName || drive.companyName || "Company";
              const statusInfo = getStatusBadge(app.status);
              const StatusIcon = statusInfo.icon;
              const canWithdraw = app.status === "applied" || app.status === "shortlisted";

              return (
                <div key={app._id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr ${getCompanyColor(
                          companyName
                        )} text-xs font-bold text-white`}
                      >
                        {companyName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">{companyName}</h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {drive.jobTitle || "Job Position"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusInfo.color}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Package: <strong className="text-slate-800">₹{drive.package || "N/A"} LPA</strong></span>
                    <span>Applied: {formatDate(app.appliedAt || app.createdAt)}</span>
                  </div>

                  {canWithdraw && (
                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => onWithdraw && onWithdraw(app._id, companyName)}
                        className="text-[11px] font-bold text-rose-600 hover:underline"
                      >
                        Withdraw Application
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
