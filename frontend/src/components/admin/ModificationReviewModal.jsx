import { useState } from "react";
import useOverlay from "../../hooks/useOverlay";
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  User,
  GraduationCap,
  Calendar,
  Lock,
  Unlock,
  MessageSquare
} from "lucide-react";
import toast from "react-hot-toast";
import { reviewModificationRequest, unlockStudentProfile } from "../../services/adminService";

export default function ModificationReviewModal({
  isOpen,
  onClose,
  requestItem = null,
  student = null,
  onReviewed
}) {
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useOverlay(isOpen, onClose);

  if (!isOpen || (!requestItem && !student)) return null;

  // Resolve request item and student details
  const activeRequest = requestItem || (student?.modificationRequests || []).find((r) => r.status === "PENDING") || (student?.modificationRequests || [])[0];
  const targetStudent = student || {
    _id: activeRequest?.studentId,
    fullName: activeRequest?.studentName,
    enrollmentNumber: activeRequest?.usn,
    branch: activeRequest?.branch,
    user: { fullName: activeRequest?.studentName, email: activeRequest?.studentEmail }
  };

  const studentName = targetStudent.fullName || targetStudent.user?.fullName || activeRequest?.studentName || "Student";
  const usn = targetStudent.enrollmentNumber || targetStudent.usn || activeRequest?.usn || "N/A";
  const branch = targetStudent.branch || targetStudent.department || activeRequest?.branch || "N/A";

  const handleAction = async (action) => {
    if (!activeRequest?._id && !activeRequest?.requestId) {
      toast.error("Invalid request identifier");
      return;
    }
    const reqId = activeRequest.requestId || activeRequest._id;

    setSubmitting(true);
    try {
      await reviewModificationRequest(reqId, {
        action,
        reviewRemarks: reviewRemarks.trim()
      });

      toast.success(
        action === "APPROVE"
          ? "Modification approved! Student profile records automatically updated."
          : "Modification request rejected."
      );

      if (onReviewed) onReviewed();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action.toLowerCase()} modification request`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockProfile = async () => {
    const studentId = targetStudent._id;
    if (!studentId) {
      toast.error("Cannot resolve student ID to unlock");
      return;
    }
    setUnlocking(true);
    try {
      await unlockStudentProfile(studentId);
      toast.success("Student profile successfully unlocked! Student can now edit all fields.");
      if (onReviewed) onReviewed();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to unlock student profile");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        {/* Institutional Top Bar */}
        <div className="bg-gradient-to-r from-red-950 via-red-900 to-orange-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-orange-200 border border-white/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-white">
                  TPO Profile Modification Permission
                </h3>
                {activeRequest && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      activeRequest.status === "APPROVED"
                        ? "bg-emerald-500 text-white"
                        : activeRequest.status === "REJECTED"
                        ? "bg-rose-500 text-white"
                        : "bg-amber-400 text-slate-950"
                    }`}
                  >
                    {activeRequest.status || "PENDING"}
                  </span>
                )}
              </div>
              <p className="text-xs text-orange-200/90 font-medium">
                Review candidate's requested record change & approve automatic update
              </p>
            </div>
          </div>
          <button aria-label="Close dialog"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Student Identity Card */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-900 to-orange-700 font-extrabold text-white text-base shadow-xs">
                {studentName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-slate-900 text-sm truncate">{studentName}</h4>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                  <span className="font-mono font-bold text-slate-700 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                    {usn}
                  </span>
                  <span>•</span>
                  <span className="truncate">{branch}</span>
                </div>
              </div>
            </div>

            {activeRequest?.requestedAt && (
              <div className="text-right text-[11px] text-slate-400 shrink-0">
                <span>Requested on</span>
                <p className="font-bold text-slate-700">
                  {new Date(activeRequest.requestedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Side-by-Side Before vs After Comparison Card */}
          {activeRequest?.changes && activeRequest.changes.length > 0 ? (
            <div className="space-y-3">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Requested Field Modifications
              </h5>

              {activeRequest.changes.map((ch, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">
                      {ch.fieldLabel || ch.field}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Diff Preview
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Before Card */}
                    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block mb-1">
                        Current (Before)
                      </span>
                      <div className="text-base font-extrabold text-rose-950 font-mono">
                        {ch.beforeValue !== undefined && ch.beforeValue !== "" ? String(ch.beforeValue) : "None"}
                      </div>
                    </div>

                    {/* After Card */}
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block mb-1">
                        Requested (After)
                      </span>
                      <div className="text-base font-extrabold text-emerald-950 font-mono">
                        {ch.afterValue !== undefined && ch.afterValue !== "" ? String(ch.afterValue) : "None"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-500">
              No specific field diff provided. Student has requested general profile editing access.
            </div>
          )}

          {/* Student's Reason / Justification */}
          {activeRequest?.reason && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4 space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-orange-900 block">
                Student's Reason / Justification
              </span>
              <p className="text-xs text-slate-800 font-medium leading-relaxed">
                "{activeRequest.reason}"
              </p>
            </div>
          )}

          {/* TPO Review Remarks Input (Only if PENDING) */}
          {(!activeRequest || activeRequest.status === "PENDING") && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                TPO Remarks / Notes for Student (Optional)
              </label>
              <input
                type="text"
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="e.g. Verified with VTU marks card. Approved."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-orange-600 shadow-2xs"
              />
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50 shrink-0">
          <button
            type="button"
            disabled={unlocking}
            onClick={handleUnlockProfile}
            title="Unlocks the student profile completely so they can freely edit all fields"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition"
          >
            <Unlock className="h-3.5 w-3.5 text-amber-700" />
            <span>{unlocking ? "Unlocking..." : "Grant Full Edit Unlock"}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {(!activeRequest || activeRequest.status === "PENDING") ? (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleAction("REJECT")}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Reject</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleAction("APPROVE")}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-2 text-xs font-black text-white hover:from-emerald-700 hover:to-teal-800 transition disabled:opacity-50 shadow-md shadow-emerald-700/20 active:scale-95"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Accept & Apply Changes</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
