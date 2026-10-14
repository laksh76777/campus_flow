import { useState, useEffect } from "react";
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
}) {
  const [submitting, setSubmitting] = useState(false);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [evaluating, setEvaluating] = useState(true);

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

  const handleSubmit = async () => {
    if (!isStarted) {
      return;
    }
    setSubmitting(true);
    try {
      await onConfirmApply(drive._id);
      onClose();
    } catch {
      // Handled in parent with toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{companyName}</h3>
            <p className="text-xs text-slate-500 font-medium">
              {drive.jobTitle} • ₹{drive.package} LPA
            </p>
          </div>
        </div>

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
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800 flex items-start gap-2 mt-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Ineligibility Reason:</p>
                <p className="mt-0.5 text-[11px]">{eligibilityData.summary}</p>
              </div>
            </div>
          )}
        </div>

        {/* Resume Note */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-blue-50/70 p-3 border border-blue-100 text-xs">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-blue-900 font-medium">
              {hasResume ? "Verified profile resume attached" : "College profile resume will be attached"}
            </span>
          </div>
          {hasResume && (
            <a
              href={getResumeViewUrl(studentProfile.resume.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 font-semibold underline text-[11px]"
            >
              View Resume
            </a>
          )}
        </div>

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
