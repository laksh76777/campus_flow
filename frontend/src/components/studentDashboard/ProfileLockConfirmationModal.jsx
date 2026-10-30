import { useState } from "react";
import useOverlay from "../../hooks/useOverlay";
import {
  ShieldCheck,
  Lock,
  AlertTriangle,
  X,
  CheckCircle2,
  GraduationCap,
  Award,
  BookOpen,
  Phone,
  Mail,
  User,
  Users as UsersIcon,
  Clock,
  ArrowRight
} from "lucide-react";

export default function ProfileLockConfirmationModal({
  isOpen,
  onClose,
  onConfirmLock,
  formData = {},
  studentProfile = {},
  user = {},
  saving = false
}) {
  const [agreed, setAgreed] = useState(false);

  useOverlay(isOpen, onClose);

  if (!isOpen) return null;

  const displayName = user.fullName || studentProfile.user?.fullName || "Student";
  const displayEmail = user.email || studentProfile.user?.email || formData.personalEmail || "N/A";
  const enrollment = studentProfile.enrollmentNumber || studentProfile.usn || formData.usn || "N/A";
  const branch = studentProfile.branch || studentProfile.department || formData.programCode || "N/A";
  const admissionYear = formData.admissionYear || studentProfile.admissionYear || "N/A";
  const gradYear = formData.graduationYear || studentProfile.graduationYear || "N/A";
  const phone = user.phone || formData.alternatePhone || "N/A";

  const tenthPercent = formData.tenthPercentage || studentProfile.tenthPercentage || "N/A";
  const tenthBoard = formData.tenthBoard || studentProfile.tenthDetails?.board || "N/A";
  const twelfthPercent = formData.twelfthPercentage || studentProfile.twelfthPercentage || "N/A";
  const twelfthBoard = formData.twelfthBoard || studentProfile.twelfthOrDiplomaDetails?.boardOrUniversity || "N/A";
  const cgpa = formData.cgpa || studentProfile.verifiedCGPA || studentProfile.cgpa || "N/A";

  const activeBacklogs = studentProfile.activeBacklogs ?? studentProfile.backlogs ?? 0;
  const fatherName = formData.fatherName || studentProfile.family?.fatherName || "N/A";
  const motherName = formData.motherName || studentProfile.family?.motherName || "N/A";
  const parentContact = formData.fatherPhone || formData.motherPhone || studentProfile.family?.parentPhone || "N/A";

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-2 bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200 sm:items-center sm:p-4">
      <div className="relative my-auto flex w-full max-w-2xl max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 sm:max-h-[calc(100dvh-2rem)]">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-red-950 via-red-900 to-orange-900 text-white px-4 py-3 flex items-center justify-between shrink-0 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-orange-200 border border-white/20">
              <Lock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-extrabold text-sm tracking-tight text-white sm:text-base">
                  Institutional Profile Verification & Lock
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-400 text-slate-950">
                  Permanent Lock
                </span>
              </div>
              <p className="text-xs text-orange-200/90 font-medium">
                Verify your dossier details before locking them for placement drives
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

        {/* Scrollable Verification Summary */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Important Lock Notice Alert */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-amber-900 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-extrabold text-amber-950">
                Action is permanent: Your dossier will be locked upon confirmation.
              </p>
              <p className="text-amber-800 leading-relaxed font-medium">
                Once locked, you will not be able to directly modify academic marks, backlogs, USN, or contact details. If you clear a backlog or need updates later, you must request permission from the Training & Placement Office (TPO).
              </p>
            </div>
          </div>

          {/* Grid of Verified Records */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Dossier Records for Final Confirmation</span>
            </h4>

            {/* Candidate & Academic Identity */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Candidate & USN</span>
                <span className="text-xs font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {enrollment}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Full Name</span>
                  <strong className="text-slate-800 font-extrabold">{displayName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Branch / Dept</span>
                  <strong className="text-slate-800 font-extrabold">{branch}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Admission Year</span>
                  <strong className="text-slate-800 font-extrabold">{admissionYear}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Graduation Batch</span>
                  <strong className="text-slate-800 font-extrabold">{gradYear}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Phone / Mobile</span>
                  <strong className="text-slate-800 font-extrabold">{phone}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Email</span>
                  <strong className="text-slate-800 font-extrabold truncate block">{displayEmail}</strong>
                </div>
              </div>
            </div>

            {/* Academic Scores & Backlogs */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Academic Performance</span>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  VTU Grading System
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-xl bg-white p-2.5 border border-slate-200">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">10th Std</span>
                  <strong className="text-slate-900 font-black text-sm">{tenthPercent}%</strong>
                  <span className="text-[10px] text-slate-500 block truncate">{tenthBoard}</span>
                </div>
                <div className="rounded-xl bg-white p-2.5 border border-slate-200">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">12th / Diploma</span>
                  <strong className="text-slate-900 font-black text-sm">{twelfthPercent}%</strong>
                  <span className="text-[10px] text-slate-500 block truncate">{twelfthBoard}</span>
                </div>
                <div className="rounded-xl bg-white p-2.5 border border-slate-200">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">College CGPA</span>
                  <strong className="text-blue-700 font-black text-sm">{cgpa}</strong>
                  <span className="text-[10px] text-slate-500 block">Out of 10.0</span>
                </div>
                <div className="rounded-xl bg-white p-2.5 border border-slate-200">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Active Backlogs</span>
                  <strong className={`font-black text-sm ${activeBacklogs === 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {activeBacklogs}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">{activeBacklogs === 0 ? "All cleared" : "Active Arrears"}</span>
                </div>
              </div>
            </div>

            {/* Parents & Family Details */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-200/70 pb-2">
                Parent & Guardian Contact Records
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Father's Name</span>
                  <strong className="text-slate-800 font-extrabold">{fatherName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Mother's Name</span>
                  <strong className="text-slate-800 font-extrabold">{motherName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Parent Mobile / Phone</span>
                  <strong className="text-slate-800 font-extrabold">{parentContact}</strong>
                </div>
              </div>
            </div>

            {/* Certificates & Credentials Summary */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Certificates & External Credentials</span>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  {(formData.certificates || studentProfile.certificates || []).length} Attached
                </span>
              </div>
              {(formData.certificates || studentProfile.certificates || []).length > 0 ? (
                <div className="space-y-1.5">
                  {(formData.certificates || studentProfile.certificates || []).map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800">{c.title || "Certificate"}</span>
                      <span className="text-slate-500 text-[11px]">{c.issuer || "Online Credential"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No external certificates attached.</p>
              )}
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="rounded-2xl border-2 border-red-200 bg-red-50/40 p-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-xs font-bold text-slate-800 leading-relaxed">
                I hereby declare and verify that all personal, contact, 10th/12th marks, semester SGPA, backlogs, certificates, and parent details listed above are true, complete, and correct with no falsification. I understand that confirming will officially <u>LOCK</u> these records and prevent any further direct editing.
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Go Back & Edit
          </button>
          <button
            type="button"
            disabled={!agreed || saving}
            onClick={onConfirmLock}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-900 to-orange-700 px-5 py-2.5 text-xs font-black text-white hover:from-red-950 hover:to-orange-800 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-red-950/20 active:scale-95"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>{saving ? "Locking Dossier..." : "Confirm & Lock Profile"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
