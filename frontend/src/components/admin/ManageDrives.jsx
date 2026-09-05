import { useState, useMemo } from "react";
import {
  Briefcase,
  Plus,
  Search,
  MapPin,
  CheckCircle,
  XCircle,
  Users,
  Clock,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const AVAILABLE_BRANCHES = [
  "CSE",
  "IT",
  "ECE",
  "EE",
  "ME",
  "AIDS",
  "CSBS",
  "Civil",
];

const getDefaultFormData = () => {
  const now = Date.now();
  return {
    company: "",
    jobTitle: "",
    jobType: "full-time",
    package: "",
    location: "Bengaluru",
    minimumCGPA: "7.0",
    maximumBacklogs: "0",
    graduationYear: "2026",
    eligibleBranches: ["CSE", "IT", "ECE"],
    applicationStartDate: new Date(now).toISOString().split("T")[0],
    applicationDeadline: new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    driveDate: new Date(now + 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    venue: "Main Campus Auditorium & Online OA",
    jobDescription: "",
  };
};

export default function ManageDrives({
  drives = [],
  companies = [],
  onCreateDrive,
  onToggleDriveStatus,
  onViewApplicants,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sync external & internal modal state
  const isModalVisible = isCreateModalOpen !== undefined ? isCreateModalOpen : internalModalOpen;
  const setModalVisible = setIsCreateModalOpen || setInternalModalOpen;

  const [formData, setFormData] = useState(getDefaultFormData);

  const toggleBranch = (branch) => {
    setFormData((prev) => {
      const exists = prev.eligibleBranches.includes(branch);
      if (exists) {
        if (prev.eligibleBranches.length === 1) return prev; // keep at least 1
        return { ...prev, eligibleBranches: prev.eligibleBranches.filter((b) => b !== branch) };
      }
      return { ...prev, eligibleBranches: [...prev.eligibleBranches, branch] };
    });
  };

  const filteredDrives = useMemo(() => {
    return drives.filter((d) => {
      const compName = typeof d.company === "object" ? d.company?.companyName : d.companyName || "";
      const matchesSearch =
        d.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        compName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.location?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        jobTypeFilter === "all" || d.jobType === jobTypeFilter;

      const isActive = d.isActive !== false;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "inactive" && !isActive);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [drives, searchTerm, jobTypeFilter, statusFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.company) {
      toast.error("Please select a recruiting company");
      return;
    }
    if (!formData.jobTitle.trim()) {
      toast.error("Job title is required");
      return;
    }
    if (!formData.package || Number(formData.package) <= 0) {
      toast.error("Please provide a valid package in LPA");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        package: Number(formData.package),
        minimumCGPA: Number(formData.minimumCGPA),
        maximumBacklogs: Number(formData.maximumBacklogs),
        graduationYear: Number(formData.graduationYear),
      };

      await onCreateDrive(payload);
      setModalVisible(false);
      setFormData(getDefaultFormData());
      toast.success("Placement drive published successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create placement drive");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Placement Drives Management
            </h2>
            <span className="rounded-full bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 text-xs font-bold text-blue-700">
              {drives.length} Drives
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Publish campus recruitment drives, set eligibility filters, and track candidate turnout.
          </p>
        </div>

        <button
          onClick={() => {
            // Default company to first available if not set
            if (!formData.company && companies.length > 0) {
              setFormData((prev) => ({ ...prev, company: companies[0]._id }));
            }
            setModalVisible(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-500 transition active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Create Placement Drive</span>
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by job title, company, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Job Type Dropdown */}
          <select
            value={jobTypeFilter}
            onChange={(e) => setJobTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Job Types</option>
            <option value="full-time">Full-Time</option>
            <option value="internship">Internship</option>
            <option value="internship-to-full-time">Internship + FTE</option>
          </select>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "inactive", label: "Inactive" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  statusFilter === tab.id
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Drives Grid */}
      {filteredDrives.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-800">No placement drives found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Adjust your search query or create a new campus placement drive.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredDrives.map((d) => {
            const compName =
              typeof d.company === "object"
                ? d.company?.companyName
                : d.companyName || "Corporate Recruiter";
            const isActive = d.isActive !== false;
            const deadlineFormatted = d.applicationDeadline
              ? new Date(d.applicationDeadline).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Ongoing";
            const driveDateFormatted = d.driveDate
              ? new Date(d.driveDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "TBA";

            return (
              <div
                key={d._id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  {/* Top Bar: Company Monogram & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-lg shadow-sm">
                        {compName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                            {compName}
                          </span>
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 capitalize border border-blue-100">
                            {d.jobType?.replace("-", " ")}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition mt-0.5">
                          {d.jobTitle}
                        </h3>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 text-slate-400" />
                          Closed
                        </>
                      )}
                    </span>
                  </div>

                  {/* CTC and Key Metrics Ribbon */}
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Package</p>
                      <p className="text-sm font-extrabold text-blue-600">
                        ₹{d.package} LPA
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Min CGPA</p>
                      <p className="text-sm font-bold text-slate-800">
                        {d.minimumCGPA ?? 7.0}+
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Backlogs</p>
                      <p className="text-sm font-bold text-slate-800">
                        Max {d.maximumBacklogs ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Eligibility Branches */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 mr-1">
                      Branches:
                    </span>
                    {d.eligibleBranches?.map((b) => (
                      <span
                        key={b}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                      >
                        {b}
                      </span>
                    ))}
                  </div>

                  {/* Location & Dates */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                    {d.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{d.location} {d.venue ? `• ${d.venue}` : ""}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span>Deadline: <strong className="text-slate-700">{deadlineFormatted}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Drive: <strong className="text-slate-700">{driveDateFormatted}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    onClick={() => onViewApplicants && onViewApplicants(d._id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition active:scale-95"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>View Applicants</span>
                  </button>

                  <button
                    onClick={() => onToggleDriveStatus(d._id, isActive)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      isActive
                        ? "text-slate-600 bg-slate-100 hover:bg-rose-50 hover:text-rose-600"
                        : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                    }`}
                  >
                    {isActive ? "Close Drive" : "Reopen Drive"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Drive Modal */}
      {isModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150 border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Publish New Placement Drive
                  </h3>
                  <p className="text-xs text-slate-500">
                    Set up role criteria, salary packages, and deadlines for eligible students
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalVisible(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Company & Job Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Company <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- Choose Corporate Partner --</option>
                    {companies.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Job Role / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SDE-1 / Cloud Engineer"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Job Type, Package, Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Engagement Type
                  </label>
                  <select
                    value={formData.jobType}
                    onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="full-time">Full-Time (FTE)</option>
                    <option value="internship">Internship</option>
                    <option value="internship-to-full-time">Internship to FTE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Package (LPA) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    placeholder="e.g. 18.5"
                    value={formData.package}
                    onChange={(e) => setFormData({ ...formData, package: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Work Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru / Pune"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Eligibility: CGPA, Max Backlogs, Grad Year */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Minimum CGPA
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.minimumCGPA}
                    onChange={(e) => setFormData({ ...formData, minimumCGPA: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Max Active Backlogs
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maximumBacklogs}
                    onChange={(e) => setFormData({ ...formData, maximumBacklogs: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Graduation Batch
                  </label>
                  <input
                    type="number"
                    value={formData.graduationYear}
                    onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Eligible Branches Multi-Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Eligible Academic Branches ({formData.eligibleBranches.length} selected)
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_BRANCHES.map((b) => {
                    const isSelected = formData.eligibleBranches.includes(b);
                    return (
                      <button
                        type="button"
                        key={b}
                        onClick={() => toggleBranch(b)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dates & Venue */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Application Start
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.applicationStartDate}
                    onChange={(e) => setFormData({ ...formData, applicationStartDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Application Deadline
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.applicationDeadline}
                    onChange={(e) => setFormData({ ...formData, applicationDeadline: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Drive / Exam Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.driveDate}
                    onChange={(e) => setFormData({ ...formData, driveDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Interview Venue & Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Main Auditorium / Virtual Google Meet Link"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Job Description & Candidate Requirements
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe required technical competencies, interview process rounds, and job duties..."
                  value={formData.jobDescription}
                  onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalVisible(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition disabled:opacity-50"
                >
                  {submitting ? "Publishing..." : "Publish Drive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
