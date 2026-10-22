import { useState, useMemo } from "react";
import {
  Workflow,
  Search,
  Briefcase,
  Users,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Layers,
  UploadCloud,
  Sparkles,
  X,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  ShieldCheck,
  Check,
  Settings2,
  PartyPopper,
  Trash2,
  Eye,
  Edit3,
  FileText,
  ExternalLink,
  Calendar,
  Clock,
  TrendingUp,
  MessageSquare,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getAutomatedDriveWorkspace,
  configureSelectionRounds,
  exportCompanyRoster,
  previewCompanyResults,
  commitCompanyResults,
  enrollEligibleStudents,
} from "../../services/adminService";
import { getResumeViewUrl } from "../../utils/resumeHelper";
import StudentDetailModal from "./StudentDetailModal";

export default function AutomatedPlacementDrives({
  drives = [],
  applications = [],
  companies: _companies = [],
  sessions = [],
  onRefresh,
  onUpdateStatus,
  onDeleteDrive,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "with_applicants" | "closed"
  const [selectedSessionFilter, setSelectedSessionFilter] = useState("all");

  // Active Drive Workspace State
  const [activeDriveWorkspace, setActiveDriveWorkspace] = useState(null);
  const [workspaceData, setWorkspaceData] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("pipeline"); // "pipeline" | "import_results" | "settings"

  // Results Ingestion State
  const [selectedRoundNumber, setSelectedRoundNumber] = useState(1);
  const [resultMode, setResultMode] = useState("shortlist_only"); // "shortlist_only" | "complete_results"
  const [autoRejectAbsent, setAutoRejectAbsent] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [exceptionResolutions, setExceptionResolutions] = useState({}); // { usn: "accept" | "skip" }
  const [committingResults, setCommittingResults] = useState(false);

  // Round Configuration State
  const [editingRounds, setEditingRounds] = useState(false);
  const [customRounds, setCustomRounds] = useState([]);
  const [savingRounds, setSavingRounds] = useState(false);

  // Export Roster State
  const [exportingRoster, setExportingRoster] = useState(false);
  const [enrollingCandidates, setEnrollingCandidates] = useState(false);

  // Applicant Review & Shortlisting state within Automated Drive Workspace
  const [candidateSearchTerm, setCandidateSearchTerm] = useState("");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState("all");
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null);
  const [activeModalApp, setActiveModalApp] = useState(null);
  const [modalNewStatus, setModalNewStatus] = useState("shortlisted");
  const [modalRemarks, setModalRemarks] = useState("");
  const [modalInterviewDate, setModalInterviewDate] = useState("");
  const [modalInterviewRound, setModalInterviewRound] = useState("Technical Round 1");
  const [modalInterviewLocation, setModalInterviewLocation] = useState("Google Meet");
  const [modalOfferedPackage, setModalOfferedPackage] = useState("");
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Map application counts by drive ID
  const driveMetrics = useMemo(() => {
    const map = {};
    drives.forEach((d) => {
      map[d._id] = {
        total: 0,
        applied: 0,
        shortlisted: 0,
        interview: 0,
        selected: 0,
        rejected: 0,
        withdrawn: 0,
      };
    });

    applications.forEach((app) => {
      const driveId = app.placementDrive?._id || app.placementDrive;
      if (driveId && map[driveId]) {
        map[driveId].total += 1;
        const s = app.status;
        if (s in map[driveId]) {
          map[driveId][s] += 1;
        } else if (s === "offer_received" || s === "offer_accepted") {
          map[driveId].selected += 1;
        }
      }
    });

    return map;
  }, [drives, applications]);

  // Filter drives
  const filteredDrives = useMemo(() => {
    return drives.filter((drive) => {
      const compName = (drive.company?.companyName || "").toLowerCase();
      const jobTitle = (drive.jobTitle || "").toLowerCase();
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || compName.includes(term) || jobTitle.includes(term);

      const metrics = driveMetrics[drive._id] || { total: 0 };

      let matchesStatus = true;
      if (statusFilter === "active") matchesStatus = drive.isActive === true;
      else if (statusFilter === "with_applicants") matchesStatus = metrics.total > 0;
      else if (statusFilter === "closed") matchesStatus = drive.isActive === false || drive.isPlacementCompleted;

      let matchesSession = true;
      if (selectedSessionFilter !== "all") {
        const driveSessionId = drive.placementSession?._id || drive.placementSession;
        matchesSession = String(driveSessionId) === String(selectedSessionFilter);
      }

      return matchesSearch && matchesStatus && matchesSession;
    });
  }, [drives, searchTerm, statusFilter, selectedSessionFilter, driveMetrics]);

  // Overall summary statistics
  const summaryStats = useMemo(() => {
    const totalDrives = drives.length;
    const activeDrives = drives.filter((d) => d.isActive && !d.isPlacementCompleted).length;
    const drivesWithApplicants = drives.filter(
      (d) => (driveMetrics[d._id]?.total || 0) > 0
    ).length;
    const inProgressDrives = drives.filter((d) => {
      const m = driveMetrics[d._id];
      return m && (m.shortlisted > 0 || m.interview > 0);
    }).length;
    const completedDrives = drives.filter((d) => {
      const m = driveMetrics[d._id];
      return d.isPlacementCompleted || (m && m.selected > 0);
    }).length;

    return {
      totalDrives,
      activeDrives,
      drivesWithApplicants,
      inProgressDrives,
      completedDrives,
    };
  }, [drives, driveMetrics]);

  // Load detailed automated workspace data when opening a drive
  const loadWorkspaceDetails = async (driveId) => {
    try {
      setLoadingWorkspace(true);
      const res = await getAutomatedDriveWorkspace(driveId);
      if (res?.data) {
        setWorkspaceData(res.data);
        if (res.data.drive) {
          setActiveDriveWorkspace(res.data.drive);
          setSelectedRoundNumber(res.data.drive.currentRoundNumber || 1);
          setCustomRounds(res.data.drive.selectionRounds || []);
        }
      }
    } catch (err) {
      console.error("Failed to load workspace details:", err);
      toast.error(err.response?.data?.message || "Failed to load automated drive details");
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const handleOpenWorkspace = (drive) => {
    setActiveDriveWorkspace(drive);
    setActiveWorkspaceTab("pipeline");
    setPreviewData(null);
    setSelectedFile(null);
    setExceptionResolutions({});
    loadWorkspaceDetails(drive._id);
  };

  // 1-Click Cohort Student Auto-Enrollment into Drive
  const handleEnrollEligibleCandidates = async () => {
    if (!activeDriveWorkspace) return;
    try {
      setEnrollingCandidates(true);
      const res = await enrollEligibleStudents(activeDriveWorkspace._id);
      toast.success(res?.message || "Eligible cohort candidates enrolled successfully!");
      await loadWorkspaceDetails(activeDriveWorkspace._id);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Enroll error:", err);
      toast.error(err.response?.data?.message || "Failed to enroll eligible candidates");
    } finally {
      setEnrollingCandidates(false);
    }
  };

  // Export Company Roster Action
  const handleExportRoster = async (format = "xlsx") => {
    if (!activeDriveWorkspace) return;
    try {
      setExportingRoster(true);
      const blob = await exportCompanyRoster(
        activeDriveWorkspace._id,
        selectedRoundNumber,
        format
      );

      // Check if blob is actually a JSON error response
      if (blob?.type && blob.type.includes("application/json")) {
        const text = await blob.text();
        try {
          const errData = JSON.parse(text);
          toast.error(errData.message || "Failed to export company roster");
          return;
        } catch (parseErr) {
          console.warn("Non-JSON roster blob response:", parseErr);
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const comp = activeDriveWorkspace.company?.companyName || "Company";
      a.download = `${comp}_Round_${selectedRoundNumber}_Roster.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Company roster downloaded (${format.toUpperCase()})`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error(err.response?.data?.message || "Failed to export company roster");
    } finally {
      setExportingRoster(false);
    }
  };

  // File Upload & Preview Action
  const handlePreviewUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a company result file (.xlsx, .csv, or .pdf)");
      return;
    }

    try {
      setParsingFile(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("roundNumber", selectedRoundNumber);
      formData.append("mode", resultMode);

      const res = await previewCompanyResults(activeDriveWorkspace._id, formData);
      if (res?.data) {
        setPreviewData(res.data);
        // Initialize default exception decisions
        const initialResolutions = {};
        res.data.exceptions?.forEach((exc) => {
          if (exc.canResolve) {
            initialResolutions[exc.usn] = "accept"; // default to accept if plausible
          }
        });
        setExceptionResolutions(initialResolutions);
        toast.success(`Parsed ${res.data.totalRowsDetected} candidate row(s) successfully!`);
      }
    } catch (err) {
      console.error("Parse error:", err);
      toast.error(err.response?.data?.message || "Failed to parse result file. Please check file format.");
    } finally {
      setParsingFile(false);
    }
  };

  // Commit Confirmed Results Action
  const handleCommitResults = async () => {
    if (!previewData || !activeDriveWorkspace) return;

    try {
      setCommittingResults(true);

      const confirmedAdvances = previewData.proposedAdvances || [];
      const confirmedRejections = previewData.proposedRejections || [];

      // Convert exception resolutions
      const confirmedExceptionResolutions = [];
      if (autoRejectAbsent && previewData.potentialAbsentCandidates) {
        previewData.potentialAbsentCandidates.forEach((cand) => {
          confirmedExceptionResolutions.push({
            applicationId: cand.applicationId,
            usn: cand.usn,
            action: "reject_absent",
          });
        });
      }

      // Add resolved identity mismatches
      previewData.exceptions?.forEach((exc) => {
        if (exc.canResolve && exceptionResolutions[exc.usn] === "accept") {
          confirmedExceptionResolutions.push({
            applicationId: exc.applicationId,
            usn: exc.usn,
            action: "force_advance",
          });
        }
      });

      const payload = {
        roundNumber: selectedRoundNumber,
        mode: resultMode,
        autoRejectAbsent,
        confirmedAdvances,
        confirmedRejections,
        confirmedExceptionResolutions,
        batchId: previewData.batchId,
      };

      const res = await commitCompanyResults(activeDriveWorkspace._id, payload);
      toast.success(res?.message || "Round results applied and candidate pool progressed!");

      // Refresh data and return to pipeline view
      setPreviewData(null);
      setSelectedFile(null);
      setActiveWorkspaceTab("pipeline");
      await loadWorkspaceDetails(activeDriveWorkspace._id);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Commit error:", err);
      toast.error(err.response?.data?.message || "Failed to apply round results");
    } finally {
      setCommittingResults(false);
    }
  };

  // Save Custom Selection Rounds
  const handleSaveCustomRounds = async () => {
    if (!activeDriveWorkspace) return;
    try {
      setSavingRounds(true);
      await configureSelectionRounds(activeDriveWorkspace._id, customRounds);
      toast.success("Selection rounds configured successfully");
      setEditingRounds(false);
      await loadWorkspaceDetails(activeDriveWorkspace._id);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Rounds config error:", err);
      toast.error(err.response?.data?.message || "Failed to update selection rounds");
    } finally {
      setSavingRounds(false);
    }
  };

  // Applications for active drive
  const driveApplications = useMemo(() => {
    if (!activeDriveWorkspace) return [];
    return applications.filter((app) => {
      const dId = app.placementDrive?._id || app.placementDrive;
      return dId === activeDriveWorkspace._id;
    });
  }, [applications, activeDriveWorkspace]);

  // Tab counts for candidates in the active drive
  const candidateCountsByStatus = useMemo(() => {
    const counts = {
      all: driveApplications.length,
      applied: 0,
      shortlisted: 0,
      interview: 0,
      selected: 0,
      rejected: 0,
    };
    driveApplications.forEach((app) => {
      if (counts[app.status] !== undefined) {
        counts[app.status]++;
      } else if (app.status === "offer_received" || app.status === "offer_accepted") {
        counts.selected++;
      }
    });
    return counts;
  }, [driveApplications]);

  // Filter candidates by status tab and candidate search term
  const filteredDriveApplications = useMemo(() => {
    return driveApplications.filter((app) => {
      if (candidateStatusFilter !== "all") {
        if (candidateStatusFilter === "selected") {
          if (!["selected", "offer_received", "offer_accepted"].includes(app.status)) {
            return false;
          }
        } else if (app.status !== candidateStatusFilter) {
          return false;
        }
      }

      if (!candidateSearchTerm.trim()) return true;

      const query = candidateSearchTerm.toLowerCase().trim();
      const snapshot = app.submittedSnapshot || {};
      const student = app.student || {};
      const user = student.user || {};

      const usn = (snapshot.usn || student.usn || student.enrollmentNumber || "").toLowerCase();
      const name = (snapshot.fullName || user.fullName || student.fullName || "").toLowerCase();
      const email = (snapshot.email || user.email || student.email || "").toLowerCase();
      const branch = (snapshot.branch || student.branch || student.department || "").toLowerCase();

      return (
        usn.includes(query) ||
        name.includes(query) ||
        email.includes(query) ||
        branch.includes(query)
      );
    });
  }, [driveApplications, candidateStatusFilter, candidateSearchTerm]);

  // Open manual status update modal
  const handleOpenStatusModal = (app, presetStatus = null) => {
    setActiveModalApp(app);
    setModalNewStatus(presetStatus || app.status || "shortlisted");
    setModalRemarks(app.remarks || "");
    setModalInterviewDate(
      app.interviewDate
        ? new Date(app.interviewDate).toISOString().slice(0, 16)
        : ""
    );
    setModalInterviewRound(app.interviewRound || "Technical Round 1");
    setModalInterviewLocation(app.interviewLocation || "Google Meet");
    setModalOfferedPackage(
      app.offeredPackage !== undefined && app.offeredPackage !== null
        ? String(app.offeredPackage)
        : activeDriveWorkspace?.package ? String(activeDriveWorkspace.package) : ""
    );
  };

  // Submit manual status update (connects with TPO application update system)
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!activeModalApp || !onUpdateStatus) return;

    try {
      setSubmittingStatus(true);
      const extraDetails = {};
      if (modalNewStatus === "interview") {
        if (modalInterviewDate) extraDetails.interviewDate = modalInterviewDate;
        if (modalInterviewRound) extraDetails.interviewRound = modalInterviewRound;
        if (modalInterviewLocation) extraDetails.interviewLocation = modalInterviewLocation;
      }
      if (modalNewStatus === "selected" || modalNewStatus === "offer_received") {
        if (modalOfferedPackage) extraDetails.offeredPackage = Number(modalOfferedPackage);
      }

      await onUpdateStatus(activeModalApp._id, modalNewStatus, modalRemarks, extraDetails);
      toast.success(`Candidate status updated to "${modalNewStatus}"!`);
      setActiveModalApp(null);
      if (activeDriveWorkspace) {
        await loadWorkspaceDetails(activeDriveWorkspace._id);
      }
    } catch (err) {
      console.error("Status update error:", err);
      toast.error(err.response?.data?.message || "Failed to update candidate status");
    } finally {
      setSubmittingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
                <Workflow className="h-5 w-5" />
              </span>
              Automated Placement Drive
            </h2>
            <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
              {drives.length} Managed Drives
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            End-to-end recruitment lifecycle workspace: export candidate rosters, ingest company result files, match USNs, and advance candidates in bulk.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Workspace</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Total Drives</span>
            <Briefcase className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {summaryStats.totalDrives}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Recruitment drives</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-semibold">Active Drives</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-950">
            {summaryStats.activeDrives}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Open & accepting</div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-xs font-semibold">With Applicants</span>
            <Users className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-950">
            {summaryStats.drivesWithApplicants}
          </div>
          <div className="text-[11px] text-blue-700 mt-0.5">Candidate pools active</div>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600">
            <span className="text-xs font-semibold">In Round Review</span>
            <Layers className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-950">
            {summaryStats.inProgressDrives}
          </div>
          <div className="text-[11px] text-indigo-700 mt-0.5">Rounds progressing</div>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-xs font-semibold">Selections Issued</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-950">
            {summaryStats.completedDrives}
          </div>
          <div className="text-[11px] text-purple-700 mt-0.5">Candidates placed</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search drives by company name, role, or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sessions.length > 0 && (
            <select
              value={selectedSessionFilter}
              onChange={(e) => setSelectedSessionFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">All Placement Sessions</option>
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name || `Session ${s.sessionYear}`}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: "all", label: "All Drives" },
              { id: "active", label: "Active" },
              { id: "with_applicants", label: "With Candidates" },
              { id: "closed", label: "Closed" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Drives Cards Grid */}
      {filteredDrives.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
          <Workflow className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="text-sm font-bold text-slate-800">No matching placement drives found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || statusFilter !== "all" || selectedSessionFilter !== "all"
              ? "Try adjusting your filters or search query."
              : "Create a placement drive in the Placement Drives tab to begin managing round workflows."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrives.map((drive) => {
            const compName = drive.company?.companyName || "Corporate Recruiter";
            const metrics = driveMetrics[drive._id] || { total: 0, applied: 0, shortlisted: 0, interview: 0, selected: 0, rejected: 0 };
            const isCompleted = drive.isPlacementCompleted || !drive.isActive;

            return (
              <div
                key={drive._id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                        {compName}
                      </span>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate mt-0.5">
                        {drive.jobTitle}
                      </h3>
                    </div>

                    <span
                      className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        drive.isPlacementCompleted
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : drive.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {drive.isPlacementCompleted ? "Placed & Closed" : drive.isActive ? "In Progress" : "Closed"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 font-semibold text-slate-700">
                      ₹{drive.package} LPA
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 font-medium">
                      Class of {drive.placementSession?.sessionYear || drive.graduationYear}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 font-medium">
                      {drive.jobType}
                    </span>
                  </div>

                  {/* Stage Progress Pills */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Candidate Turnout</span>
                      <span className="text-indigo-600 font-bold">{metrics.total} Applicants</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-[11px] text-center pt-1">
                      <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="font-bold text-slate-800">{metrics.applied}</div>
                        <div className="text-[10px] text-slate-400">Applied</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="font-bold text-blue-800">{metrics.shortlisted + metrics.interview}</div>
                        <div className="text-[10px] text-blue-600">In Rounds</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                        <div className="font-bold text-emerald-800">{metrics.selected}</div>
                        <div className="text-[10px] text-emerald-600">Selected</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-100">
                        <div className="font-bold text-rose-800">{metrics.rejected}</div>
                        <div className="text-[10px] text-rose-600">Rejected</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Bottom CTA */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {onDeleteDrive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDrive(drive._id, compName, drive.jobTitle);
                        }}
                        className="p-1.5 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                        title="Delete Placement Drive and clear applications"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className="text-[11px] text-slate-400">
                      Updated: {drive.updatedAt ? new Date(drive.updatedAt).toLocaleDateString() : (drive.createdAt ? new Date(drive.createdAt).toLocaleDateString() : "Active")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenWorkspace(drive)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    <span>Manage Pipeline</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Drive Workspace Modal */}
      {activeDriveWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black text-lg shadow-sm">
                  {activeDriveWorkspace.company?.companyName?.charAt(0) || "C"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 text-base sm:text-lg">
                      {activeDriveWorkspace.company?.companyName || "Recruiter"}
                    </h3>
                    <span className="text-xs text-slate-400 font-semibold">•</span>
                    <span className="text-xs font-bold text-indigo-700">
                      {activeDriveWorkspace.jobTitle}
                    </span>
                    {activeDriveWorkspace.isPlacementCompleted && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                        <PartyPopper className="h-3 w-3" /> Placed & Closed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    ₹{activeDriveWorkspace.package} LPA • {activeDriveWorkspace.location || "Bengaluru"} • {driveApplications.length} Total Applicants
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onDeleteDrive && (
                  <button
                    type="button"
                    onClick={() => {
                      const comp = activeDriveWorkspace.company?.companyName || "Company";
                      onDeleteDrive(
                        activeDriveWorkspace._id,
                        comp,
                        activeDriveWorkspace.jobTitle
                      );
                      setActiveDriveWorkspace(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition shadow-xs cursor-pointer"
                    title="Permanently delete this placement drive and clear applications"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Delete Drive</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleEnrollEligibleCandidates}
                  disabled={enrollingCandidates}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition shadow-xs cursor-pointer"
                  title="Automatically enroll all eligible cohort candidates into this drive"
                >
                  <Users className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{enrollingCandidates ? "Enrolling..." : "Enroll Eligible"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportRoster("xlsx")}
                  disabled={exportingRoster}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
                  title="Export active candidates to Excel"
                >
                  <Download className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{exportingRoster ? "Exporting..." : "Export Company Roster"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDriveWorkspace(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Workspace Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 bg-white">
              <div className="flex items-center gap-6 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab("pipeline")}
                  className={`py-3.5 border-b-2 transition cursor-pointer ${
                    activeWorkspaceTab === "pipeline"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Pipeline & Rounds Tracker
                </button>

                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab("import_results")}
                  className={`py-3.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                    activeWorkspaceTab === "import_results"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <UploadCloud className="h-4 w-4 text-indigo-500" />
                  <span>Import Company Results</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab("settings")}
                  className={`py-3.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                    activeWorkspaceTab === "settings"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>Round Settings</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400">
                  Active Round:
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                  Round {workspaceData?.drive?.currentRoundNumber || 1}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingWorkspace ? (
                <div className="py-16 text-center text-xs font-semibold text-slate-400 animate-pulse">
                  Loading recruitment pipeline & candidate records...
                </div>
              ) : activeWorkspaceTab === "pipeline" ? (
                /* TAB 1: PIPELINE & CANDIDATE ROSTER */
                <div className="space-y-6">
                  {/* Selection Round Stepper */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Selection Stage Progression
                      </h4>
                      <span className="text-xs text-slate-500">
                        {workspaceData?.drive?.selectionRounds?.length || 5} Configured Rounds
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                      {(workspaceData?.drive?.selectionRounds || []).map((round, idx) => {
                        const isCurrent = round.roundNumber === (workspaceData?.drive?.currentRoundNumber || 1);
                        const isDone = round.status === "completed";

                        return (
                          <div
                            key={round.roundNumber}
                            className={`p-3.5 rounded-2xl border transition relative ${
                              isCurrent
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                                : isDone
                                ? "bg-white border-emerald-200 text-slate-800"
                                : "bg-white/80 border-slate-200 text-slate-500"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span>Round {round.roundNumber}</span>
                              {isDone ? (
                                <span className="flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                                  <Check className="h-3 w-3" /> Done
                                </span>
                              ) : isCurrent ? (
                                <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[10px]">
                                  Active
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Pending</span>
                              )}
                            </div>

                            <div className="mt-2 text-xs font-bold truncate">
                              {round.name}
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-100/30 flex items-center justify-between text-[11px]">
                              <span className={isCurrent ? "text-indigo-100" : "text-slate-400"}>
                                Advanced
                              </span>
                              <span className={`font-bold ${isCurrent ? "text-white" : "text-slate-800"}`}>
                                {round.advancedCount || 0}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Candidates Roster with Applicant Review & Shortlisting System */}
                  <div className="space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <span>Applicant Review & Shortlisting Pipeline</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                            {filteredDriveApplications.length} of {driveApplications.length} Candidates
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Inspect applicant profiles, view resumes, update recruitment stages manually, or schedule rounds.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportRoster("xlsx")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shrink-0 shadow-xs"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Export Excel</span>
                        </button>
                      </div>
                    </div>

                    {/* Filter Tabs & Search Bar */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200">
                      {/* Status Tabs */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                        {[
                          { id: "all", label: "All Candidates", count: candidateCountsByStatus.all },
                          { id: "applied", label: "Applied", count: candidateCountsByStatus.applied },
                          { id: "shortlisted", label: "Shortlisted", count: candidateCountsByStatus.shortlisted },
                          { id: "interview", label: "Interview", count: candidateCountsByStatus.interview },
                          { id: "selected", label: "Selected", count: candidateCountsByStatus.selected },
                          { id: "rejected", label: "Rejected", count: candidateCountsByStatus.rejected },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setCandidateStatusFilter(tab.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                              candidateStatusFilter === tab.id
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                            }`}
                          >
                            <span>{tab.label}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                candidateStatusFilter === tab.id
                                  ? "bg-white/20 text-white"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {tab.count}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Search Input */}
                      <div className="relative min-w-[220px] shrink-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search USN, name, department..."
                          value={candidateSearchTerm}
                          onChange={(e) => setCandidateSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                    </div>

                    {/* Candidate Table */}
                    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-3 px-4">USN / Roll No</th>
                            <th className="py-3 px-4">Candidate Name</th>
                            <th className="py-3 px-4">Department</th>
                            <th className="py-3 px-4">CGPA</th>
                            <th className="py-3 px-4">Current Status</th>
                            <th className="py-3 px-4">Round / Instructions</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredDriveApplications.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-slate-400">
                                {candidateSearchTerm || candidateStatusFilter !== "all" ? (
                                  <div className="font-medium text-xs">No candidate applications match your search or filter.</div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center gap-3 py-2">
                                    <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                      <Users className="h-5 w-5" />
                                    </div>
                                    <div className="max-w-md">
                                      <div className="text-sm font-bold text-slate-800">No applicants in candidate pool yet</div>
                                      <p className="text-[11px] text-slate-500 mt-1">
                                        Eligible cohort students (matching graduation year, department, and CGPA criteria) can be enrolled with one click so you can export the roster and conduct selection rounds.
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleEnrollEligibleCandidates}
                                      disabled={enrollingCandidates}
                                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer mt-1"
                                    >
                                      <Users className="h-4 w-4" />
                                      <span>{enrollingCandidates ? "Enrolling..." : "Enroll All Eligible Students Now"}</span>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ) : (
                            filteredDriveApplications.map((app) => {
                              const snapshot = app.submittedSnapshot || {};
                              const student = app.student;
                              const user = student?.user;
                              const usn = snapshot.usn || student?.usn || student?.enrollmentNumber || "N/A";
                              const name = snapshot.fullName || user?.fullName || student?.fullName || "Candidate";
                              const branch = snapshot.branch || student?.branch || student?.department || "N/A";
                              const cgpa = snapshot.cgpa !== undefined ? snapshot.cgpa : student?.cgpa;
                              const resumeUrl = getResumeViewUrl(
                                app.resumeUrl || snapshot.resumeUrl || student?.resumeUrl
                              );

                              const isPlaced = ["selected", "offer_received", "offer_accepted"].includes(app.status);
                              const isAccepted = app.status === "offer_accepted";
                              const isDeclined = app.status === "offer_declined";
                              const isRejected = app.status === "rejected";

                              return (
                                <tr key={app._id} className="hover:bg-slate-50/70 transition">
                                  <td className="py-3 px-4 font-bold text-slate-900 font-mono text-[11px]">
                                    {usn}
                                  </td>
                                  <td className="py-3 px-4 font-semibold text-slate-800">
                                    <div className="flex items-center gap-1.5">
                                      <span>{name}</span>
                                    </div>
                                    <span className="block text-[10px] text-slate-400 font-normal">
                                      {snapshot.email || user?.email || student?.email}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-slate-600 font-medium">
                                    {branch}
                                  </td>
                                  <td className="py-3 px-4 font-bold text-slate-700">
                                    {cgpa !== undefined ? cgpa : "—"}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        isAccepted
                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                          : isDeclined
                                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                                          : isPlaced
                                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                                          : isRejected
                                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                                          : app.status === "shortlisted" || app.status === "interview"
                                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                          : "bg-slate-100 text-slate-700 border border-slate-200"
                                      }`}
                                    >
                                      {app.status === "offer_accepted"
                                        ? "Placed (Accepted)"
                                        : app.status === "offer_declined"
                                        ? "Offer Declined"
                                        : app.status === "offer_received"
                                        ? "Offer Extended"
                                        : app.status === "selected"
                                        ? "Selected"
                                        : app.status === "interview"
                                        ? "Interview"
                                        : app.status === "shortlisted"
                                        ? "Shortlisted"
                                        : app.status === "rejected"
                                        ? "Rejected"
                                        : app.status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-[11px] text-slate-500">
                                    <div className="space-y-1">
                                      {app.interviewRound && (
                                        <div className="font-semibold text-slate-700 text-[11px]">
                                          {app.interviewRound}
                                        </div>
                                      )}
                                      {app.offeredPackage && (
                                        <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                          ₹{app.offeredPackage} LPA
                                        </span>
                                      )}
                                      {app.remarks && (
                                        <div className="flex items-start gap-1 text-[10px] text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded-lg border border-amber-200/60 max-w-[220px] truncate" title={app.remarks}>
                                          <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-amber-600" />
                                          <span className="truncate">{app.remarks}</span>
                                        </div>
                                      )}
                                      {!app.interviewRound && !app.offeredPackage && !app.remarks && (
                                        <span className="text-slate-400">
                                          {app.interviewRounds?.length > 0
                                            ? `Cleared ${app.interviewRounds.filter(r => r.status === "cleared").length} Round(s)`
                                            : "No extra remarks"}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* View Complete Dossier */}
                                      {student && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedStudentForDetail(student)}
                                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition cursor-pointer"
                                          title="View Candidate Dossier"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </button>
                                      )}

                                      {/* View Resume */}
                                      {resumeUrl ? (
                                        <button
                                          type="button"
                                          onClick={() => window.open(resumeUrl, "_blank", "noopener,noreferrer")}
                                          className="p-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                                          title="Open Candidate Resume"
                                        >
                                          <FileText className="h-3.5 w-3.5" />
                                        </button>
                                      ) : (
                                        <span
                                          className="p-1.5 rounded-lg border border-slate-100 text-slate-300 cursor-not-allowed"
                                          title="Resume not uploaded"
                                        >
                                          <FileText className="h-3.5 w-3.5" />
                                        </span>
                                      )}

                                      {/* Manual Update Status */}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenStatusModal(app)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition text-[11px] font-bold cursor-pointer shadow-2xs"
                                        title="Change Application Status"
                                      >
                                        <Edit3 className="h-3 w-3" />
                                        <span>Status</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : activeWorkspaceTab === "import_results" ? (
                /* TAB 2: INGEST COMPANY RESULTS WIZARD */
                <div className="space-y-6">
                  {/* Step Banner */}
                  <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-indigo-950 space-y-1">
                      <strong className="block font-bold">
                        Company Result Matching Engine
                      </strong>
                      <p className="text-slate-600 leading-relaxed">
                        Upload the candidate result sheet received from {activeDriveWorkspace.company?.companyName || "the company"} (.xlsx, .csv, or text PDF).
                        The system normalizes candidate USNs, cross-checks identities, automatically proposes next-round advancement, and eliminates repetitive manual status updates.
                      </p>
                    </div>
                  </div>

                  {/* Settings Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Target Selection Round <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedRoundNumber}
                        onChange={(e) => {
                          setSelectedRoundNumber(Number(e.target.value));
                          setPreviewData(null);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                      >
                        {(workspaceData?.drive?.selectionRounds || []).map((round) => (
                          <option key={round.roundNumber} value={round.roundNumber}>
                            Round {round.roundNumber}: {round.name} ({round.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Result File Format Mode <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={resultMode}
                        onChange={(e) => {
                          setResultMode(e.target.value);
                          setPreviewData(null);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="shortlist_only">
                          Mode A: Shortlist Only (File contains only advancing candidates)
                        </option>
                        <option value="complete_results">
                          Mode B: Complete Round Results (File contains outcomes for all students)
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Mode explanation card */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      {resultMode === "shortlist_only"
                        ? "Mode A: Matched USNs advance to the next round. Non-shortlisted candidates will be rejected only if you confirm the auto-rejection rule below."
                        : "Mode B: Explicit status outcomes in the company file (Pass, Cleared, Rejected, Failed) will be applied directly."}
                    </span>

                    {resultMode === "shortlist_only" && (
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-900 shrink-0 ml-4">
                        <input
                          type="checkbox"
                          checked={autoRejectAbsent}
                          onChange={(e) => setAutoRejectAbsent(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span>Auto-reject absent candidates</span>
                      </label>
                    )}
                  </div>

                  {/* File Upload Area */}
                  {!previewData ? (
                    <form onSubmit={handlePreviewUpload} className="space-y-4">
                      <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-8 text-center space-y-3 bg-indigo-50/20 hover:bg-indigo-50/40 transition">
                        <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
                          <UploadCloud className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-slate-900">
                            {selectedFile ? selectedFile.name : "Select or Drop Company Result File"}
                          </div>
                          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                            Supports Excel (.xlsx, .xls), CSV, or text-readable PDF. USN column is auto-detected.
                          </p>
                        </div>

                        <div className="pt-2">
                          <input
                            type="file"
                            accept=".xlsx, .xls, .csv, .pdf"
                            id="company-result-input"
                            onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                            className="hidden"
                          />
                          <label
                            htmlFor="company-result-input"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs transition cursor-pointer"
                          >
                            <span>Browse File</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!selectedFile || parsingFile}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {parsingFile ? "Analyzing and Matching USNs..." : "Preview & Match Results"}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* PREVIEW & VALIDATION SECTION */
                    <div className="space-y-5 animate-in fade-in duration-200">
                      {/* Metric summary pills */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Rows in File</span>
                          <div className="text-lg font-black text-slate-900 mt-1">
                            {previewData.totalRowsDetected}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase">Matched to Advance</span>
                          <div className="text-lg font-black text-emerald-950 mt-1">
                            {previewData.proposedAdvanceCount}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40">
                          <span className="text-[10px] font-bold text-rose-600 uppercase">Absent / To Reject</span>
                          <div className="text-lg font-black text-rose-950 mt-1">
                            {previewData.absentCandidatesCount + previewData.proposedRejectCount}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40">
                          <span className="text-[10px] font-bold text-amber-600 uppercase">Exceptions / Alerts</span>
                          <div className="text-lg font-black text-amber-950 mt-1">
                            {previewData.exceptionsCount}
                          </div>
                        </div>
                      </div>

                      {/* Exceptions Queue (if any) */}
                      {previewData.exceptions && previewData.exceptions.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                          <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Verification Flags & Ambiguities ({previewData.exceptions.length})</span>
                          </div>

                          <div className="space-y-2">
                            {previewData.exceptions.map((exc, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-xl bg-white border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div>
                                  <span className="font-bold font-mono text-slate-900 mr-2">{exc.usn}</span>
                                  <span className="text-slate-600">{exc.message}</span>
                                </div>

                                {exc.canResolve && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setExceptionResolutions(prev => ({ ...prev, [exc.usn]: "accept" }))}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                        exceptionResolutions[exc.usn] === "accept"
                                          ? "bg-emerald-600 text-white"
                                          : "bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      Accept Match
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setExceptionResolutions(prev => ({ ...prev, [exc.usn]: "skip" }))}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                        exceptionResolutions[exc.usn] === "skip"
                                          ? "bg-rose-600 text-white"
                                          : "bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      Skip
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Matched Advances Table */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-900">
                          Proposed Candidate Advancements ({previewData.proposedAdvances?.length || 0})
                        </h4>
                        <div className="rounded-xl border border-slate-200 max-h-60 overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px]">
                              <tr>
                                <th className="py-2.5 px-3">USN</th>
                                <th className="py-2.5 px-3">Candidate Name</th>
                                <th className="py-2.5 px-3">Department</th>
                                <th className="py-2.5 px-3">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {previewData.proposedAdvances?.map((adv, idx) => (
                                <tr key={idx}>
                                  <td className="py-2 px-3 font-mono font-bold text-slate-800">{adv.usn}</td>
                                  <td className="py-2 px-3 font-semibold text-slate-800">{adv.name}</td>
                                  <td className="py-2 px-3 text-slate-500">{adv.branch}</td>
                                  <td className="py-2 px-3">
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                                      Advance → {adv.proposedStatus}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Confirmation and Action Controls */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setPreviewData(null)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                        >
                          Cancel / Re-upload
                        </button>

                        <button
                          type="button"
                          disabled={committingResults}
                          onClick={handleCommitResults}
                          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition active:scale-95 cursor-pointer"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>
                            {committingResults ? "Committing Updates..." : "Confirm & Apply Results in Bulk"}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* TAB 3: ROUND SETTINGS & CONFIGURATION */
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Configure Selection Stages for this Drive
                      </h4>
                      <p className="text-xs text-slate-500">
                        Customize the exact selection process stages appropriate for {activeDriveWorkspace.company?.companyName || "the company"}.
                      </p>
                    </div>

                    {!editingRounds ? (
                      <button
                        type="button"
                        onClick={() => setEditingRounds(true)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        Edit Stages
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingRounds(false)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingRounds}
                          onClick={handleSaveCustomRounds}
                          className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition shadow-xs cursor-pointer"
                        >
                          {savingRounds ? "Saving..." : "Save Rounds"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {customRounds.map((round, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-4 shadow-xs"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            {editingRounds ? (
                              <input
                                type="text"
                                value={round.name}
                                onChange={(e) => {
                                  const updated = [...customRounds];
                                  updated[idx].name = e.target.value;
                                  setCustomRounds(updated);
                                }}
                                className="w-full text-xs font-bold text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
                              />
                            ) : (
                              <div className="font-bold text-xs text-slate-900">{round.name}</div>
                            )}
                            <div className="text-[11px] text-slate-400 mt-0.5">{round.description || "Selection stage"}</div>
                          </div>
                        </div>

                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          {round.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Action Bar */}
            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Session: <strong className="text-slate-800">{activeDriveWorkspace.placementSession?.name || `Class of ${activeDriveWorkspace.graduationYear}`}</strong>
              </span>

              <button
                type="button"
                onClick={() => setActiveDriveWorkspace(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white transition cursor-pointer"
              >
                Close Workspace
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

      {/* Manual Update Application Status Modal */}
      {activeModalApp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Update Application Status
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Candidate: {activeModalApp.submittedSnapshot?.fullName || activeModalApp.student?.user?.fullName || "Candidate"} ({activeModalApp.submittedSnapshot?.usn || activeModalApp.student?.usn || "N/A"})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalApp(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "applied", label: "Applied", desc: "Initial stage" },
                    { id: "shortlisted", label: "Shortlisted", desc: "Screening cleared" },
                    { id: "interview", label: "Interview", desc: "Rounds scheduled" },
                    { id: "selected", label: "Selected", desc: "Hiring decision" },
                    { id: "offer_received", label: "Offer Released", desc: "Official offer extended" },
                    { id: "on_hold", label: "On Hold", desc: "Pending assessment" },
                    { id: "rejected", label: "Rejected", desc: "Not progressed" },
                  ].map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setModalNewStatus(s.id)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        modalNewStatus === s.id
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                          : "border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <p className="text-xs font-bold leading-none">{s.label}</p>
                      <p className={`text-[10px] mt-1 ${modalNewStatus === s.id ? "text-indigo-100" : "text-slate-400"}`}>
                        {s.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional: Interview Scheduling Details */}
              {modalNewStatus === "interview" && (
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
                        value={modalInterviewDate}
                        onChange={(e) => setModalInterviewDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Round Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Technical Round 1"
                        value={modalInterviewRound}
                        onChange={(e) => setModalInterviewRound(e.target.value)}
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
                      placeholder="e.g. https://meet.google.com/xyz or Block 4 Auditorium"
                      value={modalInterviewLocation}
                      onChange={(e) => setModalInterviewLocation(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Conditional: Offer CTC Details */}
              {(modalNewStatus === "selected" || modalNewStatus === "offer_received") && (
                <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-2 animate-in fade-in-50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Placement Offer CTC Details</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Confirmed Annual CTC Package (in LPA)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="e.g. 18.5"
                      value={modalOfferedPackage}
                      onChange={(e) => setModalOfferedPackage(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Message / Remarks textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Message / Instructions for Candidate (Remarks)
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Visible to candidate in their dashboard
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="e.g. Candidate shortlisted for round 2 technical interview. Please join with your resume copy."
                  value={modalRemarks}
                  onChange={(e) => setModalRemarks(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50/60 p-3 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none resize-y transition leading-relaxed min-h-[100px]"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModalApp(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStatus}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {submittingStatus ? "Saving..." : "Update Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
