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
  BookOpen,
  Calendar,
  Home,
  Users as UsersIcon,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  Info,
  Building,
  HelpCircle,
  Camera,
  Lock,
  Unlock,
  FileEdit,
  Calculator
} from "lucide-react";
import toast from "react-hot-toast";
import {
  updateStudentProfile,
  updateStudentResume,
  deleteStudentResume,
  updateUserAvatar,
  deleteUserAvatar,
  addSemesterResult,
  addBacklogRecord,
  lockProfile
} from "../../services/studentService";
import { getPublicDepartments } from "../../services/authService";
import { getResumeViewUrl } from "../../utils/resumeHelper";
import ProfileLockConfirmationModal from "./ProfileLockConfirmationModal";
import ProfileModificationModal from "./ProfileModificationModal";

const LEGACY_PROGRAM_CODES = {
  "computer science and engineering": "CSE",
  "computer science and engineering (cse)": "CSE",
  "information science and engineering": "ISE",
  "information science and engineering (ise)": "ISE",
  "electronics and communication engineering": "ECE",
  "electronics and communication engineering (ece)": "ECE",
  "electronics and instrumentation engineering": "EIE",
  "robotics and automation": "RA",
  "civil engineering": "CIVIL",
  "mechanical engineering": "MECH",
  "mechanical engineering (me)": "MECH",
  "computer science and engineering - artificial intelligence and machine learning": "CSE-AIML",
  "m.tech in data science": "MTECH-DS",
  "m.tech in vlsi design and embedded systems": "MTECH-VLSI",
  "m.tech in thermal engineering": "MTECH-THERMAL",
};
const BOARD_OPTIONS = ["CBSE", "ICSE", "State Board", "Other"];
const TWELFTH_BOARD_OPTIONS = ["CBSE", "ISC", "State Board", "Other"];
const GAP_REASONS = [
  "Personal reasons",
  "Medical reasons",
  "Entrance examination preparation",
  "Financial reasons",
  "Family responsibilities",
  "Other"
];

