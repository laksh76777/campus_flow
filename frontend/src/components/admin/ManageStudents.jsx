import { useState, useMemo, useEffect } from "react";
import {
  Users,
  Search,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Mail,
  Award,
  RefreshCw,
  Eye,
  Download,
  Calendar,
  GraduationCap,
  Layers,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";
import toast from "react-hot-toast";
import { getResumeViewUrl } from "../../utils/resumeHelper";
import { getPublicDepartments } from "../../services/authService";
import StudentDetailModal from "./StudentDetailModal";

export default function ManageStudents({
  students = [],
  dataStatus = "loaded",
  sessions = [],
  activeSessionId = "all",
  onSelectSession,
  onRefresh,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [internalSessionFilter, setInternalSessionFilter] = useState(activeSessionId || "all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [backlogFilter, setBacklogFilter] = useState("all");
  const [placedFilter, setPlacedFilter] = useState("all"); // all | placed | unplaced
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [viewMode, setViewMode] = useState("hierarchical"); // 'hierarchical' | 'table'

  useEffect(() => {
    if (activeSessionId) {
      setInternalSessionFilter(activeSessionId);
    }
  }, [activeSessionId]);

  const handleSessionChange = (e) => {
    const val = e.target.value;
    setInternalSessionFilter(val);
    if (onSelectSession) onSelectSession(val);
  };

  useEffect(() => {
    getPublicDepartments()
      .then((response) => setPrograms(response.data || []))
      .catch((error) => {
        console.error("Could not load approved academic programs:", error);
        toast.error("Could not load program filters");
      });
  }, []);

  const handleManualRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  // Filtered students list
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const fullName = s.user?.fullName || s.fullName || "";
      const email = s.user?.email || s.email || "";
      const enrollment = s.enrollmentNumber || "";
      const program = programs.find((item) => item.code === s.programCode);
      const branch = program?.name || s.branch || s.department || "";

      const matchesSearch =
        fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        enrollment.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.toLowerCase().includes(searchQuery.toLowerCase());

      const sSessId = s.placementSession?._id || s.placementSession;
      const sSessYear = s.placementSession?.sessionYear || s.graduationYear;
      const matchesSession =
        internalSessionFilter === "all"
          ? true
          : sSessId === internalSessionFilter ||
            String(sSessYear) === String(internalSessionFilter);

      const matchesBranch =
        branchFilter === "all"
          ? true
          : branchFilter === "unresolved"
          ? !program
          : s.programCode === branchFilter || branch === branchFilter;

      const matchesBacklog =
        backlogFilter === "all"
          ? true
          : backlogFilter === "zero"
          ? (s.activeBacklogs ?? s.backlogs) === 0
          : (s.activeBacklogs ?? s.backlogs) > 0;

      const matchesPlaced =
        placedFilter === "all"
          ? true
          : placedFilter === "placed"
          ? s.isPlaced === true
          : s.isPlaced !== true;

      return matchesSearch && matchesSession && matchesBranch && matchesBacklog && matchesPlaced;
    });
  }, [students, programs, searchQuery, internalSessionFilter, branchFilter, backlogFilter, placedFilter]);

  // Group filtered students by Department for hierarchical drill-down
  const departmentGroups = useMemo(() => {
    const groups = {};
    filteredStudents.forEach((student) => {
      const program = programs.find((p) => p.code === student.programCode);
      const deptName = program?.name || student.branch || student.department || "General Department";
      if (!groups[deptName]) {
        groups[deptName] = {
          name: deptName,
          program,
          students: []
        };
      }
      groups[deptName].students.push(student);
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredStudents, programs]);

  const activeSessionObj = useMemo(() => {
    if (internalSessionFilter === "all") return null;
    return sessions.find((s) => s._id === internalSessionFilter || String(s.sessionYear) === String(internalSessionFilter)) || null;
  }, [internalSessionFilter, sessions]);

  // Cohort statistics
  const stats = useMemo(() => {
    const total = students.length;
    const zeroBacklogs = students.filter(
      (s) => (s.activeBacklogs ?? s.backlogs) === 0
    ).length;
    const withResume = students.filter((s) => s.resume?.url).length;
    const placed = students.filter((s) => s.isPlaced === true).length;
    const cgpaValues = students
      .map((s) => s.verifiedCGPA ?? s.cgpa)
      .filter((cgpa) => typeof cgpa === "number" && Number.isFinite(cgpa));
    const avgCgpa =
      cgpaValues.length > 0
        ? (
            cgpaValues.reduce((totalCgpa, cgpa) => totalCgpa + cgpa, 0) /
            cgpaValues.length
          ).toFixed(2)
        : "N/A";

    return { total, zeroBacklogs, withResume, avgCgpa, placed };
  }, [students]);

  // Export filtered students to CSV / Excel spreadsheet
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) {
      toast.error("No student records to export matching current filters");
      return;
    }

    const headers = [
      "S.No",
      "Candidate Name",
      "Enrollment ID",
      "Email Address",
      "Phone",
      "Department",
      "Semester",
      "Graduation Batch",
      "CGPA",
      "Active Backlogs",
      "10th Score (%)",
      "12th Score (%)",
      "Skills",
      "Placement Status",
      "Placed Company",
      "Package (LPA)",
      "Placed Role",
      "Resume Link"
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredStudents.map((student, idx) => {
      const user = student.user || {};
      const skills = Array.isArray(student.skills) ? student.skills.join("; ") : "";
      const isPlaced = Boolean(student.isPlaced);
      const rawResume = student.resume?.url || student.resumeUrl || "";
      const resumeUrl = getResumeViewUrl(rawResume) || "";

      return [
        idx + 1,
        escapeCsv(user.fullName || student.fullName || ""),
        escapeCsv(student.enrollmentNumber || ""),
        escapeCsv(user.email || student.email || ""),
        escapeCsv(user.phone || student.phone || ""),
        escapeCsv(student.branch || ""),
        student.semester ?? "",
        student.graduationYear ?? "",
        student.cgpa ?? "",
        student.backlogs ?? 0,
        student.tenthPercentage ?? "",
        student.twelfthPercentage ?? "",
        escapeCsv(skills),
        isPlaced ? "Placed" : "Seeking Placement",
        escapeCsv(student.placedCompany || ""),
        student.placedPackage ?? "",
        escapeCsv(student.placedJobTitle || ""),
        escapeCsv(resumeUrl)
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `CampusFlow_Students_Cohort_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredStudents.length} candidate records!`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Registered Students Directory</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-100">
              {dataStatus === "loading" && students.length === 0
                ? "Loading..."
                : dataStatus === "error" && students.length === 0
                ? "Unavailable"
                : `${filteredStudents.length} Students`}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified candidate profiles, academic performance metrics, and portfolio credentials
          </p>
        </div>

        {/* Quick KPI Counters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Avg CGPA</span>
            <p className="text-sm font-extrabold text-blue-600">{stats.avgCgpa}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Resumes</span>
            <p className="text-sm font-extrabold text-emerald-600">{stats.withResume}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">0 Backlogs</span>
            <p className="text-sm font-extrabold text-indigo-600">{stats.zeroBacklogs}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
            <span className="text-[10px] font-bold text-emerald-600 uppercase">✓ Placed</span>
            <p className="text-sm font-extrabold text-emerald-700">{stats.placed}</p>
          </div>
          {onRefresh && (
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh student records"
              className="flex items-center justify-center h-11 w-11 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search student by name, enrollment, or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Placement Session Filter */}
          <select
            value={internalSessionFilter}
            onChange={handleSessionChange}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Placement Sessions</option>
            {sessions.map((sess) => (
              <option key={sess._id} value={sess._id}>
                {sess.academicYear ? `${sess.academicYear} Session` : `Class of ${sess.sessionYear}`} {sess.isActive ? "• Active" : ""}
              </option>
            ))}
          </select>

          {/* Branch / Department Filter */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Departments</option>
            {programs.map((program) => (
              <option key={program.code} value={program.code}>
                {program.name}
              </option>
            ))}
            {students.some((student) => !programs.some((program) => program.code === student.programCode)) && (
              <option value="unresolved">Legacy / needs program review</option>
            )}
          </select>

          {/* Backlogs Filter */}
          <select
            value={backlogFilter}
            onChange={(e) => setBacklogFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Standing</option>
            <option value="zero">Zero Backlogs</option>
            <option value="has">With Backlogs</option>
          </select>

          {/* Placement Status Filter */}
          <select
            value={placedFilter}
            onChange={(e) => setPlacedFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Status</option>
            <option value="placed">✓ Placed</option>
            <option value="unplaced">⏳ Unplaced</option>
          </select>

          {/* View Mode Toggle: Hierarchical vs Table */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode("hierarchical")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "hierarchical"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Department View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "table"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Table View</span>
            </button>
          </div>

          {/* Export Cohort CSV Button */}
          <button
            onClick={handleExportCSV}
            title="Download CSV spreadsheet of current student records"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3.5 py-2 text-xs font-bold transition active:scale-95 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredStudents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {dataStatus === "loading"
              ? "Loading student profiles"
              : dataStatus === "error"
              ? "Unable to load student profiles"
              : "No student profiles found"}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {dataStatus === "loading"
              ? "Student records are being retrieved."
              : dataStatus === "error"
              ? "The student request failed. Check the admin session and API connection, then refresh."
              : searchQuery || branchFilter !== "all" || internalSessionFilter !== "all"
              ? "No registered students match the selected filter criteria."
              : "Students will appear here once they register and activate their academic profiles."}
          </p>
        </div>
      ) : viewMode === "hierarchical" ? (
        /* HIERARCHICAL VIEW: Session -> Department -> Student Names */
        <div className="space-y-6 animate-in fade-in-50 duration-150">
          {/* Active Session Scope Summary Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white border border-blue-200/80 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {activeSessionObj
                      ? `${activeSessionObj.name || activeSessionObj.academicYear || `Class of ${activeSessionObj.sessionYear}`}`
                      : "All Academic Cohorts & Sessions"}
                  </h3>
                  {activeSessionObj?.academicYear && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-black border border-blue-200">
                      Session {activeSessionObj.academicYear}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hierarchical Overview: {departmentGroups.length} Department{departmentGroups.length === 1 ? "" : "s"} • {filteredStudents.length} Candidate{filteredStudents.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-white px-3 py-1.5 rounded-xl border border-blue-200 shadow-2xs self-start sm:self-auto">
              Session → Department → Students
            </span>
          </div>

          {/* Department Groups */}
          {departmentGroups.map((group) => {
            const deptStudents = group.students;
            const deptPlaced = deptStudents.filter((s) => s.isPlaced === true).length;
            const deptClean = deptStudents.filter((s) => (s.activeBacklogs ?? s.backlogs) === 0).length;

            return (
              <div
                key={group.name}
                className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all"
              >
                {/* Department Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                          {group.name}
                        </h4>
                        {group.program?.degreeType && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {group.program.degreeType} ({group.program.durationYears || 4} Yrs)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {deptStudents.length} Student{deptStudents.length === 1 ? "" : "s"} enrolled in this department
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100">
                      <Users className="h-3 w-3" />
                      <span>{deptStudents.length} Total</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{deptPlaced} Placed</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                      <Award className="h-3 w-3" />
                      <span>{deptClean} 0 Backlogs</span>
                    </span>
                  </div>
                </div>

                {/* Student Cards Grid in Department */}
                <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {deptStudents.map((student) => {
                    const name = student.user?.fullName || student.fullName || "Candidate";
                    const email = student.user?.email || student.email || "No email available";
                    const initial = name.charAt(0).toUpperCase();
                    const cgpa = student.verifiedCGPA ?? student.cgpa;
                    const backlogs = student.activeBacklogs ?? student.backlogs;
                    const hasResume = !!student.resume?.url;

                    const sessObj = sessions.find((s) => s._id === (student.placementSession?._id || student.placementSession));
                    const sessionLabel = sessObj?.academicYear
                      ? `Session ${sessObj.academicYear}`
                      : sessObj?.name
                      ? sessObj.name
                      : student.graduationYear
                      ? `Class of ${student.graduationYear}`
                      : "General";

                    return (
                      <div
                        key={student._id || student.enrollmentNumber}
                        onClick={() => setSelectedStudent(student)}
                        className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 hover:border-blue-400 hover:shadow-md cursor-pointer transition group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs shadow-xs group-hover:scale-105 transition-transform">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-bold text-slate-900 text-xs truncate group-hover:text-blue-700 transition-colors">
                                  {name}
                                </h5>
                                <span className="font-mono text-[10px] text-slate-500 font-semibold block">
                                  {student.enrollmentNumber || student.usn || "No USN"}
                                </span>
                              </div>
                            </div>

                            <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                              {sessionLabel}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2 truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{email}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                            <div className="rounded-lg bg-slate-50 p-1.5 border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 block uppercase">CGPA</span>
                              <span className="text-xs font-black text-blue-700">{cgpa ?? "N/A"}</span>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-1.5 border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 block uppercase">Backlogs</span>
                              <span className={`text-xs font-black ${backlogs === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                {backlogs ?? 0}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100">
                          <div>
                            {student.isPlaced ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                ✓ Placed {student.placedCompany ? `• ${student.placedCompany}` : ""}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400">
                                ⏳ Seeking Placement
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {hasResume && (
                              <a
                                href={getResumeViewUrl(student.resume.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                                title="Open resume"
                              >
                                <FileText className="h-2.5 w-2.5" />
                                <span>CV</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudent(student);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-slate-800 transition active:scale-95 shadow-2xs"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW: Standard Columns */
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs animate-in fade-in-50 duration-150">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 pl-5 pr-3">Student Candidate</th>
                  <th className="py-3.5 px-3">Enrollment ID</th>
                  <th className="py-3.5 px-3">Session Batch</th>
                  <th className="py-3.5 px-3">Branch & Semester</th>
                  <th className="py-3.5 px-3 text-center">CGPA</th>
                  <th className="py-3.5 px-3 text-center">Backlogs</th>
                  <th className="py-3.5 px-3 text-center">Placement</th>
                  <th className="py-3.5 px-3">Skills Portfolio</th>
                  <th className="py-3.5 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredStudents.map((student) => {
                  const name =
                    student.user?.fullName || student.fullName || "Candidate";
                  const email =
                    student.user?.email || student.email || "No email available";
                  const initial = name.charAt(0).toUpperCase();
                  const cgpa = student.verifiedCGPA ?? student.cgpa;
                  const backlogs = student.activeBacklogs ?? student.backlogs;
                  const hasResume = !!student.resume?.url;

                  const sessObj = sessions.find((s) => s._id === (student.placementSession?._id || student.placementSession));
                  const sessionLabel = sessObj?.academicYear
                    ? `Session ${sessObj.academicYear}`
                    : sessObj?.name
                    ? sessObj.name
                    : student.graduationYear
                    ? `Class of ${student.graduationYear}`
                    : "General";

                  return (
                    <tr
                      key={student._id || student.enrollmentNumber}
                      onClick={() => setSelectedStudent(student)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                      title="Click to view full student dossier"
                    >
                      {/* Candidate Avatar & Name */}
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-xs shadow-xs group-hover:scale-105 transition-transform">
                            {initial}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 leading-tight group-hover:text-blue-700 transition-colors">
                              {name}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                              <Mail className="h-3 w-3" />
                              <span>{email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Enrollment ID */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                          {student.enrollmentNumber || student.usn || "Not assigned"}
                        </span>
                      </td>

                      {/* Session Batch */}
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-[11px] text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          {sessionLabel}
                        </span>
                      </td>

                      {/* Branch & Semester */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-800">
                          {programs.find((program) => program.code === student.programCode)?.name
                            || `Needs review: ${student.branch || student.department || "program not provided"}`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Sem {student.semester ?? student.currentSemester ?? "—"} • Batch of{" "}
                          {student.graduationYear ?? "—"}
                        </div>
                        {(student.tenthPercentage != null || student.twelfthPercentage != null || student.certificates?.length > 0) && (
                          <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-1.5 items-center">
                            {student.tenthPercentage != null && (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                                10th: {student.tenthPercentage}%
                              </span>
                            )}
                            {student.twelfthPercentage != null && (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                                12th: {student.twelfthPercentage}%
                              </span>
                            )}
                            {Array.isArray(student.certificates) && student.certificates.length > 0 && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                                {student.certificates.length} Cert{student.certificates.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* CGPA */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-extrabold ${
                            cgpa != null && cgpa >= 8.5
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : cgpa != null && cgpa >= 7.0
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <Award className="h-3 w-3" />
                          <span>{cgpa ?? "N/A"}</span>
                        </span>
                      </td>

                      {/* Backlogs */}
                      <td className="py-3.5 px-3 text-center">
                        {backlogs === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>0 Active</span>
                          </span>
                        ) : backlogs == null ? (
                          <span className="text-[11px] text-slate-400">N/A</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <AlertCircle className="h-3 w-3" />
                            <span>{backlogs} Active</span>
                          </span>
                        )}
                      </td>

                      {/* Placement Status */}
                      <td className="py-3.5 px-3 text-center">
                        {student.isPlaced === true ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300">
                              ✓ Placed
                            </span>
                            {student.placedCompany && (
                              <span className="text-[10px] text-emerald-600 font-semibold truncate max-w-[80px]" title={student.placedCompany}>
                                {student.placedCompany}
                              </span>
                            )}
                            {student.placedPackage && (
                              <span className="text-[9px] text-slate-500">₹{student.placedPackage} LPA</span>
                            )}
                          </div>
                        ) : student.isPlaced === false ? (
                          <span className="text-[11px] text-slate-400 font-medium">⏳ Seeking</span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Not specified</span>
                        )}
                      </td>

                      {/* Skills */}
                      <td className="py-3.5 px-3 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(student.skills) ? student.skills.slice(0, 3) : []).map((skill, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              {skill}
                            </span>
                          ))}
                          {(!Array.isArray(student.skills) ||
                            student.skills.length === 0) && (
                            <span className="text-[10px] text-slate-400 italic">
                              No skills listed
                            </span>
                          )}
                          {Array.isArray(student.skills) &&
                            student.skills.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-semibold self-center">
                                +{student.skills.length - 3}
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Actions: View Profile & Resume */}
                      <td className="py-3.5 pl-3 pr-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudent(student);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800 shadow-xs transition active:scale-95"
                            title="View complete student details"
                          >
                            <Eye className="h-3 w-3" />
                            <span>View</span>
                          </button>

                          {hasResume ? (
                            <a
                              href={getResumeViewUrl(student.resume.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                              title="Open resume in new tab"
                            >
                              <FileText className="h-3 w-3" />
                              <span>Resume</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400 italic px-1">
                              No Resume
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Complete Student Profile Dossier Modal */}
      <StudentDetailModal
        student={selectedStudent}
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        onStudentVerified={() => {
          setSelectedStudent(null);
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}
