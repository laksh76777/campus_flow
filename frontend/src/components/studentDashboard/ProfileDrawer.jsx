import { useState } from "react";
import {
  X,
  FileText,
  Upload,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { updateStudentProfile, updateStudentResume } from "../../services/studentService";

export default function ProfileDrawer({
  isOpen,
  onClose,
  user,
  studentProfile,
  onProfileUpdated,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  const [formData, setFormData] = useState({
    branch: studentProfile?.branch || "Computer Science",
    semester: studentProfile?.semester || 6,
    graduationYear: studentProfile?.graduationYear || 2026,
    cgpa: studentProfile?.cgpa || 8.5,
    backlogs: studentProfile?.backlogs || 0,
    about: studentProfile?.about || "",
    skills: Array.isArray(studentProfile?.skills)
      ? studentProfile.skills.join(", ")
      : "React, Node.js, Python, SQL",
  });

  if (!isOpen) return null;

  const displayName = user?.fullName || studentProfile?.user?.fullName || "Student User";
  const displayEmail = user?.email || studentProfile?.user?.email || "student@college.edu";
  const enrollment = studentProfile?.enrollmentNumber || "ENR-2022-CS01";

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const skillsArray = formData.skills
        ? formData.skills.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      await updateStudentProfile({
        branch: formData.branch,
        semester: Number(formData.semester),
        graduationYear: Number(formData.graduationYear),
        cgpa: Number(formData.cgpa),
        backlogs: Number(formData.backlogs),
        about: formData.about,
        skills: skillsArray,
      });

      toast.success("Profile updated successfully!");
      setIsEditing(false);
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadResume = async (e) => {
    e.preventDefault();
    if (!resumeFile) {
      toast.error("Please select a resume file first");
      return;
    }

    setUploadingResume(true);
    const data = new FormData();
    data.append("resume", resumeFile);

    try {
      await updateStudentResume(data);
      toast.success("Resume uploaded successfully!");
      setResumeFile(null);
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || "Resume upload failed");
    } finally {
      setUploadingResume(false);
    }
  };

  const skillsList = Array.isArray(studentProfile?.skills) && studentProfile.skills.length > 0
    ? studentProfile.skills
    : ["React.js", "Node.js", "JavaScript", "Python", "Data Structures", "SQL"];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex h-20 items-center justify-between border-b border-slate-200 px-6 sm:px-8 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Academic Profile</h2>
            <p className="text-xs text-slate-500">View and update your placement portfolio</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Identity Snapshot */}
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 p-5 text-white shadow-md">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold shadow-md shadow-blue-500/30">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg leading-tight truncate">{displayName}</h3>
              <p className="text-xs text-slate-300 truncate mt-0.5">{displayEmail}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-blue-200">
                  {enrollment}
                </span>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                  Verified Candidate
                </span>
              </div>
            </div>
          </div>

          {!isEditing ? (
            /* View Mode */
            <div className="space-y-6">
              {/* Academic Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center">
                  <p className="text-[11px] font-medium text-slate-500">CGPA</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {studentProfile?.cgpa ?? 8.5}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center">
                  <p className="text-[11px] font-medium text-slate-500">Semester</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {studentProfile?.semester ?? 6}th
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center">
                  <p className="text-[11px] font-medium text-slate-500">Grad Year</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {studentProfile?.graduationYear ?? 2026}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center">
                  <p className="text-[11px] font-medium text-slate-500">Backlogs</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {studentProfile?.backlogs ?? 0}
                  </p>
                </div>
              </div>

              {/* Branch & Specialization */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Branch & Program
                </h4>
                <p className="text-sm font-semibold text-slate-800">
                  {studentProfile?.branch || "Computer Science & Engineering"}
                </p>
              </div>

              {/* Verified Resume Section */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Uploaded Resume
                  </h4>
                  {studentProfile?.resume?.url ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      Uploaded
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Not Uploaded
                    </span>
                  )}
                </div>

                {studentProfile?.resume?.url && (
                  <a
                    href={studentProfile.resume.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl bg-blue-50/60 p-3 text-xs font-semibold text-blue-700 border border-blue-100 transition hover:bg-blue-100/70"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      View Stored Resume PDF
                    </span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}

                {/* Upload New Resume Form */}
                <form onSubmit={handleUploadResume} className="mt-2 space-y-2">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setResumeFile(e.target.files[0])}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {resumeFile && (
                    <button
                      type="submit"
                      disabled={uploadingResume}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
                    >
                      <Upload className="h-3 w-3" />
                      {uploadingResume ? "Uploading..." : "Upload Selected Resume"}
                    </button>
                  )}
                </form>
              </div>

              {/* Skills Section */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Technical Skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {skillsList.map((skill, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200/60"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Edit Trigger */}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition"
              >
                Edit Academic Details
              </button>
            </div>
          ) : (
            /* Edit Form */
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) =>
                      setFormData({ ...formData, branch: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Semester
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={formData.semester}
                    onChange={(e) =>
                      setFormData({ ...formData, semester: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CGPA
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={formData.cgpa}
                    onChange={(e) =>
                      setFormData({ ...formData, cgpa: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Backlogs
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.backlogs}
                    onChange={(e) =>
                      setFormData({ ...formData, backlogs: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Graduation Year
                </label>
                <input
                  type="number"
                  value={formData.graduationYear}
                  onChange={(e) =>
                    setFormData({ ...formData, graduationYear: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Skills (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={(e) =>
                    setFormData({ ...formData, skills: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  About Me / Bio
                </label>
                <textarea
                  rows="3"
                  value={formData.about}
                  onChange={(e) =>
                    setFormData({ ...formData, about: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
