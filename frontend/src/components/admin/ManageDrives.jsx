import { useState, useMemo, useEffect } from "react";
import {
  Briefcase,
  Plus,
  Search,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Clock,
  X,
  Bell,
  FileText,
  Paperclip,
  Trash2,
  ShieldCheck,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { getPublicDepartments } from "../../services/authService";
import { getAllPlacementSessions } from "../../services/sessionService";

const QUESTION_PRESETS = [
  {
    id: "preset_reloc",
    question: "Are you willing to relocate to any company office location?",
    type: "boolean",
    options: [],
    required: true,
    placeholder: "",
  },
  {
    id: "preset_bond",
    question: "Do you agree to the standard 2-year service agreement / bond?",
    type: "boolean",
    options: [],
    required: true,
    placeholder: "",
  },
  {
    id: "preset_stack",
    question: "What is your primary programming language / technical stack?",
    type: "select",
    options: ["Java / Spring Boot", "Python / Django / FastAPI", "MERN (React / Node.js)", "C++ / Systems", "Cloud / DevOps", "Data Engineering / SQL"],
    required: true,
    placeholder: "",
  },
  {
    id: "preset_notice",
    question: "Earliest date or notice period you are available to join?",
    type: "text",
    options: [],
    required: false,
    placeholder: "e.g. Immediate / Within 15 days",
  },
];

const DEFAULT_FIELDS = [
  { fieldKey: "fullName", label: "Student Full Name", category: "personal", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "usn", label: "USN / Enrollment No", category: "personal", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "email", label: "Institutional Email", category: "personal", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "phone", label: "Mobile Number", category: "personal", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "personalEmail", label: "Personal Email", category: "personal", requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
  { fieldKey: "branch", label: "Department / Branch", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "graduationYear", label: "Graduation Year", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "placementSession", label: "Placement Session", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "cgpa", label: "Overall CGPA", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "semesterSGPA", label: "Semester-wise SGPA", category: "academic", requiredToApply: false, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "activeBacklogs", label: "Active Backlogs Count", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "historicalBacklogs", label: "Cleared / Historical Backlogs", category: "academic", requiredToApply: false, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "tenthPercentage", label: "Class 10 Percentage", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "twelfthOrDiploma", label: "Class 12 / Diploma Percentage", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
  { fieldKey: "educationGaps", label: "Education Gap Declaration", category: "academic", requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
  { fieldKey: "resume", label: "Master Resume Document", category: "documents", requiredToApply: true, visibleToTpo: true, shareWithCompany: true, documentRequired: true },
  { fieldKey: "tenthMarksheet", label: "Class 10 Marksheet", category: "documents", requiredToApply: false, visibleToTpo: true, shareWithCompany: false, documentRequired: true },
  { fieldKey: "twelfthMarksheet", label: "Class 12 / Diploma Marksheet", category: "documents", requiredToApply: false, visibleToTpo: true, shareWithCompany: false, documentRequired: true },
  { fieldKey: "currentAddress", label: "Current Address", category: "family_address", requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
  { fieldKey: "permanentAddress", label: "Permanent Address", category: "family_address", requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
  { fieldKey: "familyDetails", label: "Parents / Guardian Information", category: "family_address", requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
];

const getDefaultFormData = () => {
  const now = Date.now();
  return {
    company: "",
    jobTitle: "",
    jobType: "full-time",
    internshipType: "not_applicable",
    stipend: "",
    internshipDuration: "",
    jdUrl: "",
    package: "",
    location: "Bengaluru",
    checkCgpa: true,
    minimumCGPA: "7.0",
    checkBacklogs: true,
    maximumBacklogs: "0",
    checkTenthMarks: false,
    minimumTenthPercentage: "60",
    checkTwelfthMarks: false,
    minimumTwelfthPercentage: "60",
    checkEducationGaps: false,
    allowEducationGaps: true,
    maxEducationGapYears: "0",
    customQuestions: [],
    graduationYear: "",
    placementSession: "",
    eligibleProgramCodes: [],
    applicationStartDate: new Date(now).toISOString().split("T")[0],
    applicationDeadline: new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    driveDate: new Date(now + 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    venue: "Main Campus Auditorium & Online OA",
    jobDescription: "",
    reminderSettings: {
      remindersEnabled: true,
      reminderOffsetsHours: [6],
      channels: ["in_app", "email"]
    },
    studentRequirements: DEFAULT_FIELDS.map(f => ({ ...f }))
  };
};

export default function ManageDrives({
  drives = [],
  companies = [],
  onCreateDrive,
  onToggleDriveStatus,
  onDeleteDrive,
  onViewApplicants,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [jdFile, setJdFile] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([getPublicDepartments(), getAllPlacementSessions()])
      .then(([programResponse, sessionResponse]) => {
        if (!active) return;
        setPrograms(programResponse.data || []);
        setSessions((sessionResponse.data || []).filter((session) => !session.isClosed && !session.isArchived));
      })
      .catch((error) => {
        console.error("Could not load drive configuration:", error);
        toast.error("Could not load approved programs and placement sessions");
      });
    return () => { active = false; };
  }, []);

  // Sync external & internal modal state
  const isModalVisible = isCreateModalOpen !== undefined ? isCreateModalOpen : internalModalOpen;
  const setModalVisible = setIsCreateModalOpen || setInternalModalOpen;

  const [formData, setFormData] = useState(getDefaultFormData);

  const toggleProgram = (programCode) => {
    setFormData((prev) => {
      const exists = prev.eligibleProgramCodes.includes(programCode);
      if (exists) {
        return { ...prev, eligibleProgramCodes: prev.eligibleProgramCodes.filter((code) => code !== programCode) };
      }
      return { ...prev, eligibleProgramCodes: [...prev.eligibleProgramCodes, programCode] };
    });
  };

  const handleAddCustomQuestion = (preset = null) => {
    const newQ = preset
      ? { ...preset, id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` }
      : {
          id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          question: "",
          type: "text",
          options: [],
          required: false,
          placeholder: "",
        };
    setFormData((prev) => ({
      ...prev,
      customQuestions: [...(prev.customQuestions || []), newQ],
    }));
  };

  const handleUpdateCustomQuestion = (idx, field, value) => {
    setFormData((prev) => {
      const updated = [...(prev.customQuestions || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, customQuestions: updated };
    });
  };

  const handleRemoveCustomQuestion = (idx) => {
    setFormData((prev) => {
      const updated = [...(prev.customQuestions || [])];
      updated.splice(idx, 1);
      return { ...prev, customQuestions: updated };
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
    if (!formData.placementSession || !formData.eligibleProgramCodes.length) {
      toast.error("Select a placement session and at least one approved academic program");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        eligibleBranches: formData.eligibleProgramCodes.map(
          (code) => programs.find((program) => program.code === code)?.name || code
        ),
        package: Number(formData.package),
        checkCgpa: Boolean(formData.checkCgpa),
        minimumCGPA: Number(formData.minimumCGPA || 0),
        checkBacklogs: Boolean(formData.checkBacklogs),
        maximumBacklogs: Number(formData.maximumBacklogs || 0),
        checkTenthMarks: Boolean(formData.checkTenthMarks),
        minimumTenthPercentage: Number(formData.minimumTenthPercentage || 0),
        checkTwelfthMarks: Boolean(formData.checkTwelfthMarks),
        minimumTwelfthPercentage: Number(formData.minimumTwelfthPercentage || 0),
        checkEducationGaps: Boolean(formData.checkEducationGaps),
        allowEducationGaps: Boolean(formData.allowEducationGaps),
        maxEducationGapYears: Number(formData.maxEducationGapYears || 0),
        customQuestions: (formData.customQuestions || []).filter((q) => q.question && q.question.trim()),
        graduationYear: Number(formData.graduationYear),
      };

      if (jdFile) {
        const multipartData = new FormData();
        Object.entries(payload).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            if (typeof val === "object" && !(val instanceof File)) {
              multipartData.append(key, JSON.stringify(val));
            } else {
              multipartData.append(key, val);
            }
          }
        });
        multipartData.append("jdPdf", jdFile);
        await onCreateDrive(multipartData);
      } else {
        await onCreateDrive(payload);
      }

      setModalVisible(false);
      setFormData(getDefaultFormData());
      setJdFile(null);
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

                  {/* Internship and JD PDF Badges */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {d.internshipType === "paid" && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                        Paid Internship {d.stipend ? `• ${d.stipend}` : ""}
                      </span>
                    )}
                    {d.internshipType === "unpaid" && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
                        Unpaid Internship
                      </span>
                    )}
                    {d.internshipDuration && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                        Duration: {d.internshipDuration}
                      </span>
                    )}
                    {d.jdPdf?.url && (
                      <a
                        href={d.jdPdf.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                      >
                        <FileText className="h-3 w-3" />
                        <span>JD PDF</span>
                      </a>
                    )}
                  </div>

                  {/* Eligibility Branches */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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

                  {/* Criteria & Custom Questions Tags */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {d.checkTenthMarks && Number(d.minimumTenthPercentage) > 0 && (
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                        ≥{d.minimumTenthPercentage}% (10th)
                      </span>
                    )}
                    {d.checkTwelfthMarks && Number(d.minimumTwelfthPercentage) > 0 && (
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                        ≥{d.minimumTwelfthPercentage}% (12th)
                      </span>
                    )}
                    {d.checkEducationGaps && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                          !d.allowEducationGaps
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}
                      >
                        {!d.allowEducationGaps ? "No Year Gaps Allowed" : `Max ${d.maxEducationGapYears || 0}y Gap`}
                      </span>
                    )}
                    {Array.isArray(d.customQuestions) && d.customQuestions.length > 0 && (
                      <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200 flex items-center gap-1">
                        <HelpCircle className="h-3 w-3 text-purple-600" />
                        <span>{d.customQuestions.length} Custom {d.customQuestions.length === 1 ? "Question" : "Questions"}</span>
                      </span>
                    )}
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

                  <div className="flex items-center gap-1.5">
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

                    {onDeleteDrive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDrive(d._id, compName, d.jobTitle);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                        title="Delete Placement Drive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
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
                    onChange={(e) => {
                      const newType = e.target.value;
                      setFormData({
                        ...formData,
                        jobType: newType,
                        internshipType: newType.includes("internship")
                          ? (formData.internshipType === "not_applicable" ? "paid" : formData.internshipType)
                          : "not_applicable"
                      });
                    }}
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

              {/* Paid / Unpaid Internship Details (shown when Internship or Intern-to-FTE is selected) */}
              {(formData.jobType === "internship" || formData.jobType === "internship-to-full-time") && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700 text-xs font-bold">
                      ₹
                    </span>
                    <h4 className="text-xs font-bold text-slate-800">
                      Internship Compensation & Duration Settings
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Internship Category
                      </label>
                      <select
                        value={formData.internshipType}
                        onChange={(e) => setFormData({ ...formData, internshipType: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="paid">Paid Internship</option>
                        <option value="unpaid">Unpaid Internship</option>
                      </select>
                    </div>

                    {formData.internshipType === "paid" && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Monthly Stipend
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ₹25,000 / month"
                          value={formData.stipend}
                          onChange={(e) => setFormData({ ...formData, stipend: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    )}

                    <div className={formData.internshipType === "paid" ? "" : "sm:col-span-2"}>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Internship Duration
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 6 Months (Jan - Jun)"
                        value={formData.internshipDuration}
                        onChange={(e) => setFormData({ ...formData, internshipDuration: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Placement Session Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Placement Session <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.placementSession}
                  onChange={(e) => {
                    const session = sessions.find((item) => item._id === e.target.value);
                    setFormData({
                      ...formData,
                      placementSession: e.target.value,
                      graduationYear: session ? String(session.sessionYear) : "",
                    });
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Select configured placement session --</option>
                  {sessions.map((session) => (
                    <option key={session._id} value={session._id}>
                      {session.name || `Class of ${session.sessionYear}`} ({session.academicYear})
                    </option>
                  ))}
                </select>
              </div>

              {/* Automated Eligibility Engine Criteria Card */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-blue-100/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Configurable Eligibility Criteria Checkpoints
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Select which criteria the Centralized Engine checks before permitting candidate applications.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CGPA & Active Backlogs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.checkCgpa}
                        onChange={(e) => setFormData({ ...formData, checkCgpa: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-xs font-bold text-slate-800">Enforce CGPA Cutoff</span>
                    </label>
                    {formData.checkCgpa && (
                      <div>
                        <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Minimum CGPA (0.0 - 10.0)
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          value={formData.minimumCGPA}
                          onChange={(e) => setFormData({ ...formData, minimumCGPA: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                          placeholder="e.g. 7.00"
                        />
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.checkBacklogs}
                        onChange={(e) => setFormData({ ...formData, checkBacklogs: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-xs font-bold text-slate-800">Enforce Active Backlogs Limit</span>
                    </label>
                    {formData.checkBacklogs && (
                      <div>
                        <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Max Allowed Active Backlogs
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={formData.maximumBacklogs}
                          onChange={(e) => setFormData({ ...formData, maximumBacklogs: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 10th & 12th Marks Check */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.checkTenthMarks}
                        onChange={(e) => setFormData({ ...formData, checkTenthMarks: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-xs font-bold text-slate-800">Check Class 10th Marks</span>
                    </label>
                    {formData.checkTenthMarks && (
                      <div>
                        <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Minimum 10th Percentage (%)
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={formData.minimumTenthPercentage}
                          onChange={(e) => setFormData({ ...formData, minimumTenthPercentage: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                          placeholder="e.g. 60"
                        />
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.checkTwelfthMarks}
                        onChange={(e) => setFormData({ ...formData, checkTwelfthMarks: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-xs font-bold text-slate-800">Check Class 12th / Diploma Marks</span>
                    </label>
                    {formData.checkTwelfthMarks && (
                      <div>
                        <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Minimum 12th/Diploma Percentage (%)
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={formData.minimumTwelfthPercentage}
                          onChange={(e) => setFormData({ ...formData, minimumTwelfthPercentage: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                          placeholder="e.g. 60"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Education Gap Verification */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.checkEducationGaps}
                        onChange={(e) => setFormData({ ...formData, checkEducationGaps: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Check Student Education & Year Gaps
                      </span>
                    </label>
                    {formData.checkEducationGaps && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                        Gap Rule Active
                      </span>
                    )}
                  </div>

                  {formData.checkEducationGaps && (
                    <div className="pt-2 border-t border-slate-100 space-y-3 animate-in fade-in-50">
                      <div>
                        <span className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                          Education Gap Allowance Policy
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, allowEducationGaps: false })}
                            className={`px-3 py-2 text-xs font-bold rounded-xl border text-left transition ${
                              !formData.allowEducationGaps
                                ? "bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-300"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <div className="font-extrabold">🚫 Strictly No Gaps Allowed</div>
                            <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                              Students with any declared education gap will be marked ineligible
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, allowEducationGaps: true })}
                            className={`px-3 py-2 text-xs font-bold rounded-xl border text-left transition ${
                              formData.allowEducationGaps
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <div className="font-extrabold">✅ Allow Gaps with Max Threshold</div>
                            <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                              Allow candidates within specified gap years (e.g. 1 or 2 years)
                            </div>
                          </button>
                        </div>
                      </div>

                      {formData.allowEducationGaps && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Maximum Allowed Gap Duration (in Years)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="5"
                            value={formData.maxEducationGapYears}
                            onChange={(e) => setFormData({ ...formData, maxEducationGapYears: e.target.value })}
                            className="w-full sm:w-48 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                            placeholder="e.g. 1"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Application Questions Builder */}
              <div className="rounded-2xl border border-purple-200 bg-purple-50/30 p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                      <HelpCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">
                          Custom Drive Application Questions
                        </h4>
                        <span className="rounded-full bg-purple-100 px-2 py-0.2 text-[10px] font-bold text-purple-800">
                          {formData.customQuestions?.length || 0}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Ask questions that candidates must answer when submitting their application (relocation, bonds, tech stack, etc.)
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddCustomQuestion()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                {/* Quick Presets Bar */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-purple-600" />
                    <span>Quick-Add Popular Questions:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUESTION_PRESETS.map((preset) => (
                      <button
                        type="button"
                        key={preset.id}
                        onClick={() => handleAddCustomQuestion(preset)}
                        className="text-[11px] font-medium bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-purple-200/80 px-2.5 py-1 rounded-lg transition shadow-2xs"
                      >
                        + {preset.question.length > 42 ? preset.question.substring(0, 42) + "..." : preset.question}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Questions List */}
                <div className="space-y-3 pt-1">
                  {(!formData.customQuestions || formData.customQuestions.length === 0) ? (
                    <div className="py-6 text-center text-xs text-slate-400 bg-white/70 rounded-xl border border-dashed border-purple-200">
                      No custom questions configured. Candidates will only submit required academic records and resume.
                    </div>
                  ) : (
                    formData.customQuestions.map((q, qIdx) => (
                      <div
                        key={q.id || qIdx}
                        className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-2xs transition hover:border-purple-300"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md">
                            Question #{qIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomQuestion(qIdx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                            title="Remove Question"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Question Prompt / Statement <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Are you willing to relocate to Bengaluru or Hyderabad?"
                            value={q.question}
                            onChange={(e) => handleUpdateCustomQuestion(qIdx, "question", e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-purple-500 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Response Input Type
                            </label>
                            <select
                              value={q.type}
                              onChange={(e) => handleUpdateCustomQuestion(qIdx, "type", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-purple-500 focus:outline-none"
                            >
                              <option value="text">Short Text Answer</option>
                              <option value="textarea">Paragraph / Multiline Text</option>
                              <option value="select">Multiple Choice Dropdown</option>
                              <option value="boolean">Yes / No Choice</option>
                            </select>
                          </div>

                          <div className="flex items-end pb-1.5">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={q.required}
                                onChange={(e) => handleUpdateCustomQuestion(qIdx, "required", e.target.checked)}
                                className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                              />
                              <span className="text-xs font-bold text-slate-800">
                                Mandatory / Required to submit
                              </span>
                            </label>
                          </div>
                        </div>

                        {q.type === "select" && (
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Dropdown Options (Comma separated list)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Python, Java, React, Go, C++"
                              value={Array.isArray(q.options) ? q.options.join(", ") : (q.options || "")}
                              onChange={(e) =>
                                handleUpdateCustomQuestion(
                                  qIdx,
                                  "options",
                                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                                )
                              }
                              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-purple-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Eligible Programs Multi-Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Eligible Academic Programs ({formData.eligibleProgramCodes.length} selected)
                </label>
                {programs.length === 0 && (
                  <p className="mb-2 text-xs text-rose-600">Approved programs are unavailable. Reload the page before creating a drive.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {programs.map((program) => {
                    const isSelected = formData.eligibleProgramCodes.includes(program.code);
                    return (
                      <button
                        type="button"
                        key={program.code}
                        onClick={() => toggleProgram(program.code)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {program.name}
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

              {/* Job Description (JD) PDF Document Attachment */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Attach Official Job Description (JD) PDF
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Upload company JD PDF so candidates can inspect full roles, syllabus, and benefits before applying.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* PDF File Upload */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Upload PDF Document
                    </label>
                    {jdFile ? (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/80 p-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="h-4 w-4 text-blue-600 shrink-0" />
                          <span className="truncate font-semibold text-blue-900">{jdFile.name}</span>
                          <span className="text-[10px] text-blue-600 shrink-0">
                            ({(jdFile.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setJdFile(null)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-100 transition"
                          title="Remove attached PDF"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-500 hover:bg-blue-50/30 transition">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span>Choose JD (.pdf)</span>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setJdFile(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Or External JD URL */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Or Online JD URL Link
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/... or company JD URL"
                      value={formData.jdUrl}
                      onChange={(e) => setFormData({ ...formData, jdUrl: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Application Deadline Reminder Settings */}
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Application Deadline Reminders
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Automatically alert eligible candidates who have not yet submitted their application.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.reminderSettings?.remindersEnabled ?? true}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          reminderSettings: {
                            ...prev.reminderSettings,
                            remindersEnabled: e.target.checked
                          }
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {formData.reminderSettings?.remindersEnabled && (
                  <div className="space-y-3 pt-2 border-t border-indigo-100/80">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-700 mb-1.5">
                        Reminder Timing (Hours Before Deadline)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[1, 3, 6, 12, 24].map((hours) => {
                          const isSelected = formData.reminderSettings?.reminderOffsetsHours?.includes(hours);
                          return (
                            <button
                              type="button"
                              key={hours}
                              onClick={() => {
                                setFormData((prev) => {
                                  const currentOffsets = prev.reminderSettings?.reminderOffsetsHours || [6];
                                  let updatedOffsets;
                                  if (currentOffsets.includes(hours)) {
                                    if (currentOffsets.length === 1) return prev; // Keep at least one
                                    updatedOffsets = currentOffsets.filter((h) => h !== hours);
                                  } else {
                                    updatedOffsets = [...currentOffsets, hours].sort((a, b) => b - a);
                                  }
                                  return {
                                    ...prev,
                                    reminderSettings: {
                                      ...prev.reminderSettings,
                                      reminderOffsetsHours: updatedOffsets
                                    }
                                  };
                                });
                              }}
                              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition ${
                                isSelected
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              {hours} {hours === 1 ? "Hour" : "Hours"} before
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pt-1">
                      <span className="text-[11px] font-bold text-slate-700">Channels:</span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.reminderSettings?.channels?.includes("in_app")}
                          onChange={(e) => {
                            setFormData((prev) => {
                              const channels = prev.reminderSettings?.channels || ["in_app", "email"];
                              const newChannels = e.target.checked
                                ? [...new Set([...channels, "in_app"])]
                                : channels.filter((c) => c !== "in_app");
                              if (newChannels.length === 0) return prev;
                              return {
                                ...prev,
                                reminderSettings: { ...prev.reminderSettings, channels: newChannels }
                              };
                            });
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>In-App Alert</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.reminderSettings?.channels?.includes("email")}
                          onChange={(e) => {
                            setFormData((prev) => {
                              const channels = prev.reminderSettings?.channels || ["in_app", "email"];
                              const newChannels = e.target.checked
                                ? [...new Set([...channels, "email"])]
                                : channels.filter((c) => c !== "email");
                              if (newChannels.length === 0) return prev;
                              return {
                                ...prev,
                                reminderSettings: { ...prev.reminderSettings, channels: newChannels }
                              };
                            });
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Official Email</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Student Information Requirements Section */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span>Student Information Requirements</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Configure what students must supply to apply, what the TPO inspects, and what exports to the company.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          studentRequirements: DEFAULT_FIELDS.map((f) => ({ ...f }))
                        }));
                        toast.success("Reset requirements to default configuration");
                      }}
                      className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg"
                    >
                      Reset Defaults
                    </button>
                  </div>
                </div>

                {/* Privacy Warning check */}
                {formData.studentRequirements?.some(
                  (r) => r.category === "family_address" && r.shareWithCompany
                ) && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Privacy Warning: </strong>
                      You have selected confidential family or address details to be shared with the recruiting company. Ensure you have explicit institutional authorization before publishing.
                    </div>
                  </div>
                )}

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                  {formData.studentRequirements?.map((req, idx) => (
                    <div key={req.fieldKey} className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{req.label}</span>
                        <span className="ml-2 text-[10px] font-mono text-slate-400 capitalize">({req.category})</span>
                      </div>

                      <div className="flex items-center gap-4 text-[11px]">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={req.requiredToApply}
                            onChange={(e) => {
                              const updated = [...formData.studentRequirements];
                              updated[idx].requiredToApply = e.target.checked;
                              setFormData({ ...formData, studentRequirements: updated });
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold text-slate-600">Required</span>
                        </label>

                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={req.visibleToTpo}
                            onChange={(e) => {
                              const updated = [...formData.studentRequirements];
                              updated[idx].visibleToTpo = e.target.checked;
                              setFormData({ ...formData, studentRequirements: updated });
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold text-slate-600">Visible to TPO</span>
                        </label>

                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={req.shareWithCompany}
                            onChange={(e) => {
                              const updated = [...formData.studentRequirements];
                              updated[idx].shareWithCompany = e.target.checked;
                              setFormData({ ...formData, studentRequirements: updated });
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-semibold text-slate-600">Share Company</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
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
