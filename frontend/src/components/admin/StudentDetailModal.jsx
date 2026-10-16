import { useState, useEffect } from "react";
import {
  X,
  Mail,
  Phone,
  GraduationCap,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  BookOpen,
  Layers,
  Sparkles,
  Users,
  Check,
  RotateCcw
} from "lucide-react";
import toast from "react-hot-toast";
import { getResumeViewUrl } from "../../utils/resumeHelper";
import { verifyStudentProfile } from "../../services/studentService";

export default function StudentDetailModal({ student, isOpen, onClose, onStudentVerified }) {
  const [verifying, setVerifying] = useState(false);
  const [currentVerification, setCurrentVerification] = useState(student?.verificationStatus || "PENDING");

  useEffect(() => {
    if (student) {
      setCurrentVerification(student.verificationStatus || "PENDING");
    }
  }, [student]);

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
  const enrollmentNo = student.enrollmentNumber || student.usn || "Not Assigned";
  const branch = student.programCode
    ? `${student.degreeType || student.course || ""} · ${student.branch || student.department || student.programCode}`
    : `Needs program review: ${student.branch || student.department || "Not provided"}`;
  const course = student.course || "Not provided";
  const semester = student.semester ?? student.currentSemester;
  const graduationYear = student.graduationYear;
  const cgpa = student.verifiedCGPA ?? student.cgpa;
  const activeBacklogs = student.activeBacklogs ?? student.backlogs;
  const clearedBacklogs = student.clearedBacklogsCount;
  const tenth = student.tenthDetails?.percentage ?? student.tenthPercentage;
  const twelfth = student.twelfthOrDiplomaDetails?.percentage ?? student.twelfthPercentage;
  const isPlaced = student.isPlaced;
  const placedCompany = student.placedCompany || "";
  const placedPackage = student.placedPackage;
  const placedJobTitle = student.placedJobTitle || "";
  const placedAt = student.placedAt;
  const skills = Array.isArray(student.skills) ? student.skills : [];
  const certificates = Array.isArray(student.certificates) ? student.certificates : [];
  const rawResumeUrl = student.resume?.url || student.resumeUrl;
  const resumeUrl = getResumeViewUrl(rawResumeUrl);
  const semesterResults = Array.isArray(student.semesterResults)
    ? student.semesterResults
    : [];
  const backlogDetails = Array.isArray(student.backlogDetails)
    ? student.backlogDetails
    : [];
  const educationGaps = Array.isArray(student.educationGaps)
    ? student.educationGaps
    : [];
  const about = student.about || "";

  const handleVerify = async (status, remarks = "") => {
    setVerifying(true);
    try {
      const res = await verifyStudentProfile(student._id, {
        verificationStatus: status,
        verificationRemarks: remarks,
        verifiedCGPA: student.cgpa
      });
      toast.success(`Candidate profile status set to ${status}!`);
      setCurrentVerification(status);
      if (onStudentVerified && res?.data) {
        onStudentVerified(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update candidate verification status");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="relative bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-6 sm:p-7 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 h-9 w-9 flex items-center justify-center rounded-xl bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition active:scale-95"
            title="Close dossier"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pr-10">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl object-cover border-2 border-white/20 shadow-md shrink-0"
              />
            ) : (
              <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl bg-blue-600/60 border-2 border-white/20 flex items-center justify-center text-2xl font-black text-white shrink-0">
                {fullName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                  {fullName}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    currentVerification === "VERIFIED"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                      : currentVerification === "REJECTED"
                      ? "bg-rose-500/20 text-rose-300 border-rose-400/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-400/30"
                  }`}
                >
                  {currentVerification}
                </span>
                {student.isProfileLocked && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-400/30">
                    🔒 Locked Profile
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-white/70">
                <span className="font-mono bg-white/10 px-2 py-0.5 rounded-md text-white font-bold">
                  USN: {enrollmentNo}
                </span>
                <span>•</span>
                <span>{course} - {branch}</span>
                <span>•</span>
                <span>Class of {graduationYear ?? "Not provided"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Modification Notice Banner if any */}
        {student.modificationRequests?.some((r) => r.status === "PENDING") && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 text-xs text-amber-950">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="font-extrabold">Student has submitted a Profile Modification Request awaiting TPO approval.</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 text-[10px] font-black uppercase">
              Pending Diff Review
            </span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Contact Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 font-semibold">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a>
              </span>
              {phone && (
                <span className="flex items-center gap-1.5 font-semibold">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{phone}</span>
                </span>
              )}
            </div>

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
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-slate-500" />
              <span>Institutional Academic Records</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Verified CGPA</span>
                <p className="text-2xl font-black text-blue-600 mt-1">
                  {cgpa != null ? `${cgpa} / 10` : "N/A"}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Current Sem</span>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {semester != null ? `${semester}th Sem` : "N/A"}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Active Backlogs</span>
                <p className={`text-2xl font-black mt-1 ${activeBacklogs === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {activeBacklogs ?? "N/A"}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Cleared Backlogs</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  {clearedBacklogs ?? "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* 10th & 12th/Diploma Qualification */}
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-emerald-600" />
              <span>Prior Educational Qualifications</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-black text-slate-700 uppercase">10th Standard (SSC)</span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {student.tenthDetails?.schoolName || "Not provided"} ({student.tenthDetails?.passingYear ?? "N/A"})
                  </p>
                </div>
                <span className="text-base font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                  {tenth !== undefined && tenth !== null ? `${tenth}%` : "N/A"}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-black text-slate-700 uppercase">
                    {student.twelfthOrDiplomaDetails?.qualificationType || "12th Standard"}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {student.twelfthOrDiplomaDetails?.institutionName || "Not provided"} ({student.twelfthOrDiplomaDetails?.passingYear ?? "N/A"})
                  </p>
                </div>
                <span className="text-base font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  {twelfth !== undefined && twelfth !== null ? `${twelfth}%` : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Semester SGPA Breakdown */}
          {semesterResults.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-blue-600" />
                <span>Semester-Wise SGPA Records</span>
              </h4>
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <tr>
                      <th className="py-2 px-3">Semester</th>
                      <th className="py-2 px-3">Credits</th>
                      <th className="py-2 px-3">SGPA</th>
                      <th className="py-2 px-3 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                    {semesterResults.map((s, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-bold">Sem {s.semester}</td>
                        <td className="py-2 px-3 text-slate-500">{s.credits ?? "N/A"}</td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-600">{s.sgpa != null ? s.sgpa : "Not entered"}</td>
                        <td className="py-2 px-3 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {s.isVerified === true
                              ? "Verified"
                              : s.isVerified === false
                              ? "Pending"
                              : "Unknown"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Education Gaps Section */}
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>Education & Year Gaps</span>
            </h4>
            {student.hasEducationGap === true ? (
              educationGaps.length > 0 ? (
                <div className="space-y-2">
                  {educationGaps.map((gap, idx) => (
                    <div key={gap._id || idx} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-900">
                        <span>{gap.reason || "Reason not provided"}</span>
                        <span className="text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md text-[10px]">
                          {gap.startYear ?? "N/A"} - {gap.endYear ?? "N/A"} ({gap.durationMonths ?? "N/A"} Mos)
                        </span>
                      </div>
                      {gap.explanation && <p className="text-slate-600 mt-1 text-[11px]">{gap.explanation}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800 font-semibold">
                  An education gap is declared, but its details are not available.
                </div>
              )
            ) : student.hasEducationGap === false ? (
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 font-semibold">
                No education gaps declared.
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 font-semibold">
                Education gap details not provided.
              </div>
            )}
          </div>

          {/* Confidential Family & Address Details */}
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-purple-600" />
              <span>Family & Address (TPO Confidential)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white">
                <span className="text-slate-400 font-bold block mb-1">Parent Contacts</span>
                <p className="font-bold text-slate-800">Father: {student.family?.fatherName || "N/A"}</p>
                <p className="text-slate-500 text-[11px]">{student.family?.fatherOccupation} {student.family?.fatherPhone && `• ${student.family?.fatherPhone}`}</p>
                <p className="font-bold text-slate-800 mt-2">Mother: {student.family?.motherName || "N/A"}</p>
                <p className="text-slate-500 text-[11px]">{student.family?.motherOccupation}</p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white">
                <span className="text-slate-400 font-bold block mb-1">Address Details</span>
                <p className="text-slate-700 font-semibold">Current: {[student.currentAddress?.street, student.currentAddress?.city].filter(Boolean).join(", ") || "Not entered"}</p>
                <p className="text-slate-700 font-semibold mt-2">Permanent: {student.sameAsCurrent ? "(Same as current)" : [student.permanentAddress?.street, student.permanentAddress?.city].filter(Boolean).join(", ") || "Not entered"}</p>
              </div>
            </div>
          </div>

          {(backlogDetails.length > 0 || skills.length > 0 || certificates.length > 0 || about) && (
            <div className="space-y-4">
              {backlogDetails.length > 0 && (
                <section>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-rose-500" />
                    <span>Backlog Records</span>
                  </h4>
                  <div className="space-y-2">
                    {backlogDetails.map((backlog, idx) => {
                      const isCleared = backlog.status === "CLEARED";
                      return (
                        <div key={backlog._id || idx} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs">
                          <div>
                            <p className="font-bold text-slate-800">
                              {backlog.subjectCode || "Subject code not provided"}
                              {backlog.subjectName ? ` - ${backlog.subjectName}` : ""}
                            </p>
                            <p className="text-slate-500">
                              Semester {backlog.semester ?? "N/A"} · Attempts {backlog.attempts ?? "N/A"}
                            </p>
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-bold ${isCleared ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            {isCleared ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            {isCleared ? "Cleared" : "Active"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {(skills.length > 0 || certificates.length > 0 || about) && (
                <section>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    <span>Profile & Credentials</span>
                  </h4>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3 text-xs">
                    {about && <p className="text-slate-600">{about}</p>}
                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map((skill, idx) => (
                          <span key={`${skill}-${idx}`} className="rounded-md bg-indigo-50 px-2 py-1 font-semibold text-indigo-700">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    {certificates.map((certificate, idx) => (
                      <div key={certificate._id || idx} className="border-t border-slate-100 pt-2">
                        <p className="font-bold text-slate-800">{certificate.title || "Certificate"}</p>
                        <p className="text-slate-500">
                          {[certificate.issuer, certificate.issueDate].filter(Boolean).join(" · ") || "Issuer/date not provided"}
                        </p>
                        {certificate.certificateUrl && (
                          <a href={certificate.certificateUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline">
                            View certificate <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer with One-Click TPO Verification Controls */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">TPO Verification:</span>
            <button
              onClick={() => handleVerify("VERIFIED")}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Verify Profile</span>
            </button>
            <button
              onClick={() => handleVerify("REVERIFICATION_REQUESTED", "Academic metrics require updated marksheets.")}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Request Re-check</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
