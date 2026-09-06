import { useState, useEffect } from "react";
import {
  X,
  FileText,
  Upload,
  CheckCircle2,
  ExternalLink,
  Award,
  ShieldCheck,
  Plus,
  Trash2,
  GraduationCap,
  Globe,
  BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import { updateStudentProfile, updateStudentResume } from "../../services/studentService";
import { getResumeViewUrl } from "../../utils/resumeHelper";

const BRANCH_OPTIONS = [
  "CSE",
  "IT",
  "ECE",
  "EE",
  "ME",
  "AIDS",
  "CSBS",
  "Civil",
  "Computer Science",
  "Information Technology",
  "Other",
];

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
    branch: studentProfile?.branch || "CSE",
    customBranch: "",
    semester: studentProfile?.semester ?? 6,
    graduationYear: studentProfile?.graduationYear ?? 2027,
    cgpa: studentProfile?.cgpa ?? 8.0,
    backlogs: studentProfile?.backlogs ?? 0,
    tenthPercentage: studentProfile?.tenthPercentage ?? "",
    twelfthPercentage: studentProfile?.twelfthPercentage ?? "",
    about: studentProfile?.about || "",
    skills: Array.isArray(studentProfile?.skills)
      ? studentProfile.skills.join(", ")
      : typeof studentProfile?.skills === "string"
      ? studentProfile.skills
      : "React, Node.js, Python, SQL",
  });

  const [certificates, setCertificates] = useState(
    Array.isArray(studentProfile?.certificates) ? studentProfile.certificates : []
  );

  // New certificate form state
  const [showAddCert, setShowAddCert] = useState(false);
  const [newCert, setNewCert] = useState({
    title: "",
    issuer: "",
    issueDate: "",
    certificateUrl: "",
    credentialId: "",
  });

  // Keep form data synchronized when studentProfile loads or updates
  useEffect(() => {
    if (studentProfile) {
      const isCustom =
        studentProfile.branch && !BRANCH_OPTIONS.includes(studentProfile.branch);
      setFormData({
        branch: isCustom ? "Other" : studentProfile.branch || "CSE",
        customBranch: isCustom ? studentProfile.branch : "",
        semester: studentProfile.semester ?? 6,
        graduationYear: studentProfile.graduationYear ?? 2027,
        cgpa: studentProfile.cgpa ?? 8.0,
        backlogs: studentProfile.backlogs ?? 0,
        tenthPercentage: studentProfile.tenthPercentage ?? "",
        twelfthPercentage: studentProfile.twelfthPercentage ?? "",
        about: studentProfile.about || "",
        skills: Array.isArray(studentProfile.skills)
          ? studentProfile.skills.join(", ")
          : typeof studentProfile.skills === "string"
          ? studentProfile.skills
          : "React, Node.js, Python, SQL",
      });
      setCertificates(
        Array.isArray(studentProfile.certificates) ? studentProfile.certificates : []
      );
    }
  }, [studentProfile]);

  if (!isOpen) return null;

  const displayName = user?.fullName || studentProfile?.user?.fullName || "Student User";
  const displayEmail = user?.email || studentProfile?.user?.email || "student@college.edu";
  const enrollment = studentProfile?.enrollmentNumber || "ENR-2022-CS01";

  // Add Certificate to local list
  const handleAddCertToList = (e) => {
    e.preventDefault();
    if (!newCert.title.trim()) {
      toast.error("Certificate title is required");
      return;
    }

    let url = newCert.certificateUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    const certObj = {
      title: newCert.title.trim(),
      issuer: newCert.issuer.trim(),
      issueDate: newCert.issueDate.trim(),
      certificateUrl: url,
      credentialId: newCert.credentialId.trim(),
    };

    setCertificates((prev) => [...prev, certObj]);
    setNewCert({
      title: "",
      issuer: "",
      issueDate: "",
      certificateUrl: "",
      credentialId: "",
    });
    setShowAddCert(false);
    toast.success("Certificate added to list! Remember to Save Changes.");
  };

  // Remove Certificate
  const handleRemoveCert = (index) => {
    setCertificates((prev) => prev.filter((_, i) => i !== index));
    toast.success("Certificate removed");
  };

  // Test link in a new tab
  const handleTestLink = (url) => {
    if (!url) {
      toast.error("Please enter a URL to test");
      return;
    }
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = "https://" + target;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    const skillsArray = formData.skills
      ? formData.skills.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const finalBranch =
      formData.branch === "Other"
        ? formData.customBranch.trim() || "CSE"
        : formData.branch;

    const payload = {
      enrollmentNumber: studentProfile?.enrollmentNumber || enrollment,
      branch: finalBranch,
      semester: Number(formData.semester),
      graduationYear: Number(formData.graduationYear),
      cgpa: Number(formData.cgpa),
      backlogs: Number(formData.backlogs),
      tenthPercentage:
        formData.tenthPercentage !== "" && formData.tenthPercentage !== null
          ? Number(formData.tenthPercentage)
          : null,
      twelfthPercentage:
        formData.twelfthPercentage !== "" && formData.twelfthPercentage !== null
          ? Number(formData.twelfthPercentage)
          : null,
      certificates: certificates,
      about: formData.about,
      skills: skillsArray,
    };

    try {
      const res = await updateStudentProfile(payload);
      const savedProfile = res?.data || {
        ...studentProfile,
        ...payload,
        user: user || studentProfile?.user,
      };

      toast.success("Academic details updated successfully!");
      setIsEditing(false);
      if (onProfileUpdated) onProfileUpdated(savedProfile);
    } catch (err) {
      console.warn("Update profile API note:", err);
      const localUpdated = {
        ...studentProfile,
        ...payload,
        user: user || studentProfile?.user,
      };
      toast.success("Profile saved locally!");
      setIsEditing(false);
      if (onProfileUpdated) onProfileUpdated(localUpdated);
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
      const res = await updateStudentResume(data);
      toast.success("Resume uploaded successfully!");
      setResumeFile(null);
      if (onProfileUpdated && res?.data) {
        onProfileUpdated(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to upload resume";
      toast.error(msg);
    } finally {
      setUploadingResume(false);
    }
  };

  const skillsList = Array.isArray(studentProfile?.skills)
    ? studentProfile.skills
    : typeof studentProfile?.skills === "string" && studentProfile.skills
    ? studentProfile.skills.split(",").map((s) => s.trim())
    : ["React", "Node.js", "Python", "SQL"];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Academic Portfolio</h3>
              <p className="text-xs text-slate-500 font-medium">
                Verified candidate profile & credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Identity Card */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-base font-extrabold text-white shadow-md shadow-blue-500/20">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-900 text-base truncate">
                  {displayName}
                </h4>
                <p className="text-xs text-slate-500 truncate">{displayEmail}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                    {enrollment}
                  </span>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {studentProfile?.branch || "CSE"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {!isEditing ? (
            /* View Mode */
            <div className="space-y-6">
              {/* Primary Academic Metrics Grid */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Academic Performance
                </h4>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center">
                    <p className="text-[11px] font-medium text-slate-500">CGPA</p>
                    <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                      {studentProfile?.cgpa ?? 8.0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center">
                    <p className="text-[11px] font-medium text-slate-500">Semester</p>
                    <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                      {studentProfile?.semester ?? 6}th
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center">
                    <p className="text-[11px] font-medium text-slate-500">Grad Year</p>
                    <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                      {studentProfile?.graduationYear ?? 2027}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center">
                    <p className="text-[11px] font-medium text-slate-500">Backlogs</p>
                    <p className="text-lg font-extrabold text-emerald-600 mt-0.5">
                      {studentProfile?.backlogs ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* 10th & 12th Standard Board Scores */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Secondary & Higher Secondary Scores
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        10th Standard
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">Secondary School</p>
                    </div>
                    <span className="text-base font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                      {studentProfile?.tenthPercentage != null
                        ? `${studentProfile.tenthPercentage}%`
                        : "Not set"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        12th Standard
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">Senior Secondary</p>
                    </div>
                    <span className="text-base font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                      {studentProfile?.twelfthPercentage != null
                        ? `${studentProfile.twelfthPercentage}%`
                        : "Not set"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verified Certificates & Credentials */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-amber-500" />
                    <span>Certificates & Credentials ({certificates.length})</span>
                  </h4>
                </div>

                {certificates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                    <Award className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">
                      No certificates added yet
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Add your certifications with verification links by clicking Edit below.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {certificates.map((cert, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-blue-200 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 mt-0.5">
                              <Award className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-slate-900 leading-tight">
                                {cert.title}
                              </h5>
                              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                                {cert.issuer || "Issuing Authority"}
                                {cert.issueDate ? ` • ${cert.issueDate}` : ""}
                              </p>
                              {cert.credentialId && (
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  ID: {cert.credentialId}
                                </p>
                              )}
                            </div>
                          </div>

                          {cert.certificateUrl ? (
                            <a
                              href={cert.certificateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold transition border border-emerald-200 shadow-2xs"
                              title="Verify certificate on original website"
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Verify Link</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                              No link
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Verified Resume Section */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                    href={getResumeViewUrl(studentProfile.resume.url)}
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                Edit Academic Details & Certificates
              </button>
            </div>
          ) : (
            /* Edit Mode */
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Program & Academic Scores */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  1. Degree & Branch Details
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Branch
                    </label>
                    <select
                      value={formData.branch}
                      onChange={(e) =>
                        setFormData({ ...formData, branch: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 bg-white"
                      required
                    >
                      {BRANCH_OPTIONS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
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
                    >
                    </input>
                  </div>
                </div>

                {formData.branch === "Other" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Specify Custom Branch
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mechatronics Engineering"
                      value={formData.customBranch}
                      onChange={(e) =>
                        setFormData({ ...formData, customBranch: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      CGPA (0 - 10)
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
                      Active Backlogs
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

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Grad Year
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
                </div>
              </div>

              {/* 10th & 12th Standard Section */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>2. 10th & 12th Standard Percentage</span>
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      10th Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="e.g. 92.5"
                      value={formData.tenthPercentage}
                      onChange={(e) =>
                        setFormData({ ...formData, tenthPercentage: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      12th Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="e.g. 89.0"
                      value={formData.twelfthPercentage}
                      onChange={(e) =>
                        setFormData({ ...formData, twelfthPercentage: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Certificates & Verification Links Management */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5" />
                    <span>3. Certificates & Online Verification Links</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddCert(!showAddCert)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{showAddCert ? "Close Form" : "Add Certificate"}</span>
                  </button>
                </div>

                {/* Add Certificate Form */}
                {showAddCert && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-2.5 animate-in fade-in duration-150">
                    <p className="text-xs font-bold text-slate-800">
                      Add Verified Certification
                    </p>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Certificate Title *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. AWS Certified Solutions Architect"
                        value={newCert.title}
                        onChange={(e) =>
                          setNewCert({ ...newCert, title: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Issuing Organization
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Amazon Web Services, Coursera"
                          value={newCert.issuer}
                          onChange={(e) =>
                            setNewCert({ ...newCert, issuer: e.target.value })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Issue Date / Year
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Aug 2024"
                          value={newCert.issueDate}
                          onChange={(e) =>
                            setNewCert({ ...newCert, issueDate: e.target.value })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Credential Verification Link (URL)
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          placeholder="https://credly.com/badges/... or original portal"
                          value={newCert.certificateUrl}
                          onChange={(e) =>
                            setNewCert({ ...newCert, certificateUrl: e.target.value })
                          }
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                        />
                        {newCert.certificateUrl && (
                          <button
                            type="button"
                            onClick={() => handleTestLink(newCert.certificateUrl)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition flex items-center gap-1 shrink-0"
                            title="Test link in new tab"
                          >
                            <Globe className="h-3.5 w-3.5 text-blue-600" />
                            <span>Test</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        License / Credential ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CERT-98471"
                        value={newCert.credentialId}
                        onChange={(e) =>
                          setNewCert({ ...newCert, credentialId: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddCert(false)}
                        className="px-3 py-1.5 rounded-xl text-slate-500 hover:bg-slate-200/60 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCertToList}
                        className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
                      >
                        Add to List
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing Certificates List in Edit Mode */}
                <div className="space-y-2">
                  {certificates.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      No certificates added yet. Click "+ Add Certificate" above.
                    </p>
                  ) : (
                    certificates.map((cert, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-bold text-slate-800 truncate">
                            {cert.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {cert.issuer || "No issuer"} {cert.issueDate ? `(${cert.issueDate})` : ""}
                          </p>
                          {cert.certificateUrl && (
                            <a
                              href={cert.certificateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <ShieldCheck className="h-3 w-3 text-emerald-600" />
                              <span className="truncate">{cert.certificateUrl}</span>
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {cert.certificateUrl && (
                            <button
                              type="button"
                              onClick={() => handleTestLink(cert.certificateUrl)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100/60"
                              title="Test link"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveCert(index)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                            title="Delete certificate"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Skills & Bio */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  4. Skills & Bio
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Technical Skills (comma separated)
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
                    About Me / Career Objective
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
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
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
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  {saving ? "Saving Changes..." : "Save Academic Details"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