export default function ProfileDrawer({
  isOpen,
  onClose,
  user,
  studentProfile,
  onProfileUpdated,
  initialSection = "all",
  initialEditing = false
}) {
  const [activeSection, setActiveSection] = useState(initialSection || "all");
  const [isEditing, setIsEditing] = useState(Boolean(initialEditing));
  const [saving, setSaving] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [isModModalOpen, setIsModModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialSection) setActiveSection(initialSection);
      if (initialEditing) setIsEditing(true);
    }
  }, [isOpen, initialSection, initialEditing]);

  useEffect(() => {
    if (!isOpen) return;
    getPublicDepartments()
      .then((response) => setPrograms(response.data || []))
      .catch((error) => {
        console.error("Failed to load approved academic programs:", error);
        toast.error("Could not load approved academic programs");
      });
  }, [isOpen]);

  // Modal for editing an individual semester SGPA
  const [editingSem, setEditingSem] = useState(null); // { semester: 1, sgpa: "8.5" }
  const [semSgpaInput, setSemSgpaInput] = useState("");

  // Modal for adding a backlog record
  const [isAddBacklogOpen, setIsAddBacklogOpen] = useState(false);
  const [backlogSubCode, setBacklogSubCode] = useState("");
  const [backlogSubName, setBacklogSubName] = useState("");
  const [backlogSem, setBacklogSem] = useState(1);
  const [backlogStatus, setBacklogStatus] = useState("ACTIVE");

  // Modal for adding an education gap
  const [isAddGapOpen, setIsAddGapOpen] = useState(false);
  const [gapStartYear, setGapStartYear] = useState(2021);
  const [gapEndYear, setGapEndYear] = useState(2022);
  const [gapDurationMonths, setGapDurationMonths] = useState(12);
  const [gapReason, setGapReason] = useState("Entrance examination preparation");
  const [gapExplanation, setGapExplanation] = useState("");

  // Comprehensive Form State
  const [formData, setFormData] = useState({
    // College & Degree
    programLevel: "",
    programCode: "",
    semester: "",
    graduationYear: "",
    admissionYear: "",
    cgpa: "",
    about: "",
    skills: "React, Node.js, Python, SQL",

    // Class 10 Details
    tenthSchool: "",
    tenthBoard: "CBSE",
    tenthState: "",
    tenthYear: "",
    tenthPercentage: "",
    tenthMarks: "",
    tenthMaxMarks: "",
    tenthMarksheetUrl: "",

    // Class 12 / Diploma Details
    twelfthType: "12th", // "12th", "Diploma", "Other"
    twelfthInst: "",
    twelfthBoard: "CBSE",
    twelfthState: "",
    diplomaBranch: "",
    twelfthYear: "",
    twelfthPercentage: "",
    twelfthMarks: "",
    twelfthMaxMarks: "",
    twelfthMarksheetUrl: "",

    // Education Gap Flag
    hasEducationGap: false,
    educationGaps: [],

    // Personal Details
    gender: "Prefer not to say",
    dob: "",
    personalEmail: "",
    collegeEmail: "",
    alternatePhone: "",

    // Family Details (Father, Mother, Guardian)
    fatherName: "",
    fatherOccupation: "",
    fatherEmployer: "",
    fatherPhone: "",
    fatherEmail: "",
    motherName: "",
    motherOccupation: "",
    motherEmployer: "",
    motherPhone: "",
    motherEmail: "",
    guardianName: "",
    guardianRelation: "",
    guardianOccupation: "",
    guardianPhone: "",

    // Address Details
    currentStreet: "",
    currentLocality: "",
    currentCity: "",
    currentDistrict: "",
    currentState: "",
    currentPincode: "",
    permanentStreet: "",
    permanentLocality: "",
    permanentCity: "",
    permanentDistrict: "",
    permanentState: "",
    permanentPincode: "",
    sameAsCurrent: false
  });

  const [certificates, setCertificates] = useState([]);

  // Sync state with incoming studentProfile prop
  useEffect(() => {
    if (studentProfile) {
      const legacyBranch = (studentProfile.branch || studentProfile.department || "").trim();
      const normalizedBranch = legacyBranch.toLowerCase();
      const legacyProgramCode = LEGACY_PROGRAM_CODES[normalizedBranch] || "";

      setFormData({
        programLevel: studentProfile.programLevel || "",
        programCode: studentProfile.programCode || legacyProgramCode,
        semester: studentProfile.semester ?? studentProfile.currentSemester ?? "",
        graduationYear: studentProfile.graduationYear ?? "",
        admissionYear: studentProfile.admissionYear ?? "",
        cgpa: studentProfile.cgpa ?? studentProfile.verifiedCGPA ?? "",
        about: studentProfile.about || "",
        skills: Array.isArray(studentProfile.skills)
          ? studentProfile.skills.join(", ")
          : typeof studentProfile.skills === "string"
          ? studentProfile.skills
          : "React, Node.js, Python, SQL",

        // Class 10
        tenthSchool: studentProfile.tenthDetails?.schoolName || "",
        tenthBoard: studentProfile.tenthDetails?.board || "CBSE",
        tenthState: studentProfile.tenthDetails?.state || "",
        tenthYear: studentProfile.tenthDetails?.passingYear || "",
        tenthPercentage: studentProfile.tenthDetails?.percentage ?? studentProfile.tenthPercentage ?? "",
        tenthMarks: studentProfile.tenthDetails?.marksObtained ?? "",
        tenthMaxMarks: studentProfile.tenthDetails?.maxMarks ?? "",
        tenthMarksheetUrl: studentProfile.tenthDetails?.marksheetUrl || "",

        // Class 12 / Diploma
        twelfthType: studentProfile.twelfthOrDiplomaDetails?.qualificationType || "12th",
        twelfthInst: studentProfile.twelfthOrDiplomaDetails?.institutionName || "",
        twelfthBoard: studentProfile.twelfthOrDiplomaDetails?.boardOrUniversity || "CBSE",
        twelfthState: studentProfile.twelfthOrDiplomaDetails?.state || "",
        diplomaBranch: studentProfile.twelfthOrDiplomaDetails?.diplomaBranch || "",
        twelfthYear: studentProfile.twelfthOrDiplomaDetails?.passingYear || "",
        twelfthPercentage: studentProfile.twelfthOrDiplomaDetails?.percentage ?? studentProfile.twelfthPercentage ?? "",
        twelfthMarks: studentProfile.twelfthOrDiplomaDetails?.marksObtained ?? "",
        twelfthMaxMarks: studentProfile.twelfthOrDiplomaDetails?.maxMarks ?? "",
        twelfthMarksheetUrl: studentProfile.twelfthOrDiplomaDetails?.marksheetUrl || "",

        // Education Gap
        hasEducationGap: Boolean(studentProfile.hasEducationGap || (studentProfile.educationGaps && studentProfile.educationGaps.length > 0)),
        educationGaps: Array.isArray(studentProfile.educationGaps) ? studentProfile.educationGaps : [],

        // Personal
        gender: studentProfile.gender || "Prefer not to say",
        dob: studentProfile.dob ? new Date(studentProfile.dob).toISOString().slice(0, 10) : "",
        personalEmail: studentProfile.personalEmail || "",
        collegeEmail: studentProfile.collegeEmail || "",
        alternatePhone: studentProfile.alternatePhone || "",

        // Family
        fatherName: studentProfile.family?.fatherName || "",
        fatherOccupation: studentProfile.family?.fatherOccupation || "",
        fatherEmployer: studentProfile.family?.fatherEmployer || "",
        fatherPhone: studentProfile.family?.fatherPhone || "",
        fatherEmail: studentProfile.family?.fatherEmail || "",
        motherName: studentProfile.family?.motherName || "",
        motherOccupation: studentProfile.family?.motherOccupation || "",
        motherEmployer: studentProfile.family?.motherEmployer || "",
        motherPhone: studentProfile.family?.motherPhone || "",
        motherEmail: studentProfile.family?.motherEmail || "",
        guardianName: studentProfile.family?.guardianName || "",
        guardianRelation: studentProfile.family?.guardianRelation || "",
        guardianOccupation: studentProfile.family?.guardianOccupation || "",
        guardianPhone: studentProfile.family?.guardianPhone || "",

        // Address
        currentStreet: studentProfile.currentAddress?.street || "",
        currentLocality: studentProfile.currentAddress?.locality || "",
        currentCity: studentProfile.currentAddress?.city || "",
        currentDistrict: studentProfile.currentAddress?.district || "",
        currentState: studentProfile.currentAddress?.state || "",
        currentPincode: studentProfile.currentAddress?.pincode || "",
        permanentStreet: studentProfile.permanentAddress?.street || "",
        permanentLocality: studentProfile.permanentAddress?.locality || "",
        permanentCity: studentProfile.permanentAddress?.city || "",
        permanentDistrict: studentProfile.permanentAddress?.district || "",
        permanentState: studentProfile.permanentAddress?.state || "",
        permanentPincode: studentProfile.permanentAddress?.pincode || "",
        sameAsCurrent: Boolean(studentProfile.sameAsCurrent)
      });

      setCertificates(
        Array.isArray(studentProfile.certificates) ? studentProfile.certificates : []
      );
    }
  }, [studentProfile]);

  useEffect(() => {
    if (!studentProfile || programs.length === 0) return;
    const currentCode = studentProfile.programCode || LEGACY_PROGRAM_CODES[(studentProfile.branch || studentProfile.department || "").trim().toLowerCase()];
    const program = programs.find((item) => item.code === currentCode);
    if (program) {
      setFormData((previous) => ({
        ...previous,
        programCode: previous.programCode || program.code,
        programLevel: previous.programLevel || program.programLevel,
      }));
    }
  }, [studentProfile, programs]);

  if (!isOpen) return null;

  const displayName = user?.fullName || studentProfile?.user?.fullName || "Student Candidate";
  const displayEmail = user?.email || studentProfile?.user?.email || "";
  const enrollment = studentProfile?.enrollmentNumber || studentProfile?.usn || "Not Assigned";
  const completeness = studentProfile?.profileCompleteness ?? 50;
  const verification = studentProfile?.verificationStatus || "PENDING";
  const rawResumeUrl = studentProfile?.resume?.url;
  const resumeViewUrl = getResumeViewUrl(rawResumeUrl);

  const semesterResults = studentProfile?.semesterResults || [];
  const backlogDetails = studentProfile?.backlogDetails || [];
  const activeBacklogsCount = studentProfile?.activeBacklogs ?? studentProfile?.backlogs ?? 0;
  const clearedBacklogsCount = studentProfile?.clearedBacklogsCount ?? 0;
  const educationGapsList = formData.educationGaps || [];

  // Helper map for semesters 1 to 8
  const semMap = {};
  semesterResults.forEach((s) => {
    semMap[s.semester] = s.sgpa;
  });

  // Automatically calculate cumulative CGPA from entered semester SGPAs
  const validSgpas = semesterResults
    .map((s) => Number(s.sgpa))
    .filter((n) => !isNaN(n) && n > 0);
  const calculatedCgpa = validSgpas.length > 0
    ? (validSgpas.reduce((a, b) => a + b, 0) / validSgpas.length).toFixed(2)
    : (studentProfile?.verifiedCGPA ?? studentProfile?.cgpa ?? "");

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);

    const selectedProgram = programs.find((program) => program.code === formData.programCode);
    if (!selectedProgram || selectedProgram.programLevel !== formData.programLevel) {
      toast.error("Select a valid approved academic program before saving");
      setSaving(false);
      return;
    }

    const payload = {
      programCode: selectedProgram.code,
      programLevel: selectedProgram.programLevel,
      degreeType: selectedProgram.degreeType,
      course: selectedProgram.degreeType,
      branch: selectedProgram.name,
      department: selectedProgram.name,
      semester: Number(formData.semester),
      currentSemester: Number(formData.semester),
      graduationYear: Number(formData.graduationYear),
      admissionYear: Number(formData.admissionYear),
      cgpa: calculatedCgpa ? Number(calculatedCgpa) : (formData.cgpa === "" ? null : Number(formData.cgpa)),
      about: formData.about.trim(),
      skills: formData.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),

      // 10th Standard
      tenthDetails: {
        schoolName: formData.tenthSchool.trim(),
        board: formData.tenthBoard.trim(),
        state: formData.tenthState.trim(),
        passingYear: Number(formData.tenthYear) || null,
        percentage: formData.tenthPercentage === "" ? null : Number(formData.tenthPercentage),
        marksObtained: formData.tenthMarks === "" ? null : Number(formData.tenthMarks),
        maxMarks: formData.tenthMaxMarks === "" ? null : Number(formData.tenthMaxMarks),
        marksheetUrl: formData.tenthMarksheetUrl.trim()
      },
      tenthPercentage: formData.tenthPercentage === "" ? null : Number(formData.tenthPercentage),

      // 12th / Diploma
      twelfthOrDiplomaDetails: {
        qualificationType: formData.twelfthType,
        institutionName: formData.twelfthInst.trim(),
        boardOrUniversity: formData.twelfthBoard.trim(),
        state: formData.twelfthState.trim(),
        diplomaBranch: formData.diplomaBranch.trim(),
        passingYear: Number(formData.twelfthYear) || null,
        percentage: formData.twelfthPercentage === "" ? null : Number(formData.twelfthPercentage),
        marksObtained: formData.twelfthMarks === "" ? null : Number(formData.twelfthMarks),
        maxMarks: formData.twelfthMaxMarks === "" ? null : Number(formData.twelfthMaxMarks),
        marksheetUrl: formData.twelfthMarksheetUrl.trim()
      },
      twelfthPercentage: formData.twelfthPercentage === "" ? null : Number(formData.twelfthPercentage),

      // Education Gaps
      hasEducationGap: formData.hasEducationGap,
      educationGaps: formData.educationGaps,

      // Personal & Family
      gender: formData.gender,
      dob: formData.dob || null,
      personalEmail: formData.personalEmail.trim(),
      collegeEmail: formData.collegeEmail.trim(),
      alternatePhone: formData.alternatePhone.trim(),
      family: {
        fatherName: formData.fatherName.trim(),
        fatherOccupation: formData.fatherOccupation.trim(),
        fatherEmployer: formData.fatherEmployer.trim(),
        fatherPhone: formData.fatherPhone.trim(),
        fatherEmail: formData.fatherEmail.trim(),
        motherName: formData.motherName.trim(),
        motherOccupation: formData.motherOccupation.trim(),
        motherEmployer: formData.motherEmployer.trim(),
        motherPhone: formData.motherPhone.trim(),
        motherEmail: formData.motherEmail.trim(),
        guardianName: formData.guardianName.trim(),
        guardianRelation: formData.guardianRelation.trim(),
        guardianOccupation: formData.guardianOccupation.trim(),
        guardianPhone: formData.guardianPhone.trim()
      },

      // Addresses
      currentAddress: {
        street: formData.currentStreet.trim(),
        locality: formData.currentLocality.trim(),
        city: formData.currentCity.trim(),
        district: formData.currentDistrict.trim(),
        state: formData.currentState.trim(),
        pincode: formData.currentPincode.trim(),
        country: "India"
      },
      permanentAddress: formData.sameAsCurrent
        ? {
            street: formData.currentStreet.trim(),
            locality: formData.currentLocality.trim(),
            city: formData.currentCity.trim(),
            district: formData.currentDistrict.trim(),
            state: formData.currentState.trim(),
            pincode: formData.currentPincode.trim(),
            country: "India"
          }
        : {
            street: formData.permanentStreet.trim(),
            locality: formData.permanentLocality.trim(),
            city: formData.permanentCity.trim(),
            district: formData.permanentDistrict.trim(),
            state: formData.permanentState.trim(),
            pincode: formData.permanentPincode.trim(),
            country: "India"
          },
      sameAsCurrent: formData.sameAsCurrent,
      certificates
    };

    try {
      const res = await updateStudentProfile(payload);
      if (!studentProfile?.isProfileLocked) {
        try {
          await lockProfile(studentProfile?.user?._id || user?._id);
        } catch (lockErr) {
          console.warn("Auto-lock after confirm & save:", lockErr);
        }
      }
      toast.success("Profile confirmed and saved successfully!");
      setIsEditing(false);
      if (onProfileUpdated && res?.data) {
        onProfileUpdated(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to update profile";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmLock = async () => {
    setSaving(true);
    try {
      const res = await lockProfile(studentProfile?.user?._id || user?._id);
      toast.success("Profile verified & permanently locked for placement drives!");
      setIsLockModalOpen(false);
      setIsEditing(false);
      if (onProfileUpdated && res?.data) {
        onProfileUpdated(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to lock profile");
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

  const handleDeleteResume = async () => {
    if (!window.confirm("Are you sure you want to remove your current resume?")) return;
    try {
      setUploadingResume(true);
      const res = await deleteStudentResume();
      toast.success("Resume removed successfully!");
      if (onProfileUpdated && res?.data) {
        onProfileUpdated(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove resume");
    } finally {
      setUploadingResume(false);
    }
  };

  const handleUploadAvatar = async (e) => {
    e.preventDefault();
    if (!avatarFile) {
      toast.error("Please select a photo first");
      return;
    }
    setUploadingAvatar(true);
    const data = new FormData();
    data.append("avatar", avatarFile);
    try {
      await updateUserAvatar(data);
      toast.success("Profile photo updated successfully!");
      setAvatarFile(null);
      if (onProfileUpdated) {
        onProfileUpdated();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload profile photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!window.confirm("Are you sure you want to remove your profile photo?")) return;
    try {
      setUploadingAvatar(true);
      await deleteUserAvatar();
      toast.success("Profile photo removed successfully!");
      if (onProfileUpdated) {
        onProfileUpdated();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove profile photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveSingleSemester = async (e) => {
    e.preventDefault();
    if (!editingSem) return;
    const val = Number(semSgpaInput);
    if (isNaN(val) || val < 0 || val > 10) {
      toast.error("Please enter a valid SGPA between 0.0 and 10.0");
      return;
    }

    try {
      const res = await addSemesterResult({
        semester: editingSem.semester,
        sgpa: val,
        credits: 20
      });
      toast.success(`Semester ${editingSem.semester} SGPA saved!`);
      setEditingSem(null);
      setSemSgpaInput("");
      if (onProfileUpdated && res?.data) {
        onProfileUpdated({ semesterResults: res.data.semesterResults });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record semester SGPA");
    }
  };

  const handleAddBacklog = async (e) => {
    e.preventDefault();
    if (!backlogSubName.trim()) {
      toast.error("Please enter the subject name");
      return;
    }
    try {
      const res = await addBacklogRecord({
        subjectCode: backlogSubCode.trim(),
        subjectName: backlogSubName.trim(),
        semester: Number(backlogSem),
        status: backlogStatus
      });
      toast.success("Backlog record saved!");
      setIsAddBacklogOpen(false);
      setBacklogSubCode("");
      setBacklogSubName("");
      if (onProfileUpdated && res?.data) {
        onProfileUpdated({
          backlogDetails: res.data.backlogDetails,
          activeBacklogs: res.data.activeBacklogs,
          clearedBacklogsCount: res.data.clearedBacklogsCount,
          historicalBacklogs: res.data.historicalBacklogs,
          backlogs: res.data.backlogs,
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add backlog record");
    }
  };

  const handleAddGapRecord = (e) => {
    e.preventDefault();
    if (gapEndYear <= gapStartYear) {
      toast.error("Gap end year must be after start year");
      return;
    }
    const newGap = {
      hasGap: true,
      gapType: "12th_to_College",
      startYear: Number(gapStartYear),
      endYear: Number(gapEndYear),
      durationMonths: Number(gapDurationMonths) || 12,
      reason: gapReason,
      explanation: gapExplanation.trim(),
      verificationStatus: "PENDING"
    };

    const updatedList = [...formData.educationGaps, newGap];
    setFormData((prev) => ({
      ...prev,
      hasEducationGap: true,
      educationGaps: updatedList
    }));
    setIsAddGapOpen(false);
    setGapExplanation("");
    toast.success("Education gap recorded. Click Save Profile to persist.");
  };

  const handleRemoveGapRecord = (index) => {
    const updatedList = formData.educationGaps.filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      hasEducationGap: updatedList.length > 0,
      educationGaps: updatedList
    }));
    toast.success("Education gap removed. Click Save Profile to persist.");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base tracking-tight">Academic Dossier</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    verification === "VERIFIED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : verification === "REJECTED"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {verification}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Verified candidate profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Completeness Strip */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-700">Profile Completeness:</span>
            <span className="text-xs font-black text-blue-600">{completeness}%</span>
          </div>
          <div className="w-36 sm:w-48 bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completeness >= 80 ? "bg-emerald-500" : completeness >= 50 ? "bg-blue-600" : "bg-amber-500"
              }`}
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>

        {/* Navigation Tabs (Full Dossier + Dedicated Sections) */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-white overflow-x-auto py-2 shrink-0 no-scrollbar">
          {[
            { id: "all", label: "Full Dossier (Verify)", icon: CheckCircle2 },
            { id: "academic", label: "College & CGPA", icon: BookOpen },
            { id: "secondary", label: "10th & 12th/Diploma", icon: Award },
            { id: "semesters", label: "Semester SGPA", icon: Layers },
            { id: "backlogs", label: `Backlogs (${activeBacklogsCount})`, icon: AlertTriangle },
            { id: "gaps", label: `Education Gaps ${formData.hasEducationGap ? "(!)" : ""}`, icon: Clock },
            { id: "family", label: "Family & Address", icon: UsersIcon },
            { id: "resume", label: "Resume & Documents", icon: FileText }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Identity Card */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-base font-extrabold text-white shadow-md shadow-blue-500/20">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-black text-slate-900 text-base truncate">{displayName}</h4>
                <p className="text-xs text-slate-500 truncate">{displayEmail}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    USN: {enrollment}
                  </span>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {programs.find((program) => program.code === (studentProfile?.programCode || formData.programCode))?.name
                      || studentProfile?.branch || studentProfile?.department || "Program requires review"}
                  </span>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    Grad: {studentProfile?.graduationYear ?? "Not assigned"}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    CGPA: {calculatedCgpa || studentProfile?.verifiedCGPA || studentProfile?.cgpa || "Not entered"}
                  </span>
                </div>
              </div>

              {!isEditing && (
                studentProfile?.isProfileLocked ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900">
                      <Lock className="h-3.5 w-3.5 text-amber-700" />
                      <span>Official Record Locked</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsModModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-900 to-orange-700 px-3.5 py-1.5 text-xs font-black text-white hover:from-red-950 transition active:scale-95 shadow-2xs"
                    >
                      <FileEdit className="h-3.5 w-3.5" />
                      <span>Request TPO Modification</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition active:scale-95 shadow-2xs"
                    >
                      <FileEdit className="h-3.5 w-3.5" />
                      <span>Edit Profile</span>
                    </button>
                  </div>
                )
              )}
            </div>
          </div>

          {/* EDIT MODE: FULL TABBED FORM */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {studentProfile?.isProfileLocked && (
                <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-900 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-700 shrink-0" />
                    <span>Official academic records are locked. Request TPO Modification to edit locked items.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModModalOpen(true)}
                    className="font-bold text-amber-900 underline hover:text-black shrink-0 ml-3"
                  >
                    Request Modification
                  </button>
                </div>
              )}

              {/* SECTION: ACADEMICS & DEGREE */}
              <div className="rounded-2xl border border-slate-200 p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span>College, Degree & Cumulative CGPA</span>
                  </h4>
                  {studentProfile?.isProfileLocked && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Program Level *</label>
                    <select
                      value={formData.programLevel}
                      disabled={studentProfile?.isProfileLocked}
                      onChange={(e) => setFormData({ ...formData, programLevel: e.target.value, programCode: "" })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      <option value="">Select program level</option>
                      <option value="Undergraduate">Undergraduate</option>
                      <option value="Postgraduate">Postgraduate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Academic Program *</label>
                    <select
                      value={formData.programCode}
                      disabled={studentProfile?.isProfileLocked || !formData.programLevel}
                      onChange={(e) => setFormData({ ...formData, programCode: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      <option value="">Select academic program</option>
                      {programs.filter((program) => program.programLevel === formData.programLevel).map((program) => (
                        <option key={program.code} value={program.code}>{program.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Current Semester *</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      disabled={studentProfile?.isProfileLocked}
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Overall College CGPA</label>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        Auto-computed from SGPAs
                      </span>
                    </div>
                    <div className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="font-mono text-sm text-blue-700 font-black">
                          {calculatedCgpa ? `${calculatedCgpa} / 10.00` : "No SGPA entries yet"}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({validSgpas.length} semester{validSgpas.length === 1 ? "" : "s"} entered)
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Official CGPA is calculated from each semester's SGPA entered below.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Admission Year *</label>
                    <input
                      type="number"
                      min="2018"
                      max="2030"
                      disabled={studentProfile?.isProfileLocked}
                      value={formData.admissionYear}
                      onChange={(e) => setFormData({ ...formData, admissionYear: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Expected Graduation Year *</label>
                    <input
                      type="number"
                      min="2020"
                      max="2035"
                      disabled={studentProfile?.isProfileLocked}
                      value={formData.graduationYear}
                      onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Inline Semester SGPA Quick Input Grid */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Semester SGPAs (Sem 1 - 8)</h5>
                      <p className="text-[11px] text-slate-500">Update individual semester SGPAs to recalculate your cumulative College CGPA.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                      const sgpaVal = semMap[sem];
                      const isRecorded = sgpaVal !== undefined && sgpaVal !== null;
                      return (
                        <div key={sem} className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700">Sem {sem}</span>
                            {isRecorded ? (
                              <span className="text-[10px] font-mono font-black text-blue-600">{Number(sgpaVal).toFixed(2)}</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Pending</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSem({ semester: sem, sgpa: isRecorded ? sgpaVal : "" });
                              setSemSgpaInput(isRecorded ? String(sgpaVal) : "");
                            }}
                            className="w-full text-center py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-blue-50 text-blue-600 border border-slate-200 transition"
                          >
                            {isRecorded ? "Edit SGPA" : "+ Enter SGPA"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SECTION: 10TH STANDARD */}
              <div className="rounded-2xl border border-slate-200 p-5 bg-white space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Award className="h-4 w-4 text-emerald-600" />
                  <span>Class 10 (Secondary) Academic Record</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">School Name</label>
                    <input
                      type="text"
                      value={formData.tenthSchool}
                      onChange={(e) => setFormData({ ...formData, tenthSchool: e.target.value })}
                      placeholder="e.g. St. Xavier's High School"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Education Board</label>
                    <select
                      value={formData.tenthBoard}
                      onChange={(e) => setFormData({ ...formData, tenthBoard: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    >
                      {BOARD_OPTIONS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">State / Province</label>
                    <input
                      type="text"
                      value={formData.tenthState}
                      onChange={(e) => setFormData({ ...formData, tenthState: e.target.value })}
                      placeholder="e.g. Karnataka"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Passing Year</label>
                    <input
                      type="number"
                      min="2010"
                      max="2030"
                      value={formData.tenthYear}
                      onChange={(e) => setFormData({ ...formData, tenthYear: e.target.value })}
                      placeholder="e.g. 2021"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Official Percentage (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.tenthPercentage}
                      onChange={(e) => setFormData({ ...formData, tenthPercentage: e.target.value })}
                      placeholder="e.g. 91.5"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: 12TH OR DIPLOMA */}
              <div className="rounded-2xl border border-slate-200 p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Award className="h-4 w-4 text-indigo-600" />
                    <span>Class 12 / Diploma Academic Record</span>
                  </h4>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    {["12th", "Diploma", "Other"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormData({ ...formData, twelfthType: t })}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                          formData.twelfthType === t ? "bg-white text-blue-700 shadow-xs" : "text-slate-600"
                        }`}
                      >
                        {t === "12th" ? "Class 12 / PUC" : t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {formData.twelfthType === "Diploma" ? "Diploma Polytechnic Institution" : "School / Junior College Name"}
                    </label>
                    <input
                      type="text"
                      value={formData.twelfthInst}
                      onChange={(e) => setFormData({ ...formData, twelfthInst: e.target.value })}
                      placeholder="e.g. National College / Polytechnic"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {formData.twelfthType === "Diploma" ? "Technical Board / University" : "Board of Examination"}
                    </label>
                    <input
                      type="text"
                      value={formData.twelfthBoard}
                      onChange={(e) => setFormData({ ...formData, twelfthBoard: e.target.value })}
                      placeholder="e.g. CBSE / State DTE"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  {formData.twelfthType === "Diploma" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Diploma Specialization / Branch</label>
                      <input
                        type="text"
                        value={formData.diplomaBranch}
                        onChange={(e) => setFormData({ ...formData, diplomaBranch: e.target.value })}
                        placeholder="e.g. Diploma in Computer Science"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Passing Year</label>
                    <input
                      type="number"
                      min="2012"
                      max="2032"
                      value={formData.twelfthYear}
                      onChange={(e) => setFormData({ ...formData, twelfthYear: e.target.value })}
                      placeholder="e.g. 2023"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Percentage / Final Score (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.twelfthPercentage}
                      onChange={(e) => setFormData({ ...formData, twelfthPercentage: e.target.value })}
                      placeholder="e.g. 88.0"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: EDUCATION GAPS */}
              <div className="rounded-2xl border border-slate-200 p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span>Education & Year Gaps</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">Distinguished from backlogs or extended semesters.</p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasEducationGap}
                      onChange={(e) => setFormData({ ...formData, hasEducationGap: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                    <span className="ml-2 text-xs font-bold text-slate-700">Has Gap</span>
                  </label>
                </div>

                {formData.hasEducationGap && (
                  <div className="space-y-3 pt-2">
                    {educationGapsList.map((gap, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 p-3 bg-slate-50 flex items-start justify-between gap-3">
                        <div>
                          <span className="text-xs font-bold text-slate-900">{gap.reason}</span>
                          <span className="ml-2 text-[10px] font-bold text-slate-500">
                            ({gap.startYear} - {gap.endYear}, {gap.durationMonths || 12} Mos)
                          </span>
                          {gap.explanation && (
                            <p className="text-xs text-slate-600 mt-1">{gap.explanation}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveGapRecord(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => setIsAddGapOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Gap Period</span>
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION: FAMILY DETAILS (PRIVACY SENSITIVE) */}
              <div className="rounded-2xl border border-slate-200 p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-purple-600" />
                    <span>Parents & Guardian Details</span>
                  </h4>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    Confidential
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Family details are restricted to the placement cell and NEVER shared with recruiting companies by default.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Father's Full Name</label>
                    <input
                      type="text"
                      value={formData.fatherName}
                      onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                      placeholder="Father's name"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Father's Occupation</label>
                    <input
                      type="text"
                      value={formData.fatherOccupation}
                      onChange={(e) => setFormData({ ...formData, fatherOccupation: e.target.value })}
                      placeholder="Occupation"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Father's Phone Number</label>
                    <input
                      type="text"
                      value={formData.fatherPhone}
                      onChange={(e) => setFormData({ ...formData, fatherPhone: e.target.value })}
                      placeholder="Contact number"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Father's Employer / Business</label>
                    <input
                      type="text"
                      value={formData.fatherEmployer}
                      onChange={(e) => setFormData({ ...formData, fatherEmployer: e.target.value })}
                      placeholder="Company or business name"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mother's Full Name</label>
                    <input
                      type="text"
                      value={formData.motherName}
                      onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                      placeholder="Mother's name"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mother's Occupation</label>
                    <input
                      type="text"
                      value={formData.motherOccupation}
                      onChange={(e) => setFormData({ ...formData, motherOccupation: e.target.value })}
                      placeholder="Occupation"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: ADDRESS DETAILS */}
              <div className="rounded-2xl border border-slate-200 p-5 bg-white space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Home className="h-4 w-4 text-teal-600" />
                  <span>Permanent & Current Address</span>
                </h4>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Current Street Address</label>
                      <input
                        type="text"
                        value={formData.currentStreet}
                        onChange={(e) => setFormData({ ...formData, currentStreet: e.target.value })}
                        placeholder="Flat / House / Street"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">City / Town</label>
                      <input
                        type="text"
                        value={formData.currentCity}
                        onChange={(e) => setFormData({ ...formData, currentCity: e.target.value })}
                        placeholder="City"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                      <input
                        type="text"
                        value={formData.currentState}
                        onChange={(e) => setFormData({ ...formData, currentState: e.target.value })}
                        placeholder="State"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">PIN Code</label>
                      <input
                        type="text"
                        value={formData.currentPincode}
                        onChange={(e) => setFormData({ ...formData, currentPincode: e.target.value })}
                        placeholder="6-digit PIN"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.sameAsCurrent}
                        onChange={(e) => setFormData({ ...formData, sameAsCurrent: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-slate-700">Permanent address is same as current address</span>
                    </label>
                  </div>

                  {!formData.sameAsCurrent && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Permanent Street Address</label>
                        <input
                          type="text"
                          value={formData.permanentStreet}
                          onChange={(e) => setFormData({ ...formData, permanentStreet: e.target.value })}
                          placeholder="Permanent address line"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Permanent City</label>
                        <input
                          type="text"
                          value={formData.permanentCity}
                          onChange={(e) => setFormData({ ...formData, permanentCity: e.target.value })}
                          placeholder="City"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Permanent State</label>
                        <input
                          type="text"
                          value={formData.permanentState}
                          onChange={(e) => setFormData({ ...formData, permanentState: e.target.value })}
                          placeholder="State"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions - Single Unified Action */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-black text-white hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 shadow-sm active:scale-95"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{saving ? "Saving & Confirming..." : "Confirm & Save Profile"}</span>
                </button>
              </div>
            </form>
          ) : (
            /* VIEW MODE: TABBED SECTIONS */
            <div className="space-y-6">
              {/* TAB 1: ACADEMIC SUMMARY */}
              {(activeSection === "all" || activeSection === "academic") && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      <span>College & Academic Profile</span>
                    </h4>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                      Official CGPA: {calculatedCgpa || studentProfile?.verifiedCGPA || studentProfile?.cgpa || "—"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                      <span className="text-[11px] font-bold text-slate-400">Official CGPA</span>
                      <p className="text-xl font-black text-blue-600 mt-0.5">
                        {calculatedCgpa || studentProfile?.verifiedCGPA || studentProfile?.cgpa || "Not entered"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                      <span className="text-[11px] font-bold text-slate-400">Active Arrears</span>
                      <p className={`text-xl font-black mt-0.5 ${activeBacklogsCount === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {activeBacklogsCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                      <span className="text-[11px] font-bold text-slate-400">Current Sem</span>
                      <p className="text-xl font-black text-slate-800 mt-0.5">
                        Sem {studentProfile?.semester ?? studentProfile?.currentSemester ?? "N/A"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                      <span className="text-[11px] font-bold text-slate-400">Session Cohort</span>
                      <p className="text-xl font-black text-indigo-600 mt-0.5">
                        {studentProfile?.graduationYear ?? ""}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Technical Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(Array.isArray(studentProfile?.skills) ? studentProfile.skills : ["React", "Python", "SQL"]).map((skill, idx) => (
                        <span key={idx} className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SEMESTER SGPA LEDGER (Semesters 1-8 independent) */}
              {(activeSection === "all" || activeSection === "semesters") && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-blue-600" />
                        <span>Semester-Wise SGPA Records</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Cumulative College CGPA is calculated from entered semester SGPAs: <span className="font-bold text-blue-600">{calculatedCgpa || "—"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                      const sgpaVal = semMap[sem];
                      const isRecorded = sgpaVal !== undefined && sgpaVal !== null;
                      return (
                        <div key={sem} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-800">Semester {sem}</span>
                            {isRecorded ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold">Pending</span>
                            )}
                          </div>
                          <p className={`text-xl font-black font-mono ${isRecorded ? "text-blue-600" : "text-slate-300"}`}>
                            {isRecorded ? Number(sgpaVal).toFixed(2) : "Not entered"}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSem({ semester: sem, sgpa: isRecorded ? sgpaVal : "" });
                              setSemSgpaInput(isRecorded ? String(sgpaVal) : "");
                            }}
                            className="w-full text-center py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-100/50 rounded-lg transition"
                          >
                            {isRecorded ? "Edit SGPA" : "+ Enter SGPA"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: SECONDARY & HIGHER SECONDARY */}
              {(activeSection === "all" || activeSection === "secondary") && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Award className="h-4 w-4 text-emerald-600" />
                      <span>Secondary & Higher Secondary Education (10th & 12th/Diploma)</span>
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 10th Card */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 uppercase">10th Standard (SSC)</span>
                        <span className="text-base font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                          {studentProfile?.tenthDetails?.percentage ?? studentProfile?.tenthPercentage ?? "Not entered"}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-bold">{studentProfile?.tenthDetails?.schoolName || "School Name not entered"}</p>
                      <p className="text-xs text-slate-500">
                        Board: {studentProfile?.tenthDetails?.board || "CBSE"} • Passing Year: {studentProfile?.tenthDetails?.passingYear || "N/A"}
                      </p>
                    </div>

                    {/* 12th/Diploma Card */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 uppercase">
                          {studentProfile?.twelfthOrDiplomaDetails?.qualificationType || "Class 12"} Record
                        </span>
                        <span className="text-base font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                          {studentProfile?.twelfthOrDiplomaDetails?.percentage ?? studentProfile?.twelfthPercentage ?? "Not entered"}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-bold">{studentProfile?.twelfthOrDiplomaDetails?.institutionName || "Institution not entered"}</p>
                      <p className="text-xs text-slate-500">
                        Authority: {studentProfile?.twelfthOrDiplomaDetails?.boardOrUniversity || "CBSE"} • Passing Year: {studentProfile?.twelfthOrDiplomaDetails?.passingYear || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: BACKLOGS */}
              {(activeSection === "all" || activeSection === "backlogs") && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span>Backlog & Arrear History</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">Distinguishes active backlogs from cleared historical attempts.</p>
                    </div>
                    <button
                      onClick={() => setIsAddBacklogOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Log Arrear Record</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                      <span className="text-[11px] font-bold text-rose-700">Active Backlogs</span>
                      <p className="text-xl font-black text-rose-900 mt-0.5">{activeBacklogsCount}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                      <span className="text-[11px] font-bold text-emerald-700">Cleared / Past Backlogs</span>
                      <p className="text-xl font-black text-emerald-900 mt-0.5">{clearedBacklogsCount}</p>
                    </div>
                  </div>

                  {backlogDetails.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500 font-bold">
                      No arrears or backlogs recorded. Clean academic track record!
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                          <tr>
                            <th className="py-2.5 px-3.5">Subject</th>
                            <th className="py-2.5 px-3.5">Semester</th>
                            <th className="py-2.5 px-3.5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                          {backlogDetails.map((b, idx) => (
                            <tr key={idx}>
                              <td className="py-2.5 px-3.5">{b.subjectName || b.subjectCode || "Subject"}</td>
                              <td className="py-2.5 px-3.5">Sem {b.semester}</td>
                              <td className="py-2.5 px-3.5 text-right font-bold">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${b.status === "ACTIVE" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                                  {b.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: EDUCATION GAPS */}
              {(activeSection === "all" || activeSection === "gaps") && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-purple-600" />
                        <span>Education Gap History</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">Declaration of breaks taken during schooling or entrance prep.</p>
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                    >
                      <span>Manage Gap Details</span>
                    </button>
                  </div>

                  {!formData.hasEducationGap || educationGapsList.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500 font-bold">
                      No education gaps declared. Continuous academic track record.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {educationGapsList.map((gap, idx) => (
                        <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{gap.reason}</span>
                            <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              {gap.startYear} - {gap.endYear} ({gap.durationMonths || 12} Months)
                            </span>
                          </div>
                          {gap.explanation && (
                            <p className="text-xs text-slate-600 mt-1">{gap.explanation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: FAMILY & ADDRESS */}
              {(activeSection === "all" || activeSection === "family") && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <UsersIcon className="h-4 w-4 text-indigo-600" />
                        <span>Parents & Guardians</span>
                      </h4>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        Confidential to TPO
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold block">Father's Name</span>
                        <p className="font-bold text-slate-800">{formData.fatherName || "Not entered"}</p>
                        <p className="text-slate-500 text-[11px]">{formData.fatherOccupation} {formData.fatherEmployer && `(${formData.fatherEmployer})`}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">Mother's Name</span>
                        <p className="font-bold text-slate-800">{formData.motherName || "Not entered"}</p>
                        <p className="text-slate-500 text-[11px]">{formData.motherOccupation}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Home className="h-4 w-4 text-slate-600" />
                      <span>Address Details</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold block mb-1">Current Address</span>
                        <p className="font-semibold text-slate-800">{formData.currentStreet || "Not entered"}</p>
                        <p className="text-slate-600 font-bold">{formData.currentCity} {formData.currentState && `, ${formData.currentState}`} {formData.currentPincode && `- ${formData.currentPincode}`}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block mb-1">Permanent Address</span>
                        <p className="font-semibold text-slate-800">
                          {formData.sameAsCurrent ? "(Same as current address)" : (formData.permanentStreet || "Not entered")}
                        </p>
                        {!formData.sameAsCurrent && (
                          <p className="text-slate-600 font-bold">{formData.permanentCity} {formData.permanentState && `, ${formData.permanentState}`}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: RESUME & DOCUMENTS */}
              {(activeSection === "all" || activeSection === "resume") && (
                <div className="space-y-4">
                  {/* Master Placement Resume Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Master Placement Resume</h4>
                          <p className="text-[11px] text-slate-500">Stored securely on Cloudinary CDN for instant company viewing</p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          rawResumeUrl
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {rawResumeUrl ? "Attached" : "Missing"}
                      </span>
                    </div>

                    {rawResumeUrl ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-medium text-slate-700 truncate">
                            Active Resume Document (PDF / DOC)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={resumeViewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold transition"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>View Resume</span>
                          </a>
                          <button
                            type="button"
                            onClick={handleDeleteResume}
                            disabled={uploadingResume}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-800">
                        No resume uploaded yet. Upload a PDF or Word document so companies can review your profile during drives.
                      </div>
                    )}

                    <form onSubmit={handleUploadResume} className="flex flex-wrap items-center gap-3 pt-2">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setResumeFile(e.target.files[0])}
                        className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <button
                        type="submit"
                        disabled={uploadingResume || !resumeFile}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploadingResume ? "Uploading to CDN..." : rawResumeUrl ? "Replace Resume" : "Upload Resume"}</span>
                      </button>
                    </form>
                  </div>

                  {/* Profile Photograph / Avatar Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                          <Camera className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Profile Photograph (Avatar)</h4>
                          <p className="text-[11px] text-slate-500">Professional portrait photo managed on Cloudinary CDN</p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          user?.avatar?.url
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {user?.avatar?.url ? "Photo Set" : "Default Avatar"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="h-14 w-14 rounded-2xl overflow-hidden border-2 border-white shadow-xs shrink-0 bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl">
                        {user?.avatar?.url ? (
                          <img
                            src={user.avatar.url}
                            alt={user?.fullName || "Candidate"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{(user?.fullName || "S").charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">{user?.fullName || "Student Profile"}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {user?.avatar?.url ? "Hosted on Cloudinary Image Cloud" : "No custom photograph uploaded"}
                        </p>
                      </div>

                      {user?.avatar?.url && (
                        <button
                          type="button"
                          onClick={handleDeleteAvatar}
                          disabled={uploadingAvatar}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleUploadAvatar} className="flex flex-wrap items-center gap-3 pt-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setAvatarFile(e.target.files[0])}
                        className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                      />
                      <button
                        type="submit"
                        disabled={uploadingAvatar || !avatarFile}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 transition disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploadingAvatar ? "Uploading Photo..." : user?.avatar?.url ? "Update Photo" : "Upload Photo"}</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: SINGLE SEMESTER SGPA EDIT */}
      {editingSem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-black text-slate-900">Record Semester {editingSem.semester} SGPA</h4>
            <form onSubmit={handleSaveSingleSemester} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Semester SGPA (0.00 - 10.00)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  autoFocus
                  value={semSgpaInput}
                  onChange={(e) => setSemSgpaInput(e.target.value)}
                  placeholder="e.g. 8.45"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSem(null)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Save SGPA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD BACKLOG RECORD */}
      {isAddBacklogOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-black text-slate-900">Record Arrear / Backlog</h4>
            <form onSubmit={handleAddBacklog} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject Name *</label>
                <input
                  type="text"
                  required
                  value={backlogSubName}
                  onChange={(e) => setBacklogSubName(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject Code</label>
                <input
                  type="text"
                  value={backlogSubCode}
                  onChange={(e) => setBacklogSubCode(e.target.value)}
                  placeholder="e.g. CS302"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={backlogSem}
                    onChange={(e) => setBacklogSem(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={backlogStatus}
                    onChange={(e) => setBacklogStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="CLEARED">CLEARED</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBacklogOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD EDUCATION GAP */}
      {isAddGapOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-black text-slate-900">Add Education Gap Record</h4>
            <form onSubmit={handleAddGapRecord} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Gap *</label>
                <select
                  value={gapReason}
                  onChange={(e) => setGapReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                >
                  {GAP_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Year</label>
                  <input
                    type="number"
                    min="2015"
                    max="2030"
                    value={gapStartYear}
                    onChange={(e) => setGapStartYear(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Year</label>
                  <input
                    type="number"
                    min="2016"
                    max="2031"
                    value={gapEndYear}
                    onChange={(e) => setGapEndYear(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Explanation (Optional)</label>
                <textarea
                  rows="2"
                  value={gapExplanation}
                  onChange={(e) => setGapExplanation(e.target.value)}
                  placeholder="e.g. Prepared for JEE and State CET exams"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddGapOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Confirm Gap Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Institutional Profile Lock Confirmation Modal */}
      <ProfileLockConfirmationModal
        isOpen={isLockModalOpen}
        onClose={() => setIsLockModalOpen(false)}
        onConfirmLock={handleConfirmLock}
        formData={{ ...formData, cgpa: calculatedCgpa || formData.cgpa }}
        studentProfile={studentProfile}
        user={user}
        saving={saving}
      />

      {/* Student TPO Modification Permission Modal */}
      <ProfileModificationModal
        isOpen={isModModalOpen}
        onClose={() => setIsModModalOpen(false)}
        studentProfile={studentProfile}
        user={user}
        onRequestSubmitted={(updatedProfile) => {
          if (onProfileUpdated && updatedProfile) {
            onProfileUpdated(updatedProfile);
          }
        }}
      />
    </div>
  );
}
