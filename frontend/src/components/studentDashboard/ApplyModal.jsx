import { useState, useEffect } from "react";
import useOverlay from "../../hooks/useOverlay";
import {
  X,
  CheckCircle2,
  XCircle,
  Building2,
  FileText,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  MapPin,
  Calendar,
  Clock,
  Briefcase,
  Upload,
  HelpCircle,
} from "lucide-react";
import { getResumeViewUrl } from "../../utils/resumeHelper";
import { checkDriveEligibility } from "../../services/studentService";

export default function ApplyModal({
  isOpen,
  onClose,
  drive,
  studentProfile,
  isReapply = false,
  onConfirmApply,
  onOpenProfileSettings,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [evaluating, setEvaluating] = useState(true);
  const hasProfileResume = !!studentProfile?.resume?.url;
  const [resumeMode, setResumeMode] = useState(hasProfileResume ? "profile" : "custom");
  const [customResumeFile, setCustomResumeFile] = useState(null);
  const [customResumeError, setCustomResumeError] = useState("");
  const [customAnswers, setCustomAnswers] = useState({});
  const [customErrors, setCustomErrors] = useState({});

  const customQuestions = Array.isArray(drive?.customQuestions) ? drive.customQuestions : [];

  useEffect(() => {
    if (drive?.customQuestions) {
      const initial = {};
      drive.customQuestions.forEach((q) => {
        initial[q.id] = q.type === "boolean" ? "" : "";
      });
      setCustomAnswers(initial);
      setCustomErrors({});
    }
  }, [drive]);

  // Live Centralized Eligibility Engine pre-check
  useEffect(() => {
    let isMounted = true;
    if (isOpen && drive?._id) {
      setEvaluating(true);
      checkDriveEligibility(drive._id)
        .then((res) => {
          if (isMounted && res?.data) {
            setEligibilityData(res.data);
          }
        })
        .catch((err) => {
          console.warn("Eligibility check fallback:", err.message);
        })
        .finally(() => {
          if (isMounted) setEvaluating(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, drive?._id]);

  useOverlay(isOpen, onClose);

  if (!isOpen || !drive) return null;

  const companyName = drive.company?.companyName || drive.companyName || "Partner Company";
  const studentCgpa = studentProfile?.cgpa ?? 8.5;
  const isCgpaEligible = studentCgpa >= (drive.minimumCGPA ?? 0);
  const studentBacklogs = studentProfile?.backlogs ?? 0;
  const isBacklogEligible = studentBacklogs <= (drive.maximumBacklogs ?? 0);
  const hasResume = !!studentProfile?.resume?.url;

  // Determine overall eligibility from engine or fallback
  const isEligible = eligibilityData ? eligibilityData.isEligible : (isCgpaEligible && isBacklogEligible);
  const isMissingData = eligibilityData?.status === "MISSING_DATA";

  const now = new Date();
  const startDate = drive.applicationStartDate ? new Date(drive.applicationStartDate) : null;
  const deadlineDate = drive.applicationDeadline ? new Date(drive.applicationDeadline) : null;
  const isStarted = !startDate || now >= startDate;
  const isExpired = deadlineDate && now > deadlineDate;
  const isWindowOpen = isStarted && !isExpired;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(pdf|docx)$/i)) {
      setCustomResumeError("Only PDF and DOCX files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCustomResumeError("File size must be under 5MB");
      return;
    }
    setCustomResumeError("");
    setCustomResumeFile(file);
  };

  const handleAnswerChange = (questionId, val) => {
    setCustomAnswers((prev) => ({ ...prev, [questionId]: val }));
    if (customErrors[questionId]) {
      setCustomErrors((prev) => {
        const copy = { ...prev };
        delete copy[questionId];
        return copy;
      });
    }
  };

  const handleSubmit = async () => {
    if (!isStarted) {
      return;
    }
    if (resumeMode === "custom" && !customResumeFile) {
      setCustomResumeError("Please choose an updated resume file to attach");
      return;
    }
    if (resumeMode === "profile" && !hasProfileResume) {
      setCustomResumeError("No profile resume found. Please upload a resume file.");
      return;
    }

    // Validate required custom questions
    const errors = {};
    customQuestions.forEach((q) => {
      const ans = customAnswers[q.id];
      const isEmpty = ans === null || ans === undefined || (typeof ans === "string" && !ans.trim());
      if (q.required && isEmpty) {
        errors[q.id] = "This question requires an answer";
      }
    });

    if (Object.keys(errors).length > 0) {
      setCustomErrors(errors);
      return;
    }

    const formattedAnswers = customQuestions.map((q) => ({
      questionId: q.id,
      question: q.question,
      type: q.type || "text",
      answer: customAnswers[q.id] !== undefined ? customAnswers[q.id] : "",
      required: Boolean(q.required),
    }));

    setSubmitting(true);
    try {
      await onConfirmApply(
        drive._id,
        resumeMode === "custom" ? customResumeFile : null,
        formattedAnswers
      );
      onClose();
    } catch {
      // Handled in parent with toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        {/* Close Button */}
        <button aria-label="Close dialog"
          onClick={onClose}
          className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 pr-8">
            <h3 className="text-xl font-bold text-slate-900 truncate">{companyName}</h3>
            <p className="text-xs text-slate-500 font-medium">
              {drive.jobTitle} • ₹{drive.package} LPA
            </p>
          </div>
        </div>

        {/* Drive Overview Details Card */}
        <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200 capitalize">
              <Briefcase className="h-3.5 w-3.5 text-slate-400" />
              {drive.jobType?.replace(/-/g, " ") || "Full Time"}
            </span>

            {/* Paid / Unpaid Internship Badge */}
            {drive.internshipType === "paid" && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100/80 px-2.5 py-1 text-xs font-extrabold text-amber-900 border border-amber-300">
                Paid Internship {drive.stipend ? `• Stipend: ${drive.stipend}` : ""}
              </span>
            )}
            {drive.internshipType === "unpaid" && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-300">
                Unpaid Internship
              </span>
            )}
            {drive.internshipDuration && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                Duration: {drive.internshipDuration}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-1 border-t border-slate-200/60">
            {drive.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{drive.location} {drive.venue ? `• ${drive.venue}` : ""}</span>
              </div>
            )}
            {drive.applicationDeadline && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Deadline: {new Date(drive.applicationDeadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Official Job Description (JD) PDF Attachment Card */}
        {drive.jdPdf?.url && (
          <div className="mt-3.5 flex items-center justify-between rounded-2xl bg-blue-50/70 border border-blue-200/80 p-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 pr-2">
                <h5 className="font-bold text-xs text-blue-950 truncate">
                  {drive.jdPdf.fileName || "Job Description Document (PDF)"}
                </h5>
                <p className="text-[11px] text-blue-700">Official syllabus, eligibility criteria & job duties</p>
              </div>
            </div>
            <a
              href={drive.jdPdf.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition shrink-0"
            >
              <span>View JD</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* Job Description Text Excerpt */}
        {drive.jobDescription && (
          <div className="mt-3.5 rounded-2xl bg-white p-3.5 border border-slate-200 text-xs">
            <h5 className="font-bold text-slate-900 mb-1">Job Description & Candidate Responsibilities:</h5>
            <p className="text-slate-600 whitespace-pre-line max-h-32 overflow-y-auto leading-relaxed">
              {drive.jobDescription}
            </p>
          </div>
        )}

        {/* Eligibility Verification Card */}
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Eligibility Engine Evaluation
            </h4>
            {evaluating ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Verifying...</span>
              </span>
            ) : eligibilityData ? (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  eligibilityData.status === "ELIGIBLE"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : eligibilityData.status === "MISSING_DATA"
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-rose-100 text-rose-800 border border-rose-200"
                }`}
              >
                {eligibilityData.status === "ELIGIBLE" ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Eligible</span>
                  </>
                ) : eligibilityData.status === "MISSING_DATA" ? (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    <span>Missing Profile Data</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    <span>Not Eligible</span>
                  </>
                )}
              </span>
            ) : null}
          </div>

          {/* Criteria Breakdown Rows */}
          {evaluating ? (
            <div className="py-4 text-center text-xs text-slate-400 italic">
              Checking academic credentials and cutoff thresholds...
            </div>
          ) : eligibilityData?.criteriaBreakdown?.length > 0 ? (
            <div className="space-y-2 text-xs divide-y divide-slate-100 pt-1">
              {eligibilityData.criteriaBreakdown.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between pt-1.5 first:pt-0">
                  <div className="min-w-0">
                    <span className="text-slate-700 font-medium">{item.criterion}: </span>
                    <span className="text-slate-400 text-[11px]">Req: {item.required}</span>
                  </div>
                  <span
                    className={`flex items-center gap-1 font-semibold shrink-0 pl-2 ${
                      item.passed ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {item.passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-rose-500" />
                    )}
                    <span>{item.actual}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Minimum CGPA Required:</span>
                <span
                  className={`flex items-center gap-1 font-semibold ${
                    isCgpaEligible ? "text-emerald-700" : "text-rose-600"
                  }`}
                >
                  {isCgpaEligible ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-500" />
                  )}
                  {drive.minimumCGPA} (Your CGPA: {studentCgpa})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Backlogs Criteria:</span>
                <span
                  className={`flex items-center gap-1 font-semibold ${
                    isBacklogEligible ? "text-emerald-700" : "text-rose-600"
                  }`}
                >
                  {isBacklogEligible ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-500" />
                  )}
                  Max {drive.maximumBacklogs} (You have: {studentBacklogs})
                </span>
              </div>
            </div>
          )}

          {/* Engine Reason Callout if Ineligible */}
          {eligibilityData && !eligibilityData.isEligible && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 space-y-2 mt-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <p className="font-bold text-rose-950">Why You Are Not Eligible:</p>
                  <p className="text-[11px] leading-relaxed text-rose-800">{eligibilityData.summary}</p>
                  {eligibilityData.reasons?.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700 pl-1 pt-0.5">
                      {eligibilityData.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[10px] text-slate-500 pt-1 italic">
                    If your academic records or settings have changed (such as cleared backlogs or updated marks), update your academic profile settings. Once updated, your eligibility will refresh automatically and unlock application submission.
                  </p>
                </div>
              </div>
              {onOpenProfileSettings && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenProfileSettings();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs"
                  >
                    <span>Update Academic Profile Settings</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resume Selection Card */}
        <div className="mt-4 rounded-2xl bg-white p-4 border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">Resume Attached for this Drive</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">PDF or DOCX</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setResumeMode("profile");
                setCustomResumeError("");
              }}
              disabled={!hasProfileResume}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                resumeMode === "profile"
                  ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 text-blue-900"
                  : !hasProfileResume
                  ? "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Profile Resume</span>
                  {resumeMode === "profile" && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500">
                  {hasProfileResume ? "Use standard profile resume" : "No resume uploaded yet"}
                </p>
              </div>
              {hasProfileResume && (
                <a
                  href={getResumeViewUrl(studentProfile.resume.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-700 font-semibold underline text-[11px] mt-2 inline-flex items-center gap-1"
                >
                  <span>Preview Profile Resume</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </button>

            <button
              type="button"
              onClick={() => setResumeMode("custom")}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                resumeMode === "custom"
                  ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 text-blue-900"
                  : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Upload Custom Resume</span>
                  {resumeMode === "custom" && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500">
                  Upload updated or drive-specific resume
                </p>
              </div>
              {customResumeFile && (
                <span className="text-xs font-semibold text-emerald-700 truncate mt-2 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{customResumeFile.name}</span>
                </span>
              )}
            </button>
          </div>

          {resumeMode === "custom" && (
            <div className="pt-2 border-t border-slate-100">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/30 rounded-xl p-3 cursor-pointer transition">
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                  <Upload className="h-4 w-4" />
                  <span>{customResumeFile ? "Change uploaded resume file" : "Click to select updated resume file (PDF/DOCX)"}</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  {customResumeFile ? `${(customResumeFile.size / 1024).toFixed(1)} KB selected` : "Max file size: 5MB"}
                </span>
              </label>
              {customResumeError && (
                <p className="text-rose-600 text-xs mt-1.5 font-medium">{customResumeError}</p>
              )}
              <p className="text-[11px] text-slate-500 mt-1.5">
                ℹ️ This updated resume will be saved with your application and directly visible to TPO & recruiters.
              </p>
            </div>
          )}
        </div>

        {/* Custom Drive Questions Section */}
        {customQuestions.length > 0 && (
          <div className="mt-4 rounded-2xl bg-white p-4 border border-slate-200/90 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-800">
                  Drive-Specific Candidate Questions
                </span>
              </div>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                {customQuestions.length} {customQuestions.length === 1 ? "Question" : "Questions"}
              </span>
            </div>

            <div className="space-y-3">
              {customQuestions.map((q, idx) => {
                const error = customErrors[q.id];
                return (
                  <div key={q.id || idx} className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      <span>{q.question}</span>
                      {q.required && <span className="text-rose-500 ml-1">*</span>}
                    </label>

                    {q.type === "textarea" ? (
                      <textarea
                        rows={3}
                        value={customAnswers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        placeholder={q.placeholder || "Enter your answer here..."}
                        className={`w-full rounded-xl border p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition resize-y ${
                          error
                            ? "border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-1 focus:ring-rose-200"
                            : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                        }`}
                      />
                    ) : q.type === "select" ? (
                      <select
                        value={customAnswers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-slate-800 focus:outline-none transition ${
                          error
                            ? "border-rose-400 bg-rose-50/30 focus:border-rose-500"
                            : "border-slate-200 focus:border-blue-500"
                        }`}
                      >
                        <option value="">-- Select an option --</option>
                        {Array.isArray(q.options) &&
                          q.options.map((opt, optIdx) => (
                            <option key={optIdx} value={opt}>
                              {opt}
                            </option>
                          ))}
                      </select>
                    ) : q.type === "boolean" ? (
                      <div className="flex items-center gap-3 pt-0.5">
                        {["Yes", "No"].map((option) => {
                          const isChecked = customAnswers[q.id] === option;
                          return (
                            <button
                              type="button"
                              key={option}
                              onClick={() => handleAnswerChange(q.id, option)}
                              className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition ${
                                isChecked
                                  ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={customAnswers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        placeholder={q.placeholder || "Enter your response"}
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition ${
                          error
                            ? "border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-1 focus:ring-rose-200"
                            : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                        }`}
                      />
                    )}

                    {error && (
                      <p className="text-[11px] font-semibold text-rose-600">{error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Re-apply Notice */}
        {isReapply && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-amber-50 p-3 border border-amber-200/80 text-xs text-amber-800">
            <RotateCcw className="h-4 w-4 text-amber-600 shrink-0" />
            <span>You previously withdrew from this drive. You can re-apply while the registration period remains open.</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || evaluating || !isWindowOpen || !isEligible}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold text-white shadow-md transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
              isReapply
                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
            }`}
          >
            {submitting ? (
              <span>{isReapply ? "Re-submitting Application..." : "Submitting Application..."}</span>
            ) : evaluating ? (
              <span>Verifying Criteria...</span>
            ) : !isStarted ? (
              <span>Opens on {startDate?.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
            ) : isExpired ? (
              <span>Application Closed</span>
            ) : !isEligible ? (
              <span>Not Eligible</span>
            ) : isReapply ? (
              <>
                <span>Re-apply Now</span>
                <RotateCcw className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Submit Application</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
