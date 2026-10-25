import { useState, useMemo, useCallback } from "react";
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
  FileSpreadsheet,
  Download,
  MessageSquare,
  Eye,
  Layers,
  FolderDown,
  HelpCircle,
  Archive,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { getResumeViewUrl } from "../../utils/resumeHelper";
import StudentDetailModal from "./StudentDetailModal";

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
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null);
  const [viewMode, setViewMode] = useState("company"); // "company" | "list"
  const [isCompanyExportModalOpen, setIsCompanyExportModalOpen] = useState(false);
  const [expandedArchivedCompany, setExpandedArchivedCompany] = useState({});

  // Applications filtered only by Drive (used for calculating tab counts and exporting)
  const driveApplications = useMemo(() => {
    return applications.filter((app) => {
      return (
        selectedDriveId === "all" ||
        app.placementDrive?._id === selectedDriveId ||
        app.placementDrive === selectedDriveId
      );
    });
  }, [applications, selectedDriveId]);

  // Partition into Active and Archived applications (from deleted/archived drives)
  const { activeDriveApplications, archivedDriveApplications } = useMemo(() => {
    const active = [];
    const archived = [];
    driveApplications.forEach((app) => {
      const isArchived =
        app.isArchived === true ||
        app.placementDrive?.isDeleted === true ||
        !app.placementDrive;
      if (isArchived) {
        archived.push(app);
      } else {
        active.push(app);
      }
    });
    return { activeDriveApplications: active, archivedDriveApplications: archived };
  }, [driveApplications]);

  // Tab counts for the active candidate pipeline
  const countsByStatus = useMemo(() => {
    const counts = {
      all: activeDriveApplications.length,
      applied: 0,
      shortlisted: 0,
      interview: 0,
      selected: 0,
      rejected: 0,
    };
    activeDriveApplications.forEach((app) => {
      if (counts[app.status] !== undefined) {
        counts[app.status]++;
      } else if (app.status === "offer_received" || app.status === "offer_accepted") {
        counts.selected++;
      }
    });
    return counts;
  }, [activeDriveApplications]);

  // Helper matcher for status and search filters
  const matchesSearchAndStatus = useCallback((app) => {
    // Filter by Status
    if (statusFilter !== "all") {
      if (statusFilter === "selected") {
        if (!["selected", "offer_received", "offer_accepted"].includes(app.status)) {
          return false;
        }
      } else if (app.status !== statusFilter) {
        return false;
      }
    }

    if (!searchTerm.trim()) return true;

    // Search query
    const student = app.student || {};
    const user = student.user || {};
    const fullName = user.fullName || student.fullName || "";
    const email = user.email || student.email || "";
    const enrollmentNo = student.enrollmentNumber || "";
    const branch = student.branch || student.department || "";

    const query = searchTerm.toLowerCase();
    return (
      fullName.toLowerCase().includes(query) ||
      email.toLowerCase().includes(query) ||
      enrollmentNo.toLowerCase().includes(query) ||
      branch.toLowerCase().includes(query)
    );
  }, [searchTerm, statusFilter]);

  // Filtered active applications (displayed outside in main view)
  const filteredActiveApplications = useMemo(() => {
    return activeDriveApplications.filter(matchesSearchAndStatus);
  }, [activeDriveApplications, matchesSearchAndStatus]);

  // Filtered archived applications (stored and revealed only on company click)
  const filteredArchivedApplications = useMemo(() => {
    return archivedDriveApplications.filter(matchesSearchAndStatus);
  }, [archivedDriveApplications, matchesSearchAndStatus]);

  // Group active applications by Company & Placement Drive
  const applicationsByCompany = useMemo(() => {
    const map = {};
    filteredActiveApplications.forEach((app) => {
      const drive = app.placementDrive || {};
      const driveId = drive._id || "general";
      const compName =
        (typeof drive.company === "object" ? drive.company?.companyName : drive.companyName) ||
        "Corporate Recruiter";
      const key = `${compName}_${driveId}`;
      if (!map[key]) {
        map[key] = {
          key,
          driveId,
          companyName: compName,
          jobTitle: drive.jobTitle || "Role",
          package: drive.package,
          location: drive.location,
          drive,
          applications: [],
          counts: {
            all: 0,
            applied: 0,
            shortlisted: 0,
            interview: 0,
            selected: 0,
            rejected: 0,
          },
        };
      }
      map[key].applications.push(app);
      map[key].counts.all++;
      const s = app.status;
      if (s in map[key].counts) {
        map[key].counts[s]++;
      } else if (s === "offer_received" || s === "offer_accepted") {
        map[key].counts.selected++;
      }
    });
    return Object.values(map).sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [filteredActiveApplications]);

  // Group archived applications by Company Name (revealed upon clicking company card)
  const archivedApplicationsByCompany = useMemo(() => {
    const map = {};
    filteredArchivedApplications.forEach((app) => {
      const drive = app.placementDrive || {};
      const snapshot = app.archivedDriveSnapshot || {};
      const driveId = drive._id || snapshot.driveId || "archived_general";
      const compName =
        snapshot.companyName ||
        (typeof drive.company === "object" ? drive.company?.companyName : drive.companyName) ||
        "Corporate Recruiter";
      const jobTitle = snapshot.jobTitle || drive.jobTitle || "Recruitment Role";
      const pkg = snapshot.package || drive.package;
      const key = `${compName}_${driveId}`;
      if (!map[key]) {
        map[key] = {
          key,
          driveId,
          companyName: compName,
          jobTitle,
          package: pkg,
          location: drive.location,
          drive,
          applications: [],
          counts: {
            all: 0,
            applied: 0,
            shortlisted: 0,
            interview: 0,
            selected: 0,
            rejected: 0,
          },
        };
      }
      map[key].applications.push(app);
      map[key].counts.all++;
      const s = app.status;
      if (s in map[key].counts) {
        map[key].counts[s]++;
      } else if (s === "offer_received" || s === "offer_accepted") {
        map[key].counts.selected++;
      }
    });
    return Object.values(map).sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [filteredArchivedApplications]);

  // Reusable CSV/Excel Exporter for any list of candidate applications
  const exportApplicationsToCsv = (appsToExport, label, targetStatus = "all") => {
    let targetApps = appsToExport;
    if (targetStatus !== "all") {
      targetApps = targetApps.filter((a) => {
        if (targetStatus === "selected") {
          return ["selected", "offer_received", "offer_accepted"].includes(a.status);
        }
        return a.status === targetStatus;
      });
    }

    if (targetApps.length === 0) {
      toast.error(`No ${targetStatus === "all" ? "" : targetStatus} candidates found for ${label}.`);
      return false;
    }

    const headers = [
      "S.No",
      "Student Name",
      "Enrollment ID / USN",
      "Email Address",
      "Phone Number",
      "Branch",
      "Semester",
      "Graduation Batch",
      "CGPA",
      "Active Backlogs",
      "10th Score (%)",
      "12th Score (%)",
      "Technical Skills",
      "Company Name",
      "Job Title",
      "Drive Package (LPA)",
      "Application Status",
      "Applied Date",
      "Interview Round",
      "Interview Date & Time",
      "Interview Location",
      "Offered Package (LPA)",
      "Admin Note / Remarks",
      "Resume Link"
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = targetApps.map((app, index) => {
      const snap = app.submittedSnapshot || {};
      const student = app.student || {};
      const user = student.user || {};
      const drive = app.placementDrive || {};
      const comp =
        typeof drive.company === "object"
          ? drive.company?.companyName
          : drive.companyName || "";

      const fullName = snap.fullName || user.fullName || student.fullName || "";
      const usn = snap.usn || student.enrollmentNumber || student.usn || "";
      const email = snap.email || user.email || student.collegeEmail || "";
      const phone = snap.phone || user.phone || student.alternatePhone || "";
      const branch = snap.branch || snap.department || student.branch || student.department || "";
      const semester = snap.currentSemester || student.semester || "";
      const gradYear = snap.graduationYear || student.graduationYear || "";
      const cgpa = snap.cgpa ?? student.verifiedCGPA ?? student.cgpa ?? "";
      const activeBacklogs = snap.activeBacklogs ?? student.activeBacklogs ?? student.backlogs ?? 0;
      const tenth = snap.tenthDetails?.percentage ?? student.tenthDetails?.percentage ?? student.tenthPercentage ?? "";
      const twelfth = snap.twelfthOrDiplomaDetails?.percentage ?? student.twelfthOrDiplomaDetails?.percentage ?? student.twelfthPercentage ?? "";
      const resumeUrl = snap.resume?.url || student.resume?.url || student.resumeUrl || "";

      return [
        index + 1,
        escapeCsv(fullName),
        escapeCsv(usn),
        escapeCsv(email),
        escapeCsv(phone),
        escapeCsv(branch),
        escapeCsv(semester),
        escapeCsv(gradYear),
        escapeCsv(cgpa),
        escapeCsv(activeBacklogs),
        escapeCsv(tenth),
        escapeCsv(twelfth),
        escapeCsv(Array.isArray(student.skills) ? student.skills.join(", ") : ""),
        escapeCsv(comp),
        escapeCsv(drive.jobTitle || ""),
        escapeCsv(drive.package || ""),
        escapeCsv((app.status || "").toUpperCase()),
        escapeCsv(
          app.appliedAt ? new Date(app.appliedAt).toLocaleDateString("en-IN") : ""
        ),
        escapeCsv(app.interviewRound || ""),
        escapeCsv(
          app.interviewDate
            ? new Date(app.interviewDate).toLocaleString("en-IN")
            : ""
        ),
        escapeCsv(app.interviewLocation || ""),
        escapeCsv(app.offeredPackage ?? ""),
        escapeCsv(app.remarks || ""),
        escapeCsv(resumeUrl)
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const cleanLabel = (label || "Company").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${targetStatus.toUpperCase()}_Candidates_${cleanLabel}_${dateStr}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);

    toast.success(`Exported ${targetApps.length} candidates (${cleanLabel}) to Excel!`);
    return true;
  };

  // Export specific company
  const handleExportCompanyExcel = (companyGroup, targetStatus = "all") => {
    exportApplicationsToCsv(
      companyGroup.applications,
      `${companyGroup.companyName}_${companyGroup.jobTitle}`,
      targetStatus
    );
  };

  // Export All Companies as Separate Files (One file per company)
  const handleExportAllCompaniesSeparate = async (targetStatus = "all") => {
    if (applicationsByCompany.length === 0) {
      toast.error("No company applications to export.");
      return;
    }

    let count = 0;
    for (const group of applicationsByCompany) {
      let apps = group.applications;
      if (targetStatus !== "all") {
        apps = apps.filter((a) => {
          if (targetStatus === "selected") return ["selected", "offer_received", "offer_accepted"].includes(a.status);
          return a.status === targetStatus;
        });
      }
      if (apps.length > 0) {
        exportApplicationsToCsv(apps, `${group.companyName}_${group.jobTitle}`, targetStatus);
        count++;
        // Small delay so browser handles multiple downloads cleanly
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    if (count > 0) {
      toast.success(`Downloaded ${count} separate company Excel files!`);
    } else {
      toast.error(`No ${targetStatus} candidates found across companies.`);
    }
  };

  // Excel / CSV Export handler for Shortlisted and other statuses
  const handleExportExcel = (targetStatus = "shortlisted") => {
    if (selectedDriveId === "all") {
      // When all drives are selected, open the Company Export Hub so user gets clean company-wise exports
      setIsCompanyExportModalOpen(true);
      return;
    }

    const selectedDriveObj = drives.find((d) => d._id === selectedDriveId);
    const driveName = selectedDriveObj
      ? (
          selectedDriveObj.company?.companyName ||
          selectedDriveObj.companyName ||
          selectedDriveObj.jobTitle ||
          "Drive"
        )
      : "Selected_Drive";

    exportApplicationsToCsv(driveApplications, driveName, targetStatus);
  };

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
      if (newStatus === "selected" || newStatus === "offer_received") {
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
      case "offer_received":
        return {
          label: "Offer Extended",
          icon: CheckCircle2,
          classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "offer_accepted":
        return {
          label: "Placed (Offer Accepted)",
          icon: CheckCircle2,
          classes: "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold",
        };
      case "offer_declined":
        return {
          label: "Offer Declined by Student",
          icon: XCircle,
          classes: "bg-amber-50 text-amber-800 border-amber-300",
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

  const statusTabs = [
    { id: "all", label: "All", count: countsByStatus.all },
    { id: "applied", label: "Applied", count: countsByStatus.applied },
    { id: "shortlisted", label: "Shortlisted", count: countsByStatus.shortlisted },
    { id: "interview", label: "Interview", count: countsByStatus.interview },
    { id: "selected", label: "Selected", count: countsByStatus.selected },
    { id: "rejected", label: "Rejected", count: countsByStatus.rejected },
  ];

  // Helper to render an individual applicant card
  const renderApplicantCard = (app) => {
    const student = app.student || {};
    const user = student.user || {};
    const studentName = user.fullName || student.fullName || "Candidate";
    const studentEmail = user.email || student.email || "student@campus.edu";
    const enrollmentNo = student.enrollmentNumber || "Not assigned";
    const branch = student.branch || student.department || "Program not provided";
    const cgpa = student.cgpa ?? "8.2";
    const backlogs = student.backlogs ?? student.activeBacklogs ?? 0;
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
        className="group flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition hover:border-slate-300 hover:shadow-md"
      >
        {/* Main Card Content Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Student Identity & Academic Profile (Clickable for full dossier) */}
          <div
            onClick={() => setSelectedStudentForDetail(student)}
            className="flex items-start sm:items-center gap-3.5 min-w-0 cursor-pointer group/stud"
            title="Click to view complete student profile dossier"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-bold text-lg shadow-xs group-hover/stud:scale-105 transition-transform">
              {studentName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate group-hover/stud:text-amber-700 transition-colors">
                  {studentName}
                </h4>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-600">
                  {enrollmentNo}
                </span>
                <span className="text-[10px] text-blue-600 font-bold opacity-0 group-hover/stud:opacity-100 transition-opacity flex items-center gap-0.5">
                  <Eye className="h-3 w-3" />
                  <span>View Details</span>
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
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 shrink-0">
            {/* View Profile Action */}
            <button
              onClick={() => setSelectedStudentForDetail(student)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-2.5 py-1.5 text-xs font-semibold transition"
              title="View complete student details"
            >
              <Eye className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Profile</span>
            </button>

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

        {/* Prominent, Full-Width Message Box from Admin */}
        {app.remarks && (
          <div className="w-full mt-2 pt-3 border-t border-slate-100 flex items-start gap-2.5 bg-amber-50/70 rounded-xl p-3 border border-amber-200/80">
            <MessageSquare className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">
                Admin Note & Instructions for Candidate:
              </span>
              <p className="text-xs sm:text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed mt-0.5">
                {app.remarks}
              </p>
            </div>
          </div>
        )}

        {/* Candidate Responses to Custom Drive Screening Questions */}
        {(() => {
          const customAns = app.customAnswers || app.submittedSnapshot?.customAnswers || [];
          if (!customAns || customAns.length === 0) return null;
          return (
            <div className="w-full mt-2.5 pt-2.5 border-t border-slate-100">
              <div className="rounded-xl bg-purple-50/50 border border-purple-100/80 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                  <HelpCircle className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <span>Candidate Screening Responses ({customAns.length}):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {customAns.map((ans, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-2.5 border border-purple-100 text-xs shadow-2xs">
                      <span className="font-semibold text-slate-600 text-[11px] block">{ans.question}</span>
                      <span className="font-bold text-slate-900 mt-1 block">
                        {ans.answer === true ? "Yes" : (ans.answer === false ? "No" : (String(ans.answer || "No answer provided")))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar with Quick Export Actions & View Mode Toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Student Applicant Review & Shortlisting
            </h2>
            <span className="rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              {filteredActiveApplications.length} Candidates
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review student applications by company, verify resumes, advance candidates, and export separated company-wise Excel sheets.
          </p>
        </div>

        {/* Excel / CSV Export Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Company-Wise Export Hub Modal Trigger */}
          <button
            onClick={() => setIsCompanyExportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2.5 text-xs font-bold shadow-xs transition active:scale-95"
            title="Export candidates organized separately company by company"
          >
            <FolderDown className="h-4 w-4" />
            <span>Export by Company</span>
            <span className="rounded-full bg-indigo-500 text-white px-1.5 py-0.2 text-[10px] font-extrabold border border-indigo-400">
              {applicationsByCompany.length}
            </span>
          </button>

          <button
            onClick={() => handleExportExcel("shortlisted")}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition active:scale-95"
            title="Download formatted Excel sheet of shortlisted students"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Shortlisted (Excel)</span>
            {countsByStatus.shortlisted > 0 && (
              <span className="rounded-full bg-emerald-500/90 text-white px-2 py-0.5 text-[10px] font-extrabold border border-emerald-400">
                {countsByStatus.shortlisted}
              </span>
            )}
          </button>

          <button
            onClick={() => handleExportExcel(statusFilter)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2.5 text-xs font-bold transition active:scale-95"
            title={`Export all currently filtered (${statusFilter}) applications to Excel`}
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export View</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        {/* Placement Drive Selector & View Mode Switcher */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <label className="text-xs font-bold text-slate-600 shrink-0 hidden sm:inline-block">
            Filter by Drive:
          </label>
          <select
            value={selectedDriveId}
            onChange={(e) => onSelectDrive(e.target.value)}
            className="w-full sm:w-60 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:border-amber-500 focus:outline-none"
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

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("company")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewMode === "company"
                  ? "bg-white text-indigo-700 shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Organize applicants grouped under each company"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Company View</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewMode === "list"
                  ? "bg-white text-slate-900 shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="View all applicants in a flat list"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>List View</span>
            </button>
          </div>
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

        {/* Status Filter Buttons with Live Badges */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto shrink-0">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? tab.id === "shortlisted"
                    ? "bg-white text-blue-800 shadow-xs font-extrabold"
                    : "bg-white text-amber-800 shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                  statusFilter === tab.id
                    ? tab.id === "shortlisted"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-amber-100 text-amber-800"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Applications Display (Company-Wise Grouped or Flat List for Active Drives) */}
      {filteredActiveApplications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <FileCheck2 className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-800">
            No active {statusFilter === "all" ? "" : statusFilter} applications match your criteria
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {statusFilter === "shortlisted"
              ? "No students have been shortlisted for this drive yet. Review applicants and update their pipeline status to 'Shortlisted'."
              : "Try choosing a different placement drive or clearing your search filters."}
          </p>
        </div>
      ) : viewMode === "company" ? (
        /* Active Drives: Company-Wise Organized View */
        <div className="space-y-6">
          {applicationsByCompany.map((group) => {
            return (
              <div
                key={group.key}
                className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden"
              >
                {/* Company Group Header with Company Details & Dedicated Company Export */}
                <div className="bg-gradient-to-r from-slate-50 via-slate-50/80 to-white p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white font-black text-lg shadow-xs">
                      {group.companyName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-slate-900">
                          {group.companyName}
                        </h3>
                        <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {group.jobTitle}
                        </span>
                        {group.package && (
                          <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-800">
                            ₹{group.package} LPA
                          </span>
                        )}
                        {group.location && (
                          <span className="text-xs text-slate-500">
                            📍 {group.location}
                          </span>
                        )}
                      </div>

                      {/* Status Breakdown for this Company */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="font-bold text-slate-800">
                          Total: {group.counts.all}
                        </span>
                        <span>•</span>
                        <span className="text-blue-700 font-semibold">
                          Shortlisted: {group.counts.shortlisted}
                        </span>
                        <span>•</span>
                        <span className="text-purple-700 font-semibold">
                          Interview: {group.counts.interview}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold">
                          Selected: {group.counts.selected}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Company Specific Export Buttons */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      onClick={() => handleExportCompanyExcel(group, "shortlisted")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition active:scale-95"
                      title={`Export shortlisted candidates for ${group.companyName}`}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Export Shortlisted</span>
                      {group.counts.shortlisted > 0 && (
                        <span className="rounded-full bg-emerald-500 px-1.5 py-0.2 text-[10px] font-extrabold">
                          {group.counts.shortlisted}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => handleExportCompanyExcel(group, "all")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 px-3 py-1.5 text-xs font-semibold shadow-xs transition active:scale-95"
                      title={`Export all registered applicant details for ${group.companyName}`}
                    >
                      <Download className="h-3.5 w-3.5 text-slate-500" />
                      <span>Export All ({group.counts.all})</span>
                    </button>
                  </div>
                </div>

                {/* Company Applicants List */}
                <div className="p-4 sm:p-5 space-y-3 bg-slate-50/30">
                  {group.applications.map(renderApplicantCard)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat List View for Active Applications */
        <div className="space-y-3.5">
          {filteredActiveApplications.map(renderApplicantCard)}
        </div>
      )}

      {/* Archived Placement Drives & Candidate History Section */}
      {archivedApplicationsByCompany.length > 0 && (
        <div className="mt-10 pt-6 border-t-2 border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <Archive className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Archived Placement Drives & Candidates</span>
                  <span className="rounded-full bg-amber-100/80 text-amber-900 px-2.5 py-0.5 text-[11px] font-bold border border-amber-200">
                    {archivedApplicationsByCompany.length} {archivedApplicationsByCompany.length === 1 ? "Company" : "Companies"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Candidates from deleted recruitment drives are archived under each company name. Click a company to unfold and view candidate names.
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl self-start sm:self-auto">
              {filteredArchivedApplications.length} Total Archived Applicants
            </span>
          </div>

          <div className="space-y-3">
            {archivedApplicationsByCompany.map((group) => {
              const isExpanded = !!expandedArchivedCompany[group.key];
              return (
                <div
                  key={group.key}
                  className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs hover:border-amber-300 transition"
                >
                  {/* Clickable Header: Company Name, Role, Package, and Candidate Count */}
                  <div
                    onClick={() =>
                      setExpandedArchivedCompany((prev) => ({
                        ...prev,
                        [group.key]: !prev[group.key],
                      }))
                    }
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer bg-slate-50/60 hover:bg-amber-50/30 transition select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-black text-lg shadow-xs">
                        {group.companyName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-extrabold text-slate-900">
                            {group.companyName}
                          </h4>
                          <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {group.jobTitle}
                          </span>
                          {group.package && (
                            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-800">
                              ₹{group.package} LPA
                            </span>
                          )}
                          <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 flex items-center gap-1">
                            <Archive className="h-3 w-3 text-amber-600" />
                            Archived Drive
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Click to {isExpanded ? "collapse" : "view"} all candidate names and application records for {group.companyName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                        {group.applications.length} Candidates
                      </span>
                      <div className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-xs">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unfolded Candidates Roster */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/20 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          Archived Candidates for {group.companyName} ({group.applications.length})
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportApplicationsToCsv(group.applications, `${group.companyName}_Archived`);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition shadow-xs cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5 text-slate-500" />
                          <span>Export Candidate List</span>
                        </button>
                      </div>
                      <div className="space-y-3">
                        {group.applications.map(renderApplicantCard)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
              {/* Screening Question Responses Review */}
              {(() => {
                const answers = activeModalApp.customAnswers || activeModalApp.submittedSnapshot?.customAnswers || [];
                if (!answers || answers.length === 0) return null;
                return (
                  <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-3.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                      <HelpCircle className="h-4 w-4 text-purple-600 shrink-0" />
                      <span>Candidate Screening Question Responses ({answers.length}):</span>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {answers.map((ans, i) => (
                        <div key={i} className="bg-white rounded-lg p-2 border border-purple-100 text-xs">
                          <p className="font-semibold text-slate-700 text-[11px]">{ans.question}</p>
                          <p className="font-bold text-slate-900 mt-0.5">
                            {ans.answer === true ? "Yes" : (ans.answer === false ? "No" : (String(ans.answer || "No response")))}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Recruitment Pipeline Stage
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "applied", label: "Applied", desc: "Initial stage" },
                    { id: "shortlisted", label: "Shortlisted", desc: "Screening cleared" },
                    { id: "interview", label: "Interview", desc: "Rounds scheduled" },
                    { id: "selected", label: "Selected", desc: "Hiring decision" },
                    { id: "offer_received", label: "Offer Released", desc: "Official offer extended" },
                    { id: "on_hold", label: "On Hold", desc: "Pending assessment" },
                    { id: "rejected", label: "Rejected", desc: "Not progressed" }
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
              {(newStatus === "selected" || newStatus === "offer_received") && (
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

              {/* Spacious, comfortable Message / Remarks textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Message / Instructions for Student (Remarks)
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Visible to candidate
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="e.g. Dear candidate, please come and present at sharp 9:00 AM on Google Meet with your resume copy and college ID."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50/60 p-3 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none resize-y transition leading-relaxed min-h-[105px]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter full instructions, interview meeting links, or reporting details. The student will see this full note.
                </p>
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

      {/* Company-Wise Export Hub Modal */}
      {isCompanyExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                  <FolderDown className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Company-Wise Candidate Export Hub
                  </h3>
                  <p className="text-xs text-slate-500">
                    Export candidates cleanly separated company by company (individual Excel/CSV files).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCompanyExportModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Bulk Actions */}
            <div className="p-4 bg-indigo-50/50 border-b border-indigo-100/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div>
                <p className="text-xs font-bold text-indigo-950">
                  Bulk One-Click Batch Export:
                </p>
                <p className="text-[11px] text-indigo-700">
                  Downloads a separate, isolated Excel/CSV spreadsheet for every single recruiting company.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleExportAllCompaniesSeparate("shortlisted")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition active:scale-95"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Download All Shortlisted</span>
                </button>
                <button
                  onClick={() => handleExportAllCompaniesSeparate("all")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-white hover:bg-indigo-50 text-indigo-900 px-3 py-1.5 text-xs font-bold shadow-xs transition active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download All Applicants</span>
                </button>
              </div>
            </div>

            {/* Companies List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {applicationsByCompany.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No company applications found.
                </div>
              ) : (
                applicationsByCompany.map((group) => (
                  <div
                    key={group.key}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white font-black text-sm shadow-xs">
                        {group.companyName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900">
                            {group.companyName}
                          </h4>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            {group.jobTitle}
                          </span>
                          {group.package && (
                            <span className="text-[11px] font-bold text-emerald-700">
                              ₹{group.package} LPA
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">
                            Total: {group.counts.all}
                          </span>
                          <span>•</span>
                          <span className="text-blue-700 font-semibold">
                            Shortlisted: {group.counts.shortlisted}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold">
                            Selected: {group.counts.selected}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleExportCompanyExcel(group, "shortlisted")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 text-xs font-bold transition active:scale-95"
                        title="Download only shortlisted candidates for this company"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Shortlisted ({group.counts.shortlisted})</span>
                      </button>

                      <button
                        onClick={() => handleExportCompanyExcel(group, "all")}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-2.5 py-1.5 text-xs font-semibold transition active:scale-95"
                        title="Download all registered candidates for this company"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-500" />
                        <span>All ({group.counts.all})</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>{applicationsByCompany.length} recruiting companies configured</span>
              <button
                onClick={() => setIsCompanyExportModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Student Profile Dossier Modal */}
      <StudentDetailModal
        student={selectedStudentForDetail}
        isOpen={!!selectedStudentForDetail}
        onClose={() => setSelectedStudentForDetail(null)}
      />
    </div>
  );
}
