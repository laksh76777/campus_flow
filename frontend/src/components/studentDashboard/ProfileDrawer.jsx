import { useState, useEffect, useRef } from "react";
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
  Calculator,
  Phone,
  Mail
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
  deleteBacklogRecord,
  lockProfile,
  validateCertificate,
  addCertificate,
  deleteCertificate
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

export const cleanCertificateTitle = (title, issuerFallback = "") => {
  if (!title || typeof title !== "string") {
    return issuerFallback ? `${issuerFallback} Certificate` : "Untitled Certificate";
  }
  const trimmed = title.trim();
  if (
    !trimmed ||
    /^https?:\/\//i.test(trimmed) ||
    trimmed.includes("://") ||
    trimmed.startsWith("www.") ||
    /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\//i.test(trimmed)
  ) {
    return issuerFallback ? `${issuerFallback} Certificate` : "Untitled Certificate";
  }
  return trimmed;
};

export const getEffectiveCredentialUrl = (c) => {
  if (!c) return "";
  if (c.officialVerificationUrl && /^https?:\/\//i.test(c.officialVerificationUrl.trim())) {
    return c.officialVerificationUrl.trim();
  }

  const id = (c.credentialId || "").trim();
  const issuer = (c.issuer || "").toLowerCase();

  if (id) {
    if (issuer.includes("coursera")) return `https://coursera.org/verify/${id}`;
    if (issuer.includes("credly")) return `https://www.credly.com/badges/${id}`;
    if (issuer.includes("hackerrank")) return `https://www.hackerrank.com/certificates/${id}`;
    if (issuer.includes("freecodecamp")) return `https://www.freecodecamp.org/certification/${id}`;
    if (issuer.includes("udemy")) return `https://www.udemy.com/certificate/${id}`;
    if (issuer.includes("accredible")) return `https://credential.net/${id}`;
  }

  return c.certificateUrl || c.documentUrl || c.url || "";
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

export default function ProfileDrawer({
  isOpen,
  onClose,
  user,
  studentProfile,
  onProfileUpdated,
  initialSection = "all",
  initialEditing = false
}) {
  const isProfileLocked = Boolean(
    studentProfile?.isProfileLocked && studentProfile?.verificationStatus !== "REVERIFICATION_REQUESTED"
  );

  const [activeSection, setActiveSection] = useState(initialSection || "all");
  const [isEditing, setIsEditing] = useState(Boolean(initialEditing && !isProfileLocked));
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
      if (isProfileLocked) {
        setIsEditing(false);
      } else if (initialEditing !== undefined) {
        setIsEditing(Boolean(initialEditing));
      }
    }
  }, [isOpen, initialSection, initialEditing, isProfileLocked]);

  // Modal for adding a certificate
  const [isAddCertOpen, setIsAddCertOpen] = useState(false);
  const [certTitle, setCertTitle] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certIssueDate, setCertIssueDate] = useState("");
  const [certUrl, setCertUrl] = useState("");
  const [certRecipientName, setCertRecipientName] = useState("");
  const [certCredentialId, setCertCredentialId] = useState("");
  const [certCategory, setCertCategory] = useState("Course Completion");
  const [certExpirationDate, setCertExpirationDate] = useState("");
  const [certFile, setCertFile] = useState(null);
  const [certValidating, setCertValidating] = useState(false);
  const [certValidationStage, setCertValidationStage] = useState("");
  const [certValidationResult, setCertValidationResult] = useState(null);
  const [certSourceType, setCertSourceType] = useState("url"); // 'url' or 'file'
  const [autoFilledFields, setAutoFilledFields] = useState(new Set());
  const urlDebounceTimerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    getPublicDepartments()
      .then((response) => {
        if (!Array.isArray(response?.data)) {
          throw new Error("The approved academic program response is not a list");
        }
        setPrograms(response.data);
      })
      .catch((error) => {
        console.error("Failed to load approved academic programs:", error);
        toast.error("Could not load approved academic programs");
        setPrograms([]);
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
    skills: "",

    // Class 10 Details
    tenthSchool: "",
    tenthBoard: "",
    tenthState: "",
    tenthYear: "",
    tenthPercentage: "",
    tenthMarks: "",
    tenthMaxMarks: "",
    tenthMarksheetUrl: "",

    // Class 12 / Diploma Details
    twelfthType: "12th", // "12th", "Diploma", "Other"
    twelfthInst: "",
    twelfthBoard: "",
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
          : "",

        // Class 10
        tenthSchool: studentProfile.tenthDetails?.schoolName || "",
        tenthBoard: studentProfile.tenthDetails?.board || "",
        tenthState: studentProfile.tenthDetails?.state || "",
        tenthYear: studentProfile.tenthDetails?.passingYear || "",
        tenthPercentage: studentProfile.tenthDetails?.percentage ?? studentProfile.tenthPercentage ?? "",
        tenthMarks: studentProfile.tenthDetails?.marksObtained ?? "",
        tenthMaxMarks: studentProfile.tenthDetails?.maxMarks ?? "",
        tenthMarksheetUrl: studentProfile.tenthDetails?.marksheetUrl || "",

        // Class 12 / Diploma
        twelfthType: studentProfile.twelfthOrDiplomaDetails?.qualificationType || "12th",
        twelfthInst: studentProfile.twelfthOrDiplomaDetails?.institutionName || "",
        twelfthBoard: studentProfile.twelfthOrDiplomaDetails?.boardOrUniversity || "",
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
        dob: toDateInputValue(studentProfile.dob),
        personalEmail: studentProfile.personalEmail || user?.email || "",
        collegeEmail: studentProfile.collegeEmail || "",
        alternatePhone: studentProfile.alternatePhone || studentProfile.phone || user?.phone || "",

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
        Array.isArray(studentProfile.certificates)
          ? studentProfile.certificates.filter((certificate) => certificate && typeof certificate === "object")
          : []
      );
    }
  }, [studentProfile, user]);

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

  const semesterResults = Array.isArray(studentProfile?.semesterResults)
    ? studentProfile.semesterResults.filter((result) => result && typeof result === "object")
    : [];
  const backlogDetails = Array.isArray(studentProfile?.backlogDetails)
    ? studentProfile.backlogDetails.filter((backlog) => backlog && typeof backlog === "object")
    : [];
  const activeBacklogsCount = studentProfile?.activeBacklogs ?? studentProfile?.backlogs ?? 0;
  const clearedBacklogsCount = studentProfile?.clearedBacklogsCount ?? 0;
  const educationGapsList = formData.educationGaps || [];

  // Helper map for semesters 1 to 8
  const semMap = {};
  semesterResults.forEach((s) => {
    semMap[s.semester] = s.sgpa;
  });

  // College CGPA stored independently and editable by student
  const collegeCgpa = formData.cgpa !== ""
    ? formData.cgpa
    : studentProfile?.verifiedCGPA ?? studentProfile?.cgpa ?? "";

  const resetCertForm = () => {
    if (urlDebounceTimerRef.current) {
      clearTimeout(urlDebounceTimerRef.current);
      urlDebounceTimerRef.current = null;
    }
    setCertTitle("");
    setCertIssuer("");
    setCertIssueDate("");
    setCertUrl("");
    setCertRecipientName("");
    setCertCredentialId("");
    setCertCategory("Course Completion");
    setCertExpirationDate("");
    setCertFile(null);
    setCertValidating(false);
    setCertValidationStage("");
    setCertValidationResult(null);
    setAutoFilledFields(new Set());
  };

  const triggerAutoValidate = async ({ urlToUse, fileToUse, isAuto = false } = {}) => {
    const targetUrl = urlToUse !== undefined ? urlToUse : (certSourceType === "url" ? certUrl.trim() : "");
    const targetFile = fileToUse !== undefined ? fileToUse : (certSourceType === "file" ? certFile : null);

    if (!targetUrl && !targetFile) {
      if (!isAuto) {
        toast.error(certSourceType === "url" ? "Please enter a certificate URL" : "Please select a PDF or image file");
      }
      return;
    }

    setCertValidating(true);
    setCertValidationStage("Reading certificate details...");

    const stageTimer1 = setTimeout(() => {
      setCertValidationStage("Auto-extracting metadata with Groq AI...");
    }, 600);

    const stageTimer2 = setTimeout(() => {
      setCertValidationStage("Verifying issuer & matching recipient identity...");
    }, 1500);

    try {
      const response = await validateCertificate({
        certificateUrl: targetUrl || "",
        file: targetFile || null
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);

      const data = response?.data;
      if (!data) throw new Error("Validation returned empty data");

      setCertValidationResult(data);

      const filled = new Set();
      if (data.title) {
        setCertTitle(data.title);
        filled.add("title");
      }
      if (data.issuer) {
        setCertIssuer(data.issuer);
        filled.add("issuer");
      }
      if (data.recipientName) {
        setCertRecipientName(data.recipientName);
        filled.add("recipientName");
      }
      if (data.issueDate) {
        setCertIssueDate(data.issueDate);
        filled.add("issueDate");
      }
      if (data.expirationDate) {
        setCertExpirationDate(data.expirationDate);
        filled.add("expirationDate");
      }
      if (data.credentialId) {
        setCertCredentialId(data.credentialId);
        filled.add("credentialId");
      }
      if (data.category) {
        setCertCategory(data.category);
        filled.add("category");
      }

      setAutoFilledFields(filled);

      // Details extracted: allow student to review/edit before saving
      if (data.ownershipStatus === "MISMATCH" || data.identityMatch === "Mismatch") {
        toast.error("⚠️ Recipient mismatch: Name on certificate does not match your student profile name.");
      } else if (data.duplicateStatus === "CROSS_STUDENT_DUPLICATE") {
        toast.error("⚠️ Duplicate detected: This credential appears to be associated with another student.");
      } else {
        toast.success("✨ Details extracted! Please review below and click 'Save Certificate'.");
      }
    } catch (err) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      const msg = err.response?.data?.message || err.message || "Failed to analyze certificate";
      if (!isAuto) {
        toast.error(msg);
      } else {
        console.warn("[Auto-Fill Note]", msg);
      }
    } finally {
      setCertValidating(false);
      setCertValidationStage("");
    }
  };

  const handleValidateCertificate = async () => {
    await triggerAutoValidate({ isAuto: false });
  };

  const handleCertUrlChange = (val) => {
    setCertUrl(val);

    if (urlDebounceTimerRef.current) {
      clearTimeout(urlDebounceTimerRef.current);
      urlDebounceTimerRef.current = null;
    }

    const trimmed = (val || "").trim();
    // Automatically trigger analysis if valid URL format
    if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed)) {
      urlDebounceTimerRef.current = setTimeout(() => {
        triggerAutoValidate({ urlToUse: trimmed, fileToUse: null, isAuto: true });
      }, 700);
    }
  };

  const handleCertUrlPaste = (e) => {
    const pasted = e.clipboardData.getData("text")?.trim();
    if (pasted && /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(pasted)) {
      setCertUrl(pasted);
      if (urlDebounceTimerRef.current) clearTimeout(urlDebounceTimerRef.current);
      urlDebounceTimerRef.current = setTimeout(() => {
        triggerAutoValidate({ urlToUse: pasted, fileToUse: null, isAuto: true });
      }, 150);
    }
  };

  const handleCertFileChange = (file) => {
    setCertFile(file);
    if (file) {
      triggerAutoValidate({ urlToUse: "", fileToUse: file, isAuto: true });
    }
  };

  const handleAddCertificate = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!certValidationResult) {
      toast.error("Please auto-fill / validate the certificate first before saving.");
      return;
    }

    const isMismatch = certValidationResult?.ownershipStatus === "MISMATCH" || certValidationResult?.identityMatch === "Mismatch";
    if (isMismatch) {
      toast.error("Cannot save certificate: Recipient name does not match your registered student name.");
      return;
    }

    if (certValidationResult?.duplicateStatus === "CROSS_STUDENT_DUPLICATE") {
      toast.error("Cannot save certificate: This credential appears to be associated with another student submission.");
      return;
    }

    if (!certTitle.trim()) {
      toast.error("Please enter credential or certificate title");
      return;
    }

    const targetUrl = certValidationResult?.officialVerificationUrl ||
                      certValidationResult?.certificateUrl ||
                      (certUrl || "").trim() ||
                      certValidationResult?.documentUrl || "";

    const newCert = {
      title: cleanCertificateTitle(certTitle, certIssuer),
      issuer: certIssuer.trim() || "Online Provider",
      recipientName: certRecipientName.trim() || certValidationResult?.recipientName || user?.fullName || "",
      issueDate: certIssueDate || certValidationResult?.issueDate || undefined,
      expirationDate: certExpirationDate || certValidationResult?.expirationDate || undefined,
      certificateUrl: targetUrl || undefined,
      url: targetUrl || undefined,
      credentialId: certCredentialId.trim() || certValidationResult?.credentialId || undefined,
      category: certCategory || "Course Completion",
      verificationStatus: "Verified",
      verificationMethod: certValidationResult?.verificationMethod || "AUTO_VALIDATED",
      identityMatch: certValidationResult?.identityMatch || "Match",
      authenticityStatus: "AUTHENTIC",
      ownershipStatus: certValidationResult?.ownershipStatus || "MATCH",
      duplicateStatus: "NONE",
      duplicateDetails: "",
      fileHash: certValidationResult?.fileHash || "",
      officialVerificationUrl: certValidationResult?.officialVerificationUrl || (targetUrl.startsWith("http") ? targetUrl : undefined),
      documentUrl: certValidationResult?.documentUrl || (targetUrl.startsWith("http") ? targetUrl : undefined),
      documentPublicId: certValidationResult?.documentPublicId || undefined,
      aiAnalysis: certValidationResult?.aiAnalysis || undefined,
      evidence: certValidationResult?.evidence || undefined
    };

    if (studentProfile?._id) {
      try {
        const res = await addCertificate(newCert);
        if (res?.data && Array.isArray(res.data)) {
          setCertificates(res.data);
        } else {
          setCertificates((prev) => [...prev, newCert]);
        }
      } catch (err) {
        console.warn("Direct save fallback:", err.message);
        setCertificates((prev) => [...prev, newCert]);
      }
    } else {
      setCertificates((prev) => [...prev, newCert]);
    }

    resetCertForm();
    setIsAddCertOpen(false);
    toast.success("Certificate added to profile!");
    if (typeof onProfileUpdated === "function") {
      onProfileUpdated();
    }
  };

  const handleDeleteCertificate = async (idx) => {
    const certToDelete = certificates[idx];
    if (certToDelete?._id) {
      try {
        await deleteCertificate(certToDelete._id);
      } catch (err) {
        console.warn("Server delete warning:", err.message);
      }
    }
    setCertificates((prev) => prev.filter((_, i) => i !== idx));
    toast.success("Certificate removed from list");
    if (typeof onProfileUpdated === "function") {
      onProfileUpdated();
    }
  };

  const renderOwnershipBadge = (status) => {
    switch (status) {
      case "MATCH":
      case "Match":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
            <span>ID Match</span>
          </span>
        );
      case "POSSIBLE_MATCH":
      case "Possible Match":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-2.5 w-2.5 text-amber-600" />
            <span>Name Review</span>
          </span>
        );
      case "MISMATCH":
      case "Mismatch":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="h-2.5 w-2.5 text-rose-600" />
            <span>Name Mismatch</span>
          </span>
        );
      default:
        return null;
    }
  };

  const renderVerificationBadge = (status) => {
    switch (status) {
      case "Verified":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>Verified</span>
          </span>
        );
      case "Needs Review":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3 text-amber-600" />
            <span>Needs Review</span>
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3 w-3 text-rose-600" />
            <span>Rejected</span>
          </span>
        );
      case "Unable to Verify":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
            <ShieldCheck className="h-3 w-3 text-slate-400" />
            <span>{status || "Pending"}</span>
          </span>
        );
    }
  };

  const buildProfilePayload = () => {
    const selectedProgram = programs.find((program) => program.code === formData.programCode);
    return {
      programCode: selectedProgram?.code || formData.programCode,
      programLevel: selectedProgram?.programLevel || formData.programLevel,
      degreeType: selectedProgram?.degreeType || "B.E.",
      course: selectedProgram?.degreeType || "B.E.",
      branch: selectedProgram?.name || formData.programCode,
      department: selectedProgram?.name || formData.programCode,
      semester: Number(formData.semester),
      currentSemester: Number(formData.semester),
      graduationYear: Number(formData.graduationYear),
      admissionYear: Number(formData.admissionYear),
      cgpa: formData.cgpa === "" ? null : Number(formData.cgpa),
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

      // Personal & Contact
      gender: formData.gender,
      dob: formData.dob || null,
      personalEmail: formData.personalEmail.trim(),
      collegeEmail: formData.collegeEmail.trim(),
      phone: formData.alternatePhone.trim(),
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
  };

  const handleSaveProfile = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const selectedProgram = programs.find((program) => program.code === formData.programCode);
    if (!selectedProgram || selectedProgram.programLevel !== formData.programLevel) {
      toast.error("Select a valid approved academic program before submitting");
      return;
    }
    // Per institutional workflow: Open verification modal with complete dossier & declaration
    setIsLockModalOpen(true);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = buildProfilePayload();
      const res = await updateStudentProfile(payload);
      toast.success("Profile draft saved successfully!");
      setIsEditing(false);
      if (onProfileUpdated && res?.data) {
        onProfileUpdated(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to save profile draft";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmLock = async () => {
    setSaving(true);
    try {
      const payload = buildProfilePayload();
      const saveRes = await updateStudentProfile(payload);
      const lockRes = await lockProfile(studentProfile?.user?._id || user?._id);
      toast.success("Profile verified, saved & permanently locked for placement drives!");
      setIsLockModalOpen(false);
      setIsEditing(false);
      if (onProfileUpdated && (lockRes?.data || saveRes?.data)) {
        onProfileUpdated(lockRes?.data || saveRes?.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to confirm and lock profile");
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

  const handleDeleteBacklog = async (backlogId) => {
    if (!window.confirm("Are you sure you want to delete this backlog record?")) return;
    try {
      const res = await deleteBacklogRecord(backlogId);
      toast.success("Backlog record deleted successfully!");
      if (res?.data) {
        if (onProfileUpdated) {
          onProfileUpdated({
            backlogDetails: res.data.backlogDetails,
            activeBacklogs: res.data.activeBacklogs,
            clearedBacklogsCount: res.data.clearedBacklogsCount,
            historicalBacklogs: res.data.historicalBacklogs,
            backlogs: res.data.backlogs
          });
        }
      } else {
        const remaining = (studentProfile?.backlogDetails || []).filter(
          (backlog) => backlog._id !== backlogId
        );
        if (onProfileUpdated) {
          onProfileUpdated({ backlogDetails: remaining });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete backlog record");
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl slide-in-from-right overflow-hidden animate-in duration-300">
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
          <button aria-label="Close profile"
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
            { id: "certificates", label: `Certificates (${certificates.length})`, icon: Award },
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
                  <span className="font-mono text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
                    <Phone className="h-3 w-3 text-blue-600" />
                    <span>{formData.alternatePhone || studentProfile?.phone || user?.phone || "No phone entered"}</span>
                  </span>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {programs.find((program) => program.code === (studentProfile?.programCode || formData.programCode))?.name
                      || studentProfile?.branch || studentProfile?.department || "Program requires review"}
                  </span>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    Grad: {studentProfile?.graduationYear ?? "Not assigned"}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    CGPA: {collegeCgpa || "Not entered"}
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

          {verification === "REVERIFICATION_REQUESTED" && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-cyan-200 bg-cyan-50/90 p-4 text-xs text-cyan-950 font-bold shadow-2xs">
              <Unlock className="h-4 w-4 text-cyan-700 shrink-0" />
              <span>TPO Administrator has requested a profile re-check. All academic marks, backlogs, and contact fields are unlocked and directly editable!</span>
            </div>
          )}

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

              {/* SECTION: CANDIDATE IDENTITY & CONTACT */}
              <div className="rounded-2xl border border-slate-200 p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-blue-600" />
                    <span>Candidate Identity & Contact Information</span>
                  </h4>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                    Required for Recruitment Drives
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Candidate Full Name</label>
                    <input
                      type="text"
                      disabled
                      value={displayName}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">University Seat Number (USN)</label>
                    <input
                      type="text"
                      disabled
                      value={enrollment}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-600 bg-slate-100 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Primary Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={displayEmail}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Phone className="h-3 w-3 text-blue-600" />
                      <span>Mobile / Phone Number *</span>
                      {isProfileLocked && <Lock className="h-3 w-3 text-amber-600 ml-1" />}
                    </label>
                    <input
                      type="tel"
                      disabled={isProfileLocked}
                      value={formData.alternatePhone}
                      onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      className="w-full rounded-xl border-2 border-blue-200 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-600 bg-blue-50/20 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Primary phone number for placement screening & alerts</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <span>Alternate / Personal Email</span>
                      {isProfileLocked && <Lock className="h-3 w-3 text-amber-600 ml-1" />}
                    </label>
                    <input
                      type="email"
                      disabled={isProfileLocked}
                      value={formData.personalEmail}
                      onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                      placeholder="e.g. personal@gmail.com"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <span>Gender</span>
                      {isProfileLocked && <Lock className="h-3 w-3 text-amber-600 ml-1" />}
                    </label>
                    <select
                      disabled={isProfileLocked}
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION: ACADEMICS & DEGREE */}
              <div className="rounded-2xl border border-slate-200 p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span>College, Degree & Cumulative CGPA</span>
                  </h4>
                  {isProfileLocked && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      <Lock className="h-3 w-3" /> Record Locked
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Program Level *</label>
                    <select
                      value={formData.programLevel}
                      disabled={isProfileLocked}
                      onChange={(e) => setFormData({ ...formData, programLevel: e.target.value, programCode: "" })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
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
                      disabled={isProfileLocked || !formData.programLevel}
                      onChange={(e) => setFormData({ ...formData, programCode: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
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
                      disabled={isProfileLocked}
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>College CGPA</span>
                      <span className="text-[10px] text-emerald-600 font-extrabold uppercase">Editable</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      value={formData.cgpa}
                      onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
                      placeholder="e.g. 8.51"
                      className="w-full rounded-xl border-2 border-emerald-300 px-3 py-2 text-xs font-extrabold text-slate-900 outline-none focus:border-emerald-600 bg-emerald-50/20"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Stored independently from semester SGPAs</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Admission Year *</label>
                    <input
                      type="number"
                      min="2018"
                      max="2030"
                      disabled={isProfileLocked}
                      value={formData.admissionYear}
                      onChange={(e) => setFormData({ ...formData, admissionYear: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Expected Graduation Year *</label>
                    <input
                      type="number"
                      min="2020"
                      max="2035"
                      disabled={isProfileLocked}
                      value={formData.graduationYear}
                      onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>

                  {/* Skills input restored */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                      <span>Technical Skills & Competencies</span>
                    </label>
                    <input
                      type="text"
                      value={formData.skills}
                      onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                      placeholder="e.g. React, Node.js, Python, SQL, C++, Java"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Separate skills with commas (e.g. Python, SQL, Docker). Listed on student dossier and placement resume matchers.</span>
                  </div>
                </div>

                {/* Inline Semester SGPA Quick Input Grid */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Semester SGPAs (Sem 1 - 8)</h5>
                      <p className="text-[11px] text-slate-500">Semester-wise SGPA records (Stored separately from College CGPA).</p>
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
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>School Name</span>
                      {isProfileLocked && <Lock className="h-3 w-3 text-amber-600" />}
                    </label>
                    <input
                      type="text"
                      disabled={isProfileLocked}
                      value={formData.tenthSchool}
                      onChange={(e) => setFormData({ ...formData, tenthSchool: e.target.value })}
                      placeholder="e.g. St. Xavier's High School"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Education Board</label>
                    <select
                      disabled={isProfileLocked}
                      value={formData.tenthBoard}
                      onChange={(e) => setFormData({ ...formData, tenthBoard: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    >
                      <option value="">Select board</option>
                      {BOARD_OPTIONS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">State / Province</label>
                    <input
                      type="text"
                      disabled={isProfileLocked}
                      value={formData.tenthState}
                      onChange={(e) => setFormData({ ...formData, tenthState: e.target.value })}
                      placeholder="e.g. Karnataka"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Passing Year</label>
                    <input
                      type="number"
                      min="2010"
                      max="2030"
                      disabled={isProfileLocked}
                      value={formData.tenthYear}
                      onChange={(e) => setFormData({ ...formData, tenthYear: e.target.value })}
                      placeholder="e.g. 2021"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Official Percentage (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      disabled={isProfileLocked}
                      value={formData.tenthPercentage}
                      onChange={(e) => setFormData({ ...formData, tenthPercentage: e.target.value })}
                      placeholder="e.g. 91.5"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
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
                        disabled={isProfileLocked}
                        onClick={() => setFormData({ ...formData, twelfthType: t })}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition disabled:cursor-not-allowed ${
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
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>{formData.twelfthType === "Diploma" ? "Diploma Polytechnic Institution" : "School / Junior College Name"}</span>
                      {isProfileLocked && <Lock className="h-3 w-3 text-amber-600" />}
                    </label>
                    <input
                      type="text"
                      disabled={isProfileLocked}
                      value={formData.twelfthInst}
                      onChange={(e) => setFormData({ ...formData, twelfthInst: e.target.value })}
                      placeholder="e.g. National College / Polytechnic"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {formData.twelfthType === "Diploma" ? "Technical Board / University" : "Board of Examination"}
                    </label>
                    <input
                      type="text"
                      disabled={isProfileLocked}
                      value={formData.twelfthBoard}
                      onChange={(e) => setFormData({ ...formData, twelfthBoard: e.target.value })}
                      placeholder="e.g. CBSE / State DTE"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>

                  {formData.twelfthType === "Diploma" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Diploma Specialization / Branch</label>
                      <input
                        type="text"
                        disabled={isProfileLocked}
                        value={formData.diplomaBranch}
                        onChange={(e) => setFormData({ ...formData, diplomaBranch: e.target.value })}
                        placeholder="e.g. Diploma in Computer Science"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Passing Year</label>
                    <input
                      type="number"
                      min="2012"
                      max="2032"
                      disabled={isProfileLocked}
                      value={formData.twelfthYear}
                      onChange={(e) => setFormData({ ...formData, twelfthYear: e.target.value })}
                      placeholder="e.g. 2023"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Percentage / Final Score (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      disabled={isProfileLocked}
                      value={formData.twelfthPercentage}
                      onChange={(e) => setFormData({ ...formData, twelfthPercentage: e.target.value })}
                      placeholder="e.g. 88.0"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
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
                      disabled={studentProfile?.isProfileLocked}
                      checked={formData.hasEducationGap}
                      onChange={(e) => setFormData({ ...formData, hasEducationGap: e.target.checked })}
                      className="sr-only peer disabled:cursor-not-allowed"
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
                        {!studentProfile?.isProfileLocked && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGapRecord(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    {!studentProfile?.isProfileLocked && (
                      <button
                        type="button"
                        onClick={() => setIsAddGapOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Gap Period</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION: CERTIFICATES & CREDENTIALS */}
              <div className="rounded-2xl border border-slate-200 p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Award className="h-4 w-4 text-purple-600" />
                      <span>Certificates & External Credentials ({certificates.length})</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">Professional credentials and certifications to highlight to recruiters.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddCertOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 text-xs font-bold hover:bg-purple-100 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Add Certificate</span>
                  </button>
                </div>

                {certificates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 font-medium">
                    No external credentials attached. Click "+ Add Certificate" to attach online certifications.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {certificates.map((c, i) => {
                      const credUrl = getEffectiveCredentialUrl(c);
                      return (
                        <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 text-xs">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <strong className="text-slate-800 font-bold block truncate">{cleanCertificateTitle(c.title, c.issuer)}</strong>
                                {renderVerificationBadge(c.verificationStatus)}
                                {renderOwnershipBadge(c.ownershipStatus)}
                              </div>
                              <span className="text-slate-500 text-[11px] block mt-0.5">
                                {c.issuer || "Online Credential"} {c.issueDate && `• ${new Date(c.issueDate).toLocaleDateString()}`}
                                {c.category && ` • ${c.category}`}
                              </span>
                              {(c.recipientName || c.extractedRecipientName) && (
                                <span className="text-slate-600 text-[11px] block mt-0.5">
                                  Recipient: <strong className="text-slate-800">{c.recipientName || c.extractedRecipientName}</strong>
                                </span>
                              )}
                              {c.credentialId && (
                                <span className="text-slate-400 font-mono text-[10px] block mt-0.5">
                                  ID: {c.credentialId}
                                </span>
                              )}
                              {credUrl && (
                                <a
                                  href={credUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-600 hover:text-purple-800 hover:underline inline-flex items-center gap-1 text-[11px] mt-1 font-bold"
                                >
                                  <span>[View Credential]</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteCertificate(i)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition shrink-0 cursor-pointer"
                              title="Remove certificate"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {c.duplicateStatus === "CROSS_STUDENT_DUPLICATE" && (
                            <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>This credential appears to be associated with another submission. Additional ownership verification is required.</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Father's Full Name</span>
                      {isProfileLocked && <Lock className="h-3 w-3 text-amber-600" />}
                    </label>
                    <input
                      type="text"
                      disabled={isProfileLocked}
                      value={formData.fatherName}
                      onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                      placeholder="Father's name"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Father's Occupation</label>
                    <input
                      type="text"
                      disabled={isProfileLocked}
                      value={formData.fatherOccupation}
                      onChange={(e) => setFormData({ ...formData, fatherOccupation: e.target.value })}
                      placeholder="Occupation"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Father's Phone Number</span>
                      {isProfileLocked && <Lock className="h-3 w-3 text-amber-600" />}
                    </label>
                    <input
                      type="text"
                      disabled={isProfileLocked}
                      value={formData.fatherPhone}
                      onChange={(e) => setFormData({ ...formData, fatherPhone: e.target.value })}
                      placeholder="Contact number"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Father's Employer / Business</label>
                    <input
                      type="text"
                      disabled={isProfileLocked}
                      value={formData.fatherEmployer}
                      onChange={(e) => setFormData({ ...formData, fatherEmployer: e.target.value })}
                      placeholder="Company or business name"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Mother's Full Name</span>
                      {isProfileLocked && <Lock className="h-3 w-3 text-amber-600" />}
                    </label>
                    <input
                      type="text"
                      disabled={isProfileLocked}
                      value={formData.motherName}
                      onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                      placeholder="Mother's name"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mother's Occupation</label>
                    <input
                      type="text"
                      disabled={isProfileLocked}
                      value={formData.motherOccupation}
                      onChange={(e) => setFormData({ ...formData, motherOccupation: e.target.value })}
                      placeholder="Occupation"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: ADDRESS DETAILS */}
              <div className="rounded-2xl border border-slate-200 p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Home className="h-4 w-4 text-teal-600" />
                    <span>Permanent & Current Address</span>
                  </h4>
                  {isProfileLocked && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      <Lock className="h-3 w-3" /> Record Locked
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Current Street Address</span>
                        {isProfileLocked && <Lock className="h-3 w-3 text-amber-600" />}
                      </label>
                      <input
                        type="text"
                        disabled={isProfileLocked}
                        value={formData.currentStreet}
                        onChange={(e) => setFormData({ ...formData, currentStreet: e.target.value })}
                        placeholder="Flat / House / Street"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">City / Town</label>
                      <input
                        type="text"
                        disabled={isProfileLocked}
                        value={formData.currentCity}
                        onChange={(e) => setFormData({ ...formData, currentCity: e.target.value })}
                        placeholder="City"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                      <input
                        type="text"
                        disabled={isProfileLocked}
                        value={formData.currentState}
                        onChange={(e) => setFormData({ ...formData, currentState: e.target.value })}
                        placeholder="State"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">PIN Code</label>
                      <input
                        type="text"
                        disabled={isProfileLocked}
                        value={formData.currentPincode}
                        onChange={(e) => setFormData({ ...formData, currentPincode: e.target.value })}
                        placeholder="6-digit PIN"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={isProfileLocked}
                        checked={formData.sameAsCurrent}
                        onChange={(e) => setFormData({ ...formData, sameAsCurrent: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                      />
                      <span className="text-xs font-bold text-slate-700">Permanent address is same as current address</span>
                    </label>
                  </div>

                  {!formData.sameAsCurrent && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                          <span>Permanent Street Address</span>
                          {isProfileLocked && <Lock className="h-3 w-3 text-amber-600" />}
                        </label>
                        <input
                          type="text"
                          disabled={isProfileLocked}
                          value={formData.permanentStreet}
                          onChange={(e) => setFormData({ ...formData, permanentStreet: e.target.value })}
                          placeholder="Permanent address line"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Permanent City</label>
                        <input
                          type="text"
                          disabled={isProfileLocked}
                          value={formData.permanentCity}
                          onChange={(e) => setFormData({ ...formData, permanentCity: e.target.value })}
                          placeholder="City"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Permanent State</label>
                        <input
                          type="text"
                          disabled={isProfileLocked}
                          value={formData.permanentState}
                          onChange={(e) => setFormData({ ...formData, permanentState: e.target.value })}
                          placeholder="State"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:font-bold disabled:cursor-not-allowed disabled:border-slate-200"
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
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Draft"}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-black text-white hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 shadow-sm active:scale-95"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{saving ? "Processing..." : "Confirm & Save Profile"}</span>
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
                      Official CGPA: {collegeCgpa || "—"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                      <span className="text-[11px] font-bold text-slate-400">Official CGPA</span>
                      <p className="text-xl font-black text-blue-600 mt-0.5">
                        {collegeCgpa || "Not entered"}
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
                        Semester SGPAs are recorded separately and do not replace your official CGPA.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                      const sgpaVal = semMap[sem];
                      const isRecorded = sgpaVal !== undefined && sgpaVal !== null;
                      return (
                        <div key={sem} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                            <span className="whitespace-nowrap text-xs font-black text-slate-800">Semester {sem}</span>
                            {isRecorded ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Recorded" />
                            ) : (
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Pending</span>
                            )}
                          </div>
                          <p className={`font-black font-mono tabular-nums ${isRecorded ? "text-xl text-blue-600" : "text-sm text-slate-300"}`}>
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
                        Board: {studentProfile?.tenthDetails?.board || "Not entered"} • Passing Year: {studentProfile?.tenthDetails?.passingYear || "N/A"}
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
                        Authority: {studentProfile?.twelfthOrDiplomaDetails?.boardOrUniversity || "Not entered"} • Passing Year: {studentProfile?.twelfthOrDiplomaDetails?.passingYear || "N/A"}
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
                            {!studentProfile?.isProfileLocked && (
                              <th className="py-2.5 px-3.5 text-right">Action</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                          {backlogDetails.map((b, idx) => (
                            <tr key={b._id || idx}>
                              <td className="py-2.5 px-3.5">{b.subjectName || b.subjectCode || "Subject"}</td>
                              <td className="py-2.5 px-3.5">Sem {b.semester}</td>
                              <td className="py-2.5 px-3.5 text-right font-bold">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${b.status === "ACTIVE" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                                  {b.status}
                                </span>
                              </td>
                              {!studentProfile?.isProfileLocked && (
                                <td className="py-2.5 px-3.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBacklog(b._id)}
                                    className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                                    title="Delete backlog record"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 inline" />
                                  </button>
                                </td>
                              )}
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
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span>Education Gap History</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">Declaration of breaks taken during schooling or entrance prep.</p>
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

              {/* TAB: CERTIFICATES & CREDENTIALS */}
              {(activeSection === "all" || activeSection === "certificates") && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <Award className="h-4 w-4 text-purple-600" />
                        <span>Certificates & External Credentials ({certificates.length})</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">Verified credentials and certifications to showcase to campus recruiters.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddCertOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 transition active:scale-95 shadow-2xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Add Credential</span>
                    </button>
                  </div>

                  {certificates.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500 font-bold">
                      No certifications added yet. Click "+ Add Credential" or "Edit Profile" to add online credentials or course certificates.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {certificates.map((cert, idx) => {
                        const credUrl = getEffectiveCredentialUrl(cert);
                        return (
                          <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 flex flex-col justify-between gap-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h5 className="text-xs font-bold text-slate-900 truncate">{cleanCertificateTitle(cert.title, cert.issuer)}</h5>
                                  {renderVerificationBadge(cert.verificationStatus)}
                                  {renderOwnershipBadge(cert.ownershipStatus)}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {cert.issuer || "Online Credential"}
                                  {cert.issueDate && ` • ${new Date(cert.issueDate).toLocaleDateString()}`}
                                  {cert.category && ` • ${cert.category}`}
                                </p>
                                {(cert.recipientName || cert.extractedRecipientName) && (
                                  <p className="text-[11px] text-slate-600 mt-0.5">
                                    Recipient: <strong className="text-slate-800">{cert.recipientName || cert.extractedRecipientName}</strong>
                                  </p>
                                )}
                                {cert.credentialId && (
                                  <p className="text-[10px] font-mono text-slate-400 mt-0.5">ID: {cert.credentialId}</p>
                                )}
                                {credUrl && (
                                  <a
                                    href={credUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-800 hover:underline mt-1"
                                  >
                                    <span>[View Credential]</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteCertificate(idx)}
                                className="text-rose-500 hover:text-rose-700 p-1 shrink-0 cursor-pointer"
                                title="Remove certificate"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {cert.duplicateStatus === "CROSS_STUDENT_DUPLICATE" && (
                              <div className="mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium flex items-start gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span>This credential appears to be associated with another submission. Additional ownership verification is required.</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
      {/* MODAL: ADD CERTIFICATE / CREDENTIAL */}
      {isAddCertOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto p-2 bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200 sm:items-center sm:p-4">
          <div className="my-auto w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 sm:max-h-[calc(100dvh-2rem)] sm:p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Award className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Add & Verify Certificate</h4>
                  <p className="text-[11px] text-slate-400">Automated credential extraction & verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetCertForm();
                  setIsAddCertOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Source Selection Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setCertSourceType("url")}
                className={`flex-1 rounded-lg py-1.5 transition text-center ${
                  certSourceType === "url"
                    ? "bg-white text-purple-700 shadow-2xs font-black"
                    : "hover:text-slate-900"
                }`}
              >
                Certificate URL / Link
              </button>
              <button
                type="button"
                onClick={() => setCertSourceType("file")}
                className={`flex-1 rounded-lg py-1.5 transition text-center ${
                  certSourceType === "file"
                    ? "bg-white text-purple-700 shadow-2xs font-black"
                    : "hover:text-slate-900"
                }`}
              >
                Upload PDF / Image
              </button>
            </div>

            {/* Source Input Area */}
            {certSourceType === "url" ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Credential Verification URL / Link
                  </label>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Auto-fills on Paste / Entry
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={certUrl}
                    onChange={(e) => handleCertUrlChange(e.target.value)}
                    onPaste={handleCertUrlPaste}
                    placeholder="https://coursera.org/verify/... or https://credly.com/..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleValidateCertificate}
                    disabled={certValidating || !certUrl.trim()}
                    className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 transition disabled:opacity-50 shrink-0 inline-flex items-center gap-1.5 shadow-2xs"
                    title="Run or re-run AI Extraction"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{certValidating ? "Analyzing..." : "Auto-Fill"}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports Coursera, Credly, HackerRank, freeCodeCamp, Udemy, and public credential portals.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Certificate Document (PDF, PNG, JPG)
                  </label>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Auto-fills on Selection
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={(e) => handleCertFileChange(e.target.files?.[0] || null)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                  <button
                    type="button"
                    onClick={handleValidateCertificate}
                    disabled={certValidating || !certFile}
                    className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 transition disabled:opacity-50 shrink-0 inline-flex items-center gap-1.5 shadow-2xs"
                    title="Run or re-run AI Extraction"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{certValidating ? "Analyzing..." : "Auto-Fill"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Validation Progress Indicator */}
            {certValidating && (
              <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3 text-xs text-purple-900 space-y-1.5 animate-pulse">
                <div className="flex items-center gap-2 font-bold">
                  <Clock className="h-3.5 w-3.5 text-purple-600 animate-spin" />
                  <span>{certValidationStage || "Processing certificate verification pipeline..."}</span>
                </div>
                <p className="text-[11px] text-purple-700/80 pl-5.5">
                  Reading certificate details, extracting fields with Groq AI, and verifying credentials.
                </p>
              </div>
            )}

            {/* Verification Result Card */}
            {certValidationResult && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[10px]">
                    Analysis Outcome
                  </span>
                  <div className="flex items-center gap-1.5">
                    {renderVerificationBadge(certValidationResult.verificationStatus)}
                    {renderOwnershipBadge(certValidationResult.ownershipStatus || certValidationResult.identityMatch)}
                  </div>
                </div>

                {certValidationResult.duplicateStatus === "CROSS_STUDENT_DUPLICATE" && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-900 font-semibold flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>{certValidationResult.duplicateDetails || "This credential appears to be associated with another submission. Additional ownership verification is required."}</span>
                  </div>
                )}

                {certValidationResult.aiAnalysis?.summary && (
                  <p className="text-[11px] text-slate-600 italic">
                    {certValidationResult.aiAnalysis.summary}
                  </p>
                )}

                {certValidationResult.aiAnalysis?.warnings?.length > 0 && (
                  <div className="space-y-1">
                    {certValidationResult.aiAnalysis.warnings.map((warn, wIdx) => (
                      <p key={wIdx} className="text-[10px] text-amber-800 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                        <span>{warn}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Guide Card when validation has not been run yet */}
            {!certValidationResult && !certValidating ? (
              <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/40 p-6 text-center text-xs space-y-2">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h6 className="font-bold text-slate-800">Auto-Extract Certificate First</h6>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Paste your credential link or select a certificate document above, then click <strong>Auto-Fill</strong>. The system will verify authenticity and extract recipient details before allowing you to review and save.
                </p>
              </div>
            ) : (
              /* Step 2: Form shown after validation for review & manual adjustments */
              <form onSubmit={handleAddCertificate} className="space-y-3">
                {/* Ownership Mismatch Banner */}
                {Boolean(
                  certValidationResult?.ownershipStatus === "MISMATCH" ||
                  certValidationResult?.identityMatch === "Mismatch"
                ) && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-semibold flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-900">Ownership Mismatch Detected</p>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        Certificate recipient <strong>"{certRecipientName || certValidationResult?.recipientName}"</strong> does not match your registered name <strong>"{user?.fullName || studentProfile?.fullName}"</strong>. Saving is disabled because you cannot attach someone else's certificate.
                      </p>
                    </div>
                  </div>
                )}

                {/* Duplicate Credential Banner */}
                {certValidationResult?.duplicateStatus === "CROSS_STUDENT_DUPLICATE" && (
                  <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900 font-semibold flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-900">Duplicate Submission Detected</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        {certValidationResult.duplicateDetails || "This credential appears to be associated with another student submission. Additional ownership verification is required."}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Certificate Title *</label>
                    {autoFilledFields.has("title") && (
                      <span className="text-[10px] font-bold text-purple-600 flex items-center gap-0.5">
                        <Sparkles className="h-2.5 w-2.5" /> Auto-filled
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={certTitle}
                    onChange={(e) => setCertTitle(e.target.value)}
                    placeholder="e.g. AWS Certified Solutions Architect"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Issuing Organization</label>
                      {autoFilledFields.has("issuer") && (
                        <span className="text-[10px] font-bold text-purple-600 flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" /> Auto-filled
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={certIssuer}
                      onChange={(e) => setCertIssuer(e.target.value)}
                      placeholder="e.g. Amazon Web Services"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={certCategory}
                      onChange={(e) => setCertCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500 bg-white"
                    >
                      <option value="Course Completion">Course Completion</option>
                      <option value="Technical Certification">Technical Certification</option>
                      <option value="Internship">Internship</option>
                      <option value="Workshop">Workshop</option>
                      <option value="Academic Achievement">Academic Achievement</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Recipient Name</label>
                      {autoFilledFields.has("recipientName") && (
                        <span className="text-[10px] font-bold text-purple-600 flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" /> Auto-filled
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={certRecipientName}
                      onChange={(e) => setCertRecipientName(e.target.value)}
                      placeholder="Recipient name on certificate"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Credential ID (Optional)</label>
                      {autoFilledFields.has("credentialId") && (
                        <span className="text-[10px] font-bold text-purple-600 flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" /> Auto-filled
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={certCredentialId}
                      onChange={(e) => setCertCredentialId(e.target.value)}
                      placeholder="e.g. AWS-849201"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Issue Date</label>
                      {autoFilledFields.has("issueDate") && (
                        <span className="text-[10px] font-bold text-purple-600 flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" /> Auto-filled
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={certIssueDate}
                      onChange={(e) => setCertIssueDate(e.target.value)}
                      placeholder="YYYY-MM-DD or Month Year"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Expiration Date (Optional)</label>
                      {autoFilledFields.has("expirationDate") && (
                        <span className="text-[10px] font-bold text-purple-600 flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" /> Auto-filled
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={certExpirationDate}
                      onChange={(e) => setCertExpirationDate(e.target.value)}
                      placeholder="YYYY-MM-DD or Never"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      resetCertForm();
                      setIsAddCertOpen(false);
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  {(() => {
                    const isMismatch = certValidationResult?.ownershipStatus === "MISMATCH" || certValidationResult?.identityMatch === "Mismatch";
                    const isDuplicate = certValidationResult?.duplicateStatus === "CROSS_STUDENT_DUPLICATE";
                    const canSave = !certValidating && Boolean(certValidationResult) && !isMismatch && !isDuplicate && Boolean(certTitle.trim());

                    return (
                      <button
                        type="submit"
                        disabled={!canSave}
                        className={`rounded-xl px-4 py-1.5 text-xs font-bold transition shadow-2xs ${
                          canSave
                            ? "bg-purple-600 text-white hover:bg-purple-700 active:scale-95 cursor-pointer"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none"
                        }`}
                        title={
                          !certValidationResult
                            ? "Please auto-fill / validate the certificate first"
                            : isMismatch
                            ? "Cannot save: Recipient name does not match your registered name"
                            : isDuplicate
                            ? "Cannot save: Duplicate submission detected"
                            : "Save certificate"
                        }
                      >
                        Save Certificate
                      </button>
                    );
                  })()}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Institutional Profile Lock Confirmation Modal */}
      <ProfileLockConfirmationModal
        isOpen={isLockModalOpen}
        onClose={() => setIsLockModalOpen(false)}
        onConfirmLock={handleConfirmLock}
        formData={{ ...formData, certificates, cgpa: collegeCgpa }}
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
