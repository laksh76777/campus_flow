import { useState, useMemo } from "react";
import {
  FileCheck2,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  FileText,
  Building2,
  ExternalLink,
  Edit3,
  X,
  AlertCircle,
  Calendar,
  DollarSign,
} from "lucide-react";
import toast from "react-hot-toast";
import { getResumeViewUrl } from "../../utils/resumeHelper";

export default function ManageApplications({
  applications = [],
  drives = [],
  selectedDriveId = "all",
  onSelectDrive,
  onUpdateStatus,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeModalApp, setActiveModalApp] = useState(null);
  const [newStatus, setNewStatus] = useState("shortlisted");
  const [remarks, setRemarks] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewRound, setInterviewRound] = useState("Technical Round 1");
  const [interviewLocation, setInterviewLocation] = useState("Google Meet");
  const [offeredPackage, setOfferedPackage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter applications by drive, search term, and status
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // 1. Filter by Drive
      const driveMatch =
        selectedDriveId === "all" ||
        app.placementDrive?._id === selectedDriveId ||
        app.placementDrive === selectedDriveId;

      if (!driveMatch) return false;

      // 2. Filter by Status
      if (statusFilter !== "all" && app.status !== statusFilter) {
        return false;
      }

      // 3. Search query
      const student = app.student || {};
      const user = student.user || {};
      const fullName = user.fullName || student.fullName || "";
      const email = user.email || student.email || "";
      const enrollmentNo = student.enrollmentNumber || "";
      const branch = student.branch || "";

      const query = searchTerm.toLowerCase();
      return (
        fullName.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        enrollmentNo.toLowerCase().includes(query) ||
        branch.toLowerCase().includes(query)
      );
    });
  }, [applications, selectedDriveId, statusFilter, searchTerm]);

  const handleOpenStatusModal = (app, presetStatus = null) => {
    setActiveModalApp(app);
    setNewStatus(presetStatus || app.status || "shortlisted");
    setRemarks(app.remarks || "");
    setInterviewDate(
      app.interviewDate
        ? new Date(app.interviewDate).toISOString().slice(0, 16)
        : ""
    );
    setInterviewRound(app.interviewRound || "Technical Round 1");
    setInterviewLocation(app.interviewLocation || "Google Meet");
    setOfferedPackage(
      app.offeredPackage !== undefined && app.offeredPackage !== null
        ? String(app.offeredPackage)
        : app.placementDrive?.package ? String(app.placementDrive.package) : ""
    );
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!activeModalApp) return;

    try {
      setSubmitting(true);
      const extraDetails = {};
      if (newStatus === "interview") {
        if (interviewDate) extraDetails.interviewDate = interviewDate;
        if (interviewRound) extraDetails.interviewRound = interviewRound;
        if (interviewLocation) extraDetails.interviewLocation = interviewLocation;
      }
      if (newStatus === "selected") {
        if (offeredPackage) extraDetails.offeredPackage = Number(offeredPackage);
      }

      await onUpdateStatus(activeModalApp._id, newStatus, remarks, extraDetails);
      toast.success(`Application updated to "${newStatus}"!`);
      setActiveModalApp(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update application status");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "applied":
        return {
          label: "Applied",
          icon: Clock,
          classes: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case "shortlisted":
        return {
          label: "Shortlisted",
          icon: TrendingUp,
          classes: "bg-amber-50 text-amber-700 border-amber-200",
        };
      case "interview":
        return {
          label: "Interview Scheduled",
          icon: Calendar,
          classes: "bg-purple-50 text-purple-700 border-purple-200",
        };
      case "selected":
        return {
          label: "Selected / Offered",
          icon: CheckCircle2,
          classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "rejected":
        return {
          label: "Rejected",
          icon: XCircle,
          classes: "bg-rose-50 text-rose-700 border-rose-200",
        };
      case "withdrawn":
        return {
          label: "Withdrawn",
          icon: AlertCircle,
          classes: "bg-slate-100 text-slate-600 border-slate-200",
        };
      default:
        return {
          label: status,
          icon: Clock,
          classes: "bg-slate-100 text-slate-700 border-slate-200",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Student Applicant Review & Shortlisting
            </h2>
            <span className="rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              {filteredApplications.length} Candidates
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review student applications, verify resumes, and advance candidates through the interview pipeline.
          </p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs">
        {/* Placement Drive Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs font-bold text-slate-600 shrink-0 hidden sm:inline-block">
            Filter by Drive:
          </label>
          <select
            value={selectedDriveId}
            onChange={(e) => onSelectDrive(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:border-amber-500 focus:outline-none"
          >
            <option value="all">All Placement Drives ({applications.length})</option>
            {drives.map((d) => {
              const compName =
                typeof d.company === "object" ? d.company?.companyName : d.companyName || "";
              return (
                <option key={d._id} value={d._id}>
                  {compName ? `${compName} - ` : ""}{d.jobTitle}
                </option>
              );
            })}
          </select>
        </div>

        {/* Search Field */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidate by name, enrollment no, or branch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-amber-500 focus:outline-none transition"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto shrink-0">
          {[
            { id: "all", label: "All" },
            { id: "applied", label: "Applied" },
            { id: "shortlisted", label: "Shortlisted" },
            { id: "interview", label: "Interview" },
            { id: "selected", label: "Selected" },
            { id: "rejected", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? "bg-white text-amber-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <FileCheck2 className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-800">No applications match your criteria</h3>
          <p className="text-xs text-slate-400 mt-1">
            Try choosing a different placement drive or clearing your search filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApplications.map((app) => {
            const student = app.student || {};
            const user = student.user || {};
            const studentName = user.fullName || student.fullName || "Candidate";
            const studentEmail = user.email || student.email || "student@campus.edu";
            const enrollmentNo = student.enrollmentNumber || "ENR-2026";
            const branch = student.branch || "CSE";
            const cgpa = student.cgpa ?? "8.2";
            const backlogs = student.activeBacklogs ?? 0;
            const rawResumeUrl = student.resume?.url || student.resumeUrl;
            const resumeUrl = getResumeViewUrl(rawResumeUrl);

            const drive = app.placementDrive || {};
            const driveCompName =
              typeof drive.company === "object" ? drive.company?.companyName : drive.companyName || "Partner";
            const driveTitle = drive.jobTitle || "Engineering Role";
            const drivePackage = drive.package ? `₹${drive.package} LPA` : "";

            const statusObj = getStatusBadge(app.status);
            const StatusIcon = statusObj.icon;

            const appliedDate = app.appliedAt
              ? new Date(app.appliedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Recent";

            return (
              <div
                key={app._id}
                className="group flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition hover:border-slate-300 hover:shadow-md"
              >
                {/* Left: Student Identity & Academic Profile */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-bold text-lg shadow-xs">
                    {studentName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {studentName}
                      </h4>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-600">
                        {enrollmentNo}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {studentEmail}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {branch}
                      </span>
                      <span>•</span>
                      <span>CGPA: <strong className="text-slate-900">{cgpa}</strong></span>
                      <span>•</span>
                      <span>Backlogs: <strong className="text-slate-900">{backlogs}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Middle: Applied Drive Details & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="flex items-center sm:justify-end gap-1.5 text-xs font-bold text-slate-800">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      <span>{driveCompName}</span>
                    </div>
                    <p className="text-xs text-slate-500">{driveTitle} {drivePackage ? `(${drivePackage})` : ""}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Applied: {appliedDate}</p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border ${statusObj.classes}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      <span>{statusObj.label}</span>
                    </span>

                    {app.status === "interview" && app.interviewDate && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {app.interviewRound || "Interview"}:{" "}
                          {new Date(app.interviewDate).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}

                    {app.status === "selected" && (app.offeredPackage || drive.package) && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <DollarSign className="h-3 w-3" />
                        <span>Offered: ₹{app.offeredPackage || drive.package} LPA</span>
                      </div>
                    )}

                    {app.remarks && (
                      <p className="text-[11px] text-slate-500 italic max-w-xs truncate text-right">
                        "{app.remarks}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 shrink-0">
                  {/* Resume Link */}
                  {resumeUrl ? (
                    <a
                      href={resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      title="View Student Resume"
                    >
                      <FileText className="h-3.5 w-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Resume</span>
                      <ExternalLink className="h-3 w-3 text-slate-400" />
                    </a>
                  ) : (
                    <button
                      disabled
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-400 opacity-60 cursor-not-allowed"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">No Resume</span>
                    </button>
                  )}

                  {/* Quick Action: Change Status Modal */}
                  <button
                    onClick={() => handleOpenStatusModal(app)}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition active:scale-95"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Update Status</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Update Status Modal */}
      {activeModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Update Application Status
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Candidate: {activeModalApp.student?.user?.fullName || "Candidate"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalApp(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="mt-4 space-y-4">
              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Recruitment Pipeline Stage
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "applied", label: "Applied", desc: "Initial state" },
                    { id: "shortlisted", label: "Shortlisted", desc: "Screening cleared" },
                    { id: "interview", label: "Interview", desc: "Rounds scheduled" },
                    { id: "selected", label: "Selected", desc: "Job offer extended" },
                    { id: "rejected", label: "Rejected", desc: "Not progressed" },
                  ].map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setNewStatus(s.id)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        newStatus === s.id
                          ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                          : "border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <p className="text-xs font-bold leading-none">{s.label}</p>
                      <p className={`text-[10px] mt-1 ${newStatus === s.id ? "text-slate-300" : "text-slate-400"}`}>
                        {s.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional: Interview Scheduling Details */}
              {newStatus === "interview" && (
                <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-100 space-y-3 animate-in fade-in-50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <span>Interview Scheduling Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Interview Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={interviewDate}
                        onChange={(e) => setInterviewDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Round Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Technical Assessment 1"
                        value={interviewRound}
                        onChange={(e) => setInterviewRound(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Venue / Video Conference Link
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. https://meet.google.com/xyz or Main Auditorium"
                      value={interviewLocation}
                      onChange={(e) => setInterviewLocation(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Conditional: Offer CTC Details */}
              {newStatus === "selected" && (
                <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-2 animate-in fade-in-50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Final Placement Offer Details</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Confirmed CTC Package (in LPA)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="e.g. 24"
                      value={offeredPackage}
                      onChange={(e) => setOfferedPackage(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TPO Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Officer Feedback / Interview Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Candidate exhibited strong data structures knowledge and problem-solving skills."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModalApp(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
