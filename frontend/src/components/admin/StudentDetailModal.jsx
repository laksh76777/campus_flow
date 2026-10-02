import { useEffect } from "react";
import {
  X,
  Mail,
  Phone,
  GraduationCap,
  Award,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
  Building,
} from "lucide-react";
import { getResumeViewUrl } from "../../utils/resumeHelper";

export default function StudentDetailModal({ student, isOpen, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !student) return null;

  const user = student.user || {};
  const fullName = user.fullName || student.fullName || "Student Candidate";
  const email = user.email || student.email || "No email available";
  const phone = user.phone || student.phone || "";
  const avatarUrl = user.avatar?.url || student.avatarUrl || null;
  const initial = fullName.charAt(0).toUpperCase();

  const enrollmentNo = student.enrollmentNumber || "Not Assigned";
  const branch = student.branch || "Computer Science & Engineering";
  const semester = student.semester ?? 6;
  const graduationYear = student.graduationYear ?? 2026;
  const cgpa = student.cgpa ?? 8.0;
  const backlogs = student.backlogs ?? student.activeBacklogs ?? 0;
  const tenth = student.tenthPercentage;
  const twelfth = student.twelfthPercentage;
  const skills = Array.isArray(student.skills) ? student.skills : [];
  const certificates = Array.isArray(student.certificates) ? student.certificates : [];
  const about = student.about || "";
  const rawResumeUrl = student.resume?.url || student.resumeUrl;
  const resumeUrl = getResumeViewUrl(rawResumeUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="relative bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-6 sm:p-7 shrink-0">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 h-9 w-9 flex items-center justify-center rounded-xl bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition active:scale-95"
            title="Close dossier"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pr-10">
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl object-cover border-2 border-white/20 shadow-md shrink-0"
              />
            ) : (
              <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white font-black text-2xl sm:text-3xl flex items-center justify-center border-2 border-white/20 shadow-md shrink-0">
                {initial}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white truncate">
                  {fullName}
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Verified Candidate</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-blue-200/90 font-medium">
                <span className="font-mono bg-white/10 px-2.5 py-0.5 rounded-md border border-white/10 text-white font-bold">
                  {enrollmentNo}
                </span>
                <span>•</span>
                <span>{branch}</span>
                <span>•</span>
                <span>Batch of {graduationYear}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Quick Contact Chips */}
          <div className="flex flex-wrap gap-2.5 items-center">
            {email && (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition"
              >
                <Mail className="h-3.5 w-3.5 text-blue-600" />
                <span>{email}</span>
              </a>
            )}

            {phone ? (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition"
              >
                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                <span>{phone}</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-slate-200 text-xs font-medium text-slate-400">
                <Phone className="h-3.5 w-3.5" />
                <span>No phone number registered</span>
              </span>
            )}

            {resumeUrl && (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-xs transition"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Open Resume</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Academic Key Metrics Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-slate-500" />
              <span>Academic Performance</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* CGPA */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70">
                <span className="text-[11px] font-bold text-slate-500 uppercase">CGPA Score</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span
                    className={`text-2xl font-black ${
                      cgpa >= 8.5
                        ? "text-emerald-600"
                        : cgpa >= 7.0
                        ? "text-blue-600"
                        : "text-amber-600"
                    }`}
                  >
                    {cgpa}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">/ 10</span>
                </div>
              </div>

              {/* Backlogs */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Backlogs</span>
                <div className="mt-1">
                  {backlogs === 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>0 Active</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md border border-rose-200">
                      <AlertCircle className="h-3 w-3" />
                      <span>{backlogs} Active</span>
                    </span>
                  )}
                </div>
              </div>

              {/* 10th Grade */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70">
                <span className="text-[11px] font-bold text-slate-500 uppercase">10th Standard</span>
                <p className="text-lg font-black text-slate-800 mt-1">
                  {tenth != null && tenth !== "" ? `${tenth}%` : "Not provided"}
                </p>
              </div>

              {/* 12th Grade */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70">
                <span className="text-[11px] font-bold text-slate-500 uppercase">12th Standard</span>
                <p className="text-lg font-black text-slate-800 mt-1">
                  {twelfth != null && twelfth !== "" ? `${twelfth}%` : "Not provided"}
                </p>
              </div>
            </div>
          </div>

          {/* Academic Standing & Semester */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-semibold">Department:</span>
              <p className="font-bold text-slate-800 mt-0.5">{branch}</p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Current Semester:</span>
              <p className="font-bold text-slate-800 mt-0.5">Semester {semester}</p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Graduation Year:</span>
              <p className="font-bold text-slate-800 mt-0.5">Class of {graduationYear}</p>
            </div>
          </div>

          {/* About / Bio */}
          {about && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Professional Bio & Summary</span>
              </h4>
              <div className="p-4 rounded-2xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                "{about}"
              </div>
            </div>
          )}

          {/* Technical Skills Portfolio */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-500" />
              <span>Skills & Competencies ({skills.length})</span>
            </h4>
            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50/50 transition"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No technical skills listed.</p>
            )}
          </div>

          {/* Certifications */}
          {certificates.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-emerald-500" />
                <span>Certifications & Accreditations ({certificates.length})</span>
              </h4>
              <div className="space-y-2">
                {certificates.map((cert, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white"
                  >
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">{cert.title}</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {cert.issuer || "Organization"} {cert.issueDate ? `• ${cert.issueDate}` : ""}
                      </p>
                      {cert.credentialId && (
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          ID: {cert.credentialId}
                        </p>
                      )}
                    </div>
                    {cert.certificateUrl && (
                      <a
                        href={cert.certificateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline shrink-0"
                      >
                        <span>View</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resume Box */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">Official Student Resume</h5>
                <p className="text-[11px] text-slate-500">
                  {resumeUrl ? "Verified PDF document ready for recruiter screening" : "No resume file uploaded yet"}
                </p>
              </div>
            </div>

            {resumeUrl ? (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition"
              >
                <span>View Full Resume</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <button
                disabled
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400 bg-white cursor-not-allowed"
              >
                <span>No Resume</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            TPO Placement Management System
          </span>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
