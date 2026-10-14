import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  Upload,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Calendar,
  ShieldCheck,
  AlertCircle,
  BookOpen,
  Layers,
  FileCheck2,
} from "lucide-react";

import {
  registerStudent,
  getPublicDepartments,
  getPublicSessions,
} from "../../services/authService";
import { useAuth } from "../../context/authContextDef";

const COURSE_OPTIONS = [
  { value: "B.Tech", label: "B.Tech (Bachelor of Technology)", durationYears: 4 },
  { value: "MCA", label: "MCA (Master of Computer Applications)", durationYears: 2 },
  { value: "M.Tech", label: "M.Tech (Master of Technology)", durationYears: 2 },
];

const ADMISSION_YEARS = [2021, 2022, 2023, 2024, 2025, 2026];

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Multi-step progress: 1 = Account, 2 = Academic, 3 = Session, 4 = Review & Consent
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Account Details
    fullName: "",
    email: "",
    personalEmail: "",
    password: "",
    confirmPassword: "",
    phone: "",
    usn: "",
    avatar: null,

    // Step 2: Academic Details
    course: "B.Tech",
    courseDurationYears: 4,
    department: "",
    branch: "",
    admissionYear: 2023,
    currentSemester: 6,

    // Step 4: Basic Profile & Consent
    gender: "Prefer not to say",
    dob: "",
    consentAgreed: false,
  });

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Server-fetched configurations
  const [departments, setDepartments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Fetch active departments and placement sessions on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchConfig() {
      try {
        setLoadingConfig(true);
        const [deptRes, sessRes] = await Promise.allSettled([
          getPublicDepartments(),
          getPublicSessions(),
        ]);

        if (isMounted) {
          if (deptRes.status === "fulfilled" && deptRes.value?.data) {
            setDepartments(deptRes.value.data);
            if (deptRes.value.data.length > 0) {
              setFormData((prev) => ({
                ...prev,
                department: prev.department || deptRes.value.data[0].name,
                branch: prev.branch || deptRes.value.data[0].name,
              }));
            }
          }
          if (sessRes.status === "fulfilled" && sessRes.value?.data) {
            setSessions(sessRes.value.data);
          }
        }
      } catch (err) {
        console.warn("Error loading registration configurations:", err);
      } finally {
        if (isMounted) setLoadingConfig(false);
      }
    }
    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute Expected Graduation Year based on Course Duration and Admission Year
  const expectedGraduationYear = useMemo(() => {
    const admissionYear = Number(formData.admissionYear) || 2023;
    const duration =
      formData.course === "MCA" || formData.course === "M.Tech"
        ? 2
        : Number(formData.courseDurationYears) || 4;
    return admissionYear + duration;
  }, [formData.admissionYear, formData.course, formData.courseDurationYears]);

  // Match corresponding Placement Session from fetched sessions
  const matchingSession = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    return sessions.find(
      (s) => Number(s.sessionYear) === expectedGraduationYear && !s.isArchived
    );
  }, [sessions, expectedGraduationYear]);

  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;
    if (name === "avatar" && files && files[0]) {
      const file = files[0];
      setFormData((prev) => ({ ...prev, avatar: file }));
      setAvatarPreview(URL.createObjectURL(file));
    } else if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === "course") {
      const courseObj = COURSE_OPTIONS.find((c) => c.value === value);
      setFormData((prev) => ({
        ...prev,
        course: value,
        courseDurationYears: courseObj ? courseObj.durationYears : 4,
      }));
    } else if (name === "department") {
      setFormData((prev) => ({
        ...prev,
        department: value,
        branch: value,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Step-by-Step Validation
  const validateStep1 = () => {
    if (!formData.fullName.trim()) return "Full name is required (minimum 2 characters).";
    if (formData.fullName.trim().length < 2) return "Full name must be at least 2 characters.";
    if (!formData.email.trim()) return "Institutional email address is required.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) return "Please enter a valid institutional email.";
    if (!formData.usn.trim()) return "USN / University Seat Number is required.";
    if (formData.usn.trim().length < 3) return "USN must be at least 3 characters long.";
    if (!formData.password) return "Password is required.";
    if (formData.password.length < 8) return "Password must be at least 8 characters long.";
    if (formData.password !== formData.confirmPassword) return "Password and Confirm Password do not match.";
    return null;
  };

  const validateStep2 = () => {
    if (!formData.course) return "Please select your course / degree program.";
    if (!formData.department) return "Please select your department / branch.";
    if (!formData.admissionYear) return "Please select your admission year.";
    return null;
  };

  const validateStep3 = () => {
    if (!matchingSession) {
      return `No placement session is configured for Class of ${expectedGraduationYear}. Please contact your Training & Placement Office.`;
    }
    if (matchingSession.isClosed) {
      return `The placement session for Class of ${expectedGraduationYear} is closed. Please contact your Placement Office.`;
    }
    return null;
  };

  const validateStep4 = () => {
    if (!formData.consentAgreed) {
      return "You must confirm that all details are accurate and agree to placement guidelines.";
    }
    return null;
  };

  const handleNextStep = () => {
    setError("");
    let err = null;
    if (currentStep === 1) err = validateStep1();
    else if (currentStep === 2) err = validateStep2();
    else if (currentStep === 3) err = validateStep3();

    if (err) {
      setError(err);
      return;
    }
    setCurrentStep((prev) => Math.min(4, prev + 1));
  };

  const handlePrevStep = () => {
    setError("");
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  // Final Registration Submission
  const handleFinalSignup = async (e) => {
    e.preventDefault();
    setError("");

    const err = validateStep4();
    if (err) {
      setError(err);
      return;
    }

    try {
      setLoading(true);
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        personalEmail: formData.personalEmail.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        phone: formData.phone.trim(),
        usn: formData.usn.trim().toUpperCase(),
        enrollmentNumber: formData.usn.trim().toUpperCase(),
        course: formData.course,
        courseDurationYears: formData.courseDurationYears,
        department: formData.department,
        branch: formData.branch || formData.department,
        admissionYear: Number(formData.admissionYear),
        graduationYear: expectedGraduationYear,
        semester: Number(formData.currentSemester),
        currentSemester: Number(formData.currentSemester),
        placementSession: matchingSession?._id,
        gender: formData.gender,
        dob: formData.dob || null,
        avatar: formData.avatar,
      };

      const res = await registerStudent(payload);

      toast.success(
        `Welcome ${formData.fullName.split(" ")[0]}! Placement session for Class of ${expectedGraduationYear} assigned.`
      );

      // Automatic login if tokens returned
      if (res.data?.accessToken && res.data?.user) {
        login(res.data.accessToken, res.data.user, "student");
        navigate("/student-dashboard", { replace: true });
      } else {
        navigate("/login");
      }
    } catch (apiErr) {
      console.error("Student registration error:", apiErr);
      const msg =
        apiErr.response?.data?.message ||
        apiErr.message ||
        "Registration failed. Please check your information and try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
      {/* Dynamic ambient background glow circles */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl filter" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl filter" />

      <div className="relative z-10 w-full max-w-xl">
        {/* Brand Header */}
        <div className="mb-5 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-white shadow-xl backdrop-blur-md transition hover:border-blue-500/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 font-bold text-white shadow-md shadow-blue-500/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="text-left">
              <span className="block text-sm font-bold tracking-tight text-white">
                CampusFlow Portal
              </span>
              <span className="block text-[11px] font-medium text-slate-400">
                Official Student Registration
              </span>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          {/* Header Title & Subtitle */}
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
              <Sparkles className="h-3 w-3" /> Step {currentStep} of 4:{" "}
              {currentStep === 1 && "Account Credentials"}
              {currentStep === 2 && "Department & Degree"}
              {currentStep === 3 && "Cohort & Placement Session"}
              {currentStep === 4 && "Review & Declarations"}
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Student Registration
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Register with verified academic credentials to link your placement session
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="mt-6 mb-6">
            <div className="grid grid-cols-4 gap-2">
              {[
                { step: 1, label: "Account" },
                { step: 2, label: "Academic" },
                { step: 3, label: "Session" },
                { step: 4, label: "Consent" },
              ].map((s) => (
                <div key={s.step} className="flex flex-col items-center gap-1">
                  <div
                    className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                      currentStep >= s.step
                        ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                        : "bg-slate-800"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-semibold tracking-wider uppercase ${
                      currentStep === s.step
                        ? "text-blue-400"
                        : currentStep > s.step
                        ? "text-slate-300"
                        : "text-slate-600"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleFinalSignup} className="space-y-4">
            {/* ======================================================== */}
            {/* STEP 1: ACCOUNT DETAILS                                   */}
            {/* ======================================================== */}
            {currentStep === 1 && (
              <div className="space-y-3.5 animate-in fade-in-50">
                {/* Avatar Upload */}
                <div className="flex items-center gap-3.5 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-800 text-slate-400">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-slate-200">
                      Profile Photo (Optional)
                    </label>
                    <p className="text-[10px] text-slate-500">
                      JPG, PNG up to 5MB
                    </p>
                    <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[10px] font-medium text-slate-300 transition hover:bg-slate-700">
                      <Upload className="h-3 w-3" />
                      <span>Upload Avatar</span>
                      <input
                        type="file"
                        name="avatar"
                        accept="image/*"
                        onChange={handleChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      name="fullName"
                      required
                      placeholder="e.g. Akash Verma"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-600 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Institutional Email & USN Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Institutional Email <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder="student@college.edu"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-3 pl-10 text-sm text-white placeholder-slate-600 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      USN / Roll Number <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <FileCheck2 className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        name="usn"
                        required
                        placeholder="e.g. 1MS23CS001"
                        value={formData.usn}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-3 pl-10 text-sm text-white uppercase placeholder-slate-600 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Personal Email & Phone Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Personal Email <span className="text-slate-500">(Optional)</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="email"
                        name="personalEmail"
                        placeholder="personal@gmail.com"
                        value={formData.personalEmail}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-3 pl-10 text-sm text-white placeholder-slate-600 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-3 pl-10 text-sm text-white placeholder-slate-600 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        required
                        placeholder="Min 8 characters"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-8 pl-10 text-sm text-white placeholder-slate-600 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Confirm Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="confirmPassword"
                        required
                        placeholder="Re-enter password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-8 pl-10 text-sm text-white placeholder-slate-600 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 2: ACADEMIC & DEPARTMENT DETAILS                    */}
            {/* ======================================================== */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in-50">
                {/* Course Selection */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    College Program / Degree <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <select
                      name="course"
                      value={formData.course}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-4 pl-10 text-sm text-white transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    >
                      {COURSE_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Department Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Department / Branch <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-blue-400">
                      Managed by TPO
                    </span>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Layers className="h-4 w-4" />
                    </div>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-4 pl-10 text-sm text-white transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    >
                      {departments.length > 0 ? (
                        departments.map((d) => (
                          <option key={d._id} value={d.name}>
                            {d.name} {d.code ? `(${d.code})` : ""}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Computer Science and Engineering (CSE)">
                            Computer Science and Engineering (CSE)
                          </option>
                          <option value="Information Science and Engineering (ISE)">
                            Information Science and Engineering (ISE)
                          </option>
                          <option value="Electronics and Communication Engineering (ECE)">
                            Electronics and Communication Engineering (ECE)
                          </option>
                          <option value="Electrical and Electronics Engineering (EEE)">
                            Electrical and Electronics Engineering (EEE)
                          </option>
                          <option value="Mechanical Engineering (ME)">
                            Mechanical Engineering (ME)
                          </option>
                          <option value="Civil Engineering (CE)">
                            Civil Engineering (CE)
                          </option>
                          <option value="Artificial Intelligence and Machine Learning (AIML)">
                            Artificial Intelligence and Machine Learning (AIML)
                          </option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Admission Year & Current Semester Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Admission Year <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <select
                        name="admissionYear"
                        value={formData.admissionYear}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-4 pl-10 text-sm text-white transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      >
                        {ADMISSION_YEARS.map((yr) => (
                          <option key={yr} value={yr}>
                            {yr} (Admission Cohort)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Current Semester <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <select
                        name="currentSemester"
                        value={formData.currentSemester}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-4 pl-10 text-sm text-white transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                          <option key={sem} value={sem}>
                            Semester {sem}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Formula Information Box */}
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3.5 text-xs text-blue-200">
                  <div className="flex items-center gap-2 font-semibold text-blue-300">
                    <Sparkles className="h-4 w-4 text-blue-400" />
                    <span>Configurable Academic Progression</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-blue-100/80">
                    Admission year <strong>{formData.admissionYear}</strong> in a{" "}
                    <strong>{formData.courseDurationYears}-year {formData.course}</strong>{" "}
                    program maps deterministically to the{" "}
                    <strong>Class of {expectedGraduationYear}</strong> placement cohort.
                  </p>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 3: COHORT & PLACEMENT SESSION ASSIGNMENT            */}
            {/* ======================================================== */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in-50">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Academic Mapping Calculation
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">Program:</span>
                      <p className="font-semibold text-white">{formData.course}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Department:</span>
                      <p className="font-semibold text-white truncate">{formData.department}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Admission Year:</span>
                      <p className="font-semibold text-white">{formData.admissionYear}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Expected Graduation:</span>
                      <p className="font-semibold text-emerald-400">Class of {expectedGraduationYear}</p>
                    </div>
                  </div>
                </div>

                {/* Placement Session Status Display */}
                {matchingSession ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200">
                    <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <span>Placement Session Verified & Linked</span>
                    </div>
                    <div className="mt-2.5 space-y-1 text-xs">
                      <p>
                        <span className="text-emerald-400 font-semibold">Session Name:</span>{" "}
                        {matchingSession.name || `Class of ${expectedGraduationYear} Placement Session`}
                      </p>
                      <p>
                        <span className="text-emerald-400 font-semibold">Academic Period:</span>{" "}
                        {matchingSession.academicYear || `${expectedGraduationYear - 1}-${expectedGraduationYear}`}
                      </p>
                      <p>
                        <span className="text-emerald-400 font-semibold">Cohort Status:</span>{" "}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-200">
                          {matchingSession.isActive ? "ACTIVE TPO COHORT" : "UPCOMING"}
                        </span>
                      </p>
                    </div>
                    <p className="mt-3 text-[11px] text-emerald-100/70 border-t border-emerald-500/20 pt-2">
                      Your applications, placement drive eligibility, and interview schedules will be strictly scoped to this verified placement session.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                    <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                      <span>No Active Placement Session Found</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-amber-100">
                      No placement session is configured for the <strong>Class of {expectedGraduationYear}</strong>.
                      College guidelines require the Training & Placement Office (TPO) to initialize and activate this cohort session before student onboarding.
                    </p>
                    <p className="mt-2 text-[11px] text-amber-200/80 font-medium">
                      Please contact your college Placement Officer (TPO) or adjust your admission year if entered mistakenly.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 4: BASIC PROFILE & CONSENT DECLARATIONS             */}
            {/* ======================================================== */}
            {currentStep === 4 && (
              <div className="space-y-4 animate-in fade-in-50">
                {/* Optional DOB & Gender */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Date of Birth <span className="text-slate-500">(Optional)</span>
                    </label>
                    <input
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 px-3 text-sm text-white transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Gender
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 px-3 text-sm text-white transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                {/* Profile Completion Note */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2 font-semibold text-blue-400">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Gradual Profile Completion Workflow</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    Only essential account & cohort details are required now.
                    Detailed semester results, 10th/12th percentages, backlog ledgers, family info, and master resume uploads can be completed anytime in your candidate drawer after registration.
                  </p>
                </div>

                {/* Consent Checkbox */}
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      name="consentAgreed"
                      checked={formData.consentAgreed}
                      onChange={handleChange}
                      className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500/30"
                    />
                    <span className="text-xs text-slate-300 leading-relaxed">
                      I declare that all academic credentials, department details, and contact numbers provided are accurate and understand that falsification will lead to debarment from campus recruitment.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Step Action Buttons */}
            <div className="mt-6 flex items-center justify-between gap-3 pt-2">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-60"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={currentStep === 3 && !matchingSession}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:opacity-50"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !formData.consentAgreed}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Already have account */}
          <div className="mt-6 text-center text-xs text-slate-400">
            Already registered?{" "}
            <Link
              to="/login"
              className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
            >
              Sign In here
            </Link>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-4 text-center">
          <Link
            to="/"
            className="text-xs text-slate-500 transition hover:text-slate-300"
          >
            ← Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}