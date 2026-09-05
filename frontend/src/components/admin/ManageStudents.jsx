import { useState, useMemo } from "react";
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
} from "lucide-react";

export default function ManageStudents({
  students = [],
  onRefresh,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [backlogFilter, setBacklogFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      const branch = s.branch || "";

      const matchesSearch =
        fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        enrollment.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesBranch =
        branchFilter === "all" ? true : branch.toLowerCase().includes(branchFilter.toLowerCase());

      const matchesBacklog =
        backlogFilter === "all"
          ? true
          : backlogFilter === "zero"
          ? (s.backlogs ?? 0) === 0
          : (s.backlogs ?? 0) > 0;

      return matchesSearch && matchesBranch && matchesBacklog;
    });
  }, [students, searchQuery, branchFilter, backlogFilter]);

  // Extract unique branches
  const branches = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.branch) set.add(s.branch);
    });
    return Array.from(set);
  }, [students]);

  // Cohort statistics
  const stats = useMemo(() => {
    const total = students.length;
    const zeroBacklogs = students.filter((s) => (s.backlogs ?? 0) === 0).length;
    const withResume = students.filter((s) => s.resume?.url).length;
    const avgCgpa =
      total > 0
        ? (students.reduce((acc, s) => acc + (s.cgpa ?? 0), 0) / total).toFixed(2)
        : "8.45";

    return { total, zeroBacklogs, withResume, avgCgpa };
  }, [students]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Registered Students Directory</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-100">
              {filteredStudents.length} Students
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
          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Departments</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {/* Backlogs Filter */}
          <select
            value={backlogFilter}
            onChange={(e) => setBacklogFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Academic Standing</option>
            <option value="zero">Zero Backlogs Only</option>
            <option value="has">With Active Backlogs</option>
          </select>
        </div>
      </div>

      {/* Students Directory List / Table */}
      {filteredStudents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No student profiles found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || branchFilter !== "all"
              ? "No registered students match the selected filter criteria."
              : "Students will appear here once they register and activate their academic profiles."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 pl-5 pr-3">Student Candidate</th>
                  <th className="py-3.5 px-3">Enrollment ID</th>
                  <th className="py-3.5 px-3">Branch & Semester</th>
                  <th className="py-3.5 px-3 text-center">CGPA</th>
                  <th className="py-3.5 px-3 text-center">Backlogs</th>
                  <th className="py-3.5 px-3">Skills Portfolio</th>
                  <th className="py-3.5 pl-3 pr-5 text-right">Resume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredStudents.map((student) => {
                  const name =
                    student.user?.fullName || student.fullName || "Candidate";
                  const email =
                    student.user?.email || student.email || "student@college.edu";
                  const initial = name.charAt(0).toUpperCase();
                  const cgpa = student.cgpa ?? 8.5;
                  const backlogs = student.backlogs ?? 0;
                  const hasResume = !!student.resume?.url;

                  return (
                    <tr
                      key={student._id || student.enrollmentNumber}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Candidate Avatar & Name */}
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-xs shadow-xs">
                            {initial}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 leading-tight">
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
                          {student.enrollmentNumber || "ENR-2022"}
                        </span>
                      </td>

                      {/* Branch & Semester */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-800">
                          {student.branch || "Computer Science"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Sem {student.semester || 6} • Batch of{" "}
                          {student.graduationYear || 2026}
                        </div>
                      </td>

                      {/* CGPA */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-extrabold ${
                            cgpa >= 8.5
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : cgpa >= 7.0
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <Award className="h-3 w-3" />
                          <span>{cgpa}</span>
                        </span>
                      </td>

                      {/* Backlogs */}
                      <td className="py-3.5 px-3 text-center">
                        {backlogs === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>0 Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <AlertCircle className="h-3 w-3" />
                            <span>{backlogs} Active</span>
                          </span>
                        )}
                      </td>

                      {/* Skills */}
                      <td className="py-3.5 px-3 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(student.skills) && student.skills.length > 0
                            ? student.skills.slice(0, 3)
                            : ["React", "Python", "SQL"]
                          ).map((skill, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              {skill}
                            </span>
                          ))}
                          {Array.isArray(student.skills) &&
                            student.skills.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-semibold self-center">
                                +{student.skills.length - 3}
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Resume Trigger */}
                      <td className="py-3.5 pl-3 pr-5 text-right">
                        {hasResume ? (
                          <a
                            href={student.resume.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                          >
                            <FileText className="h-3 w-3" />
                            <span>Resume</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400 italic">
                            No Resume
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
