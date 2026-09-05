import { useState } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  Building2,
  FileText,
  ArrowRight,
} from "lucide-react";

export default function ApplyModal({
  isOpen,
  onClose,
  drive,
  studentProfile,
  onConfirmApply,
}) {
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !drive) return null;

  const companyName = drive.company?.companyName || drive.companyName || "Partner Company";
  const studentCgpa = studentProfile?.cgpa ?? 8.5;
  const isCgpaEligible = studentCgpa >= (drive.minimumCGPA ?? 0);
  const studentBacklogs = studentProfile?.backlogs ?? 0;
  const isBacklogEligible = studentBacklogs <= (drive.maximumBacklogs ?? 0);
  const hasResume = !!studentProfile?.resume?.url;

  const handleSubmit = async () => {
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
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-200/80 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Eligibility Checklist
          </h4>

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

            <div className="flex items-center justify-between">
              <span className="text-slate-600">Target Graduation Year:</span>
              <span className="font-semibold text-slate-800">
                {drive.graduationYear || 2026}
              </span>
            </div>
          </div>
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
              href={studentProfile.resume.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 font-semibold underline text-[11px]"
            >
              View Resume
            </a>
          )}
        </div>

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
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 active:scale-95 disabled:opacity-60"
          >
            {submitting ? (
              <span>Submitting Application...</span>
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
