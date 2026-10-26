import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
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
    programLevel: "",
    programCode: "",
    course: "",
    courseDurationYears: "",
    department: "",
    branch: "",
    admissionYear: "",
    currentSemester: "",

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
    const admissionYear = Number(formData.admissionYear);
    if (!formData.programCode || !Number.isInteger(admissionYear)) return null;
    return admissionYear + Number(formData.courseDurationYears);
  }, [formData.admissionYear, formData.programCode, formData.courseDurationYears]);

  const selectedProgram = departments.find((program) => program.code === formData.programCode);
  const programsForLevel = departments.filter((program) => program.programLevel === formData.programLevel);
  const admissionYearOptions = useMemo(() => {
    if (!selectedProgram) return [];
    const duration = Number(selectedProgram.durationYears) || 4;
    const degreeAliases = selectedProgram.degreeType === "B.E." ? ["B.E.", "B.Tech"] : [selectedProgram.degreeType];

    const yearMap = new Map();

    (sessions || []).filter((s) => !s.isArchived).forEach((session) => {
      // 1. From explicit admissionYearMapping
      (session.admissionYearMapping || []).forEach((mapping) => {
        if (degreeAliases.includes(mapping.course) && Number.isInteger(Number(mapping.admissionYear))) {
          const yr = Number(mapping.admissionYear);
          const label = session.academicYear
            ? `${yr} (Session ${session.academicYear})`
            : `${yr} (Class of ${session.sessionYear})`;
          if (!yearMap.has(yr)) yearMap.set(yr, label);
        }
      });

      // 2. Computed from session.sessionYear (graduation year - course duration)
      if (Number.isInteger(Number(session.sessionYear))) {
        const computedYr = Number(session.sessionYear) - duration;
        const label = session.academicYear
          ? `${computedYr} (Session ${session.academicYear})`
          : `${computedYr} (Class of ${session.sessionYear})`;
        if (!yearMap.has(computedYr)) yearMap.set(computedYr, label);
      }

      // 3. Extracted from session.academicYear range (e.g. "2024-2028")
      if (session.academicYear && typeof session.academicYear === "string") {
        const parts = session.academicYear.match(/\b(20\d\d)\b/g);
        if (parts && parts.length >= 2) {
          const admYr = Number(parts[0]);
          const gradYr = Number(parts[1]);
          if (gradYr - admYr === duration) {
            const label = `${admYr} (Session ${parts[0]}-${parts[1]})`;
            if (!yearMap.has(admYr)) yearMap.set(admYr, label);
          }
        }
      }
    });

    return Array.from(yearMap.entries())
      .map(([year, label]) => ({ year: Number(year), label }))
      .sort((a, b) => b.year - a.year);
  }, [selectedProgram, sessions]);

  // Match corresponding Placement Session from fetched sessions
  const matchingSession = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    return sessions.find((session) => {
      if (session.isArchived || session.isClosed) return false;
      if (Number(session.sessionYear) === expectedGraduationYear) return true;
      if (session.academicYear && typeof session.academicYear === "string") {
        const parts = session.academicYear.match(/\b(20\d\d)\b/g);
        if (parts && parts.length >= 2 && Number(parts[1]) === expectedGraduationYear) return true;
      }
      return (session.admissionYearMapping || []).some(
        (m) => Number(m.admissionYear) === Number(formData.admissionYear)
      );
    });
  }, [sessions, expectedGraduationYear, formData.admissionYear]);

  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;
    if (name === "avatar" && files && files[0]) {
      const file = files[0];
      setFormData((prev) => ({ ...prev, avatar: file }));
      setAvatarPreview(URL.createObjectURL(file));
    } else if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === "programLevel") {
      setFormData((prev) => ({
        ...prev,
        programLevel: value,
        programCode: "",
        course: "",
        courseDurationYears: "",
        department: "",
        branch: "",
        admissionYear: "",
      }));
    } else if (name === "programCode") {
      const program = departments.find((item) => item.code === value);
      setFormData((prev) => ({
        ...prev,
        programCode: value,
        course: program?.degreeType || "",
        courseDurationYears: program?.durationYears || "",
        department: program?.name || "",
        branch: program?.name || "",
        admissionYear: "",
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
    if (!formData.programLevel) return "Please select your program level.";
    if (!selectedProgram) return "Please select an approved academic program.";
    if (!formData.admissionYear) return "Please select your admission year.";
    const valid = admissionYearOptions.some((opt) => opt.year === Number(formData.admissionYear));
    if (!valid) return "The selected admission year is not configured for this program.";
    return null;
  };

  const validateStep3 = () => {
    if (!expectedGraduationYear || !matchingSession) {
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
        programCode: formData.programCode,
        programLevel: selectedProgram.programLevel,
        degreeType: selectedProgram.degreeType,
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#FFF5EA] via-[#FAF1E4] to-[#F5E6D3] px-4 py-8 font-sans selection:bg-orange-500 selection:text-white sm:px-6 lg:px-8">
      {/* Soft warm light ambient glowing background shades */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-amber-400/25 via-orange-300/20 to-transparent blur-3xl filter" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-gradient-to-tl from-orange-400/25 via-amber-300/20 to-transparent blur-3xl filter" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-amber-300/15 blur-[120px]" />

      <div className="relative z-10 w-full max-w-xl">
        {/* Brand Header */}
        <div className="mb-5 text-center">
          <Link
            to="/"
            className="group inline-flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-2.5 text-slate-800 shadow-md shadow-slate-200/50 backdrop-blur-sm transition-all duration-200 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-100"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1 border border-orange-200 shadow-xs transition-transform duration-300 group-hover:scale-105">
              <img
                src="/images/jssateb/college-logo.png"
                alt="JSSATEB Logo"
                className="h-full w-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-slate-900">
                  CampusFlow
                </span>
                <span className="rounded-md bg-orange-100 px-1.5 py-0.2 text-[10px] font-extrabold text-orange-900 border border-orange-200">
                  JSSATEB
                </span>
              </div>
              <span className="block text-[11px] font-medium text-slate-500">
                Official Student Registration Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Main Card (Light Theme) */}
        <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-xl shadow-slate-200/60 backdrop-blur-sm sm:p-8">
          {/* Header Title & Subtitle */}
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800 shadow-xs">
              <Sparkles className="h-3 w-3 text-orange-600" />
              <span>
                Step {currentStep} of 4:{" "}
                {currentStep === 1 && "Account Credentials"}
                {currentStep === 2 && "Department & Degree"}
                {currentStep === 3 && "Cohort & Placement Session"}
                {currentStep === 4 && "Review & Declarations"}
              </span>
            </span>
            <h2 className="mt-2.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Student Registration
            </h2>
            <p className="mt-1 text-xs text-slate-500">
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
                <div key={s.step} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                      currentStep > s.step
                        ? "bg-gradient-to-r from-orange-600 to-rose-600"
                        : currentStep === s.step
                        ? "bg-gradient-to-r from-orange-500 via-rose-500 to-indigo-600 shadow-sm shadow-orange-500/30"
                        : "bg-slate-200"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-bold tracking-wider uppercase transition-colors ${
                      currentStep === s.step
                        ? "text-orange-600"
                        : currentStep > s.step
                        ? "text-slate-700"
                        : "text-slate-400"
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
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
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
                <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-slate-400">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-semibold text-slate-700">
                      Profile Photo (Optional)
                    </label>
                    <p className="text-[10px] text-slate-500">
                      JPG, PNG up to 5MB
                    </p>
                    <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-orange-300 shadow-2xs">
                      <Upload className="h-3 w-3 text-orange-600" />
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
                  <label htmlFor="signup-field-1" className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input id="signup-field-1"
                      type="text"
                      name="fullName"
                      required
                      placeholder="e.g. Akash Verma"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pr-4 pl-10 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Institutional Email & USN Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="signup-field-2" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Institutional Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input id="signup-field-2"
                        type="email"
                        name="email"
                        required
                        placeholder="student@campusflow.edu"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pr-3 pl-10 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-field-3" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      USN / Roll Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <FileCheck2 className="h-4 w-4" />
                      </div>
                      <input id="signup-field-3"
                        type="text"
                        name="usn"
                        required
                        placeholder="e.g. 1JS21CS001"
                        value={formData.usn}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pr-3 pl-10 text-sm text-slate-900 uppercase placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Personal Email & Phone Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="signup-field-4" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Personal Email <span className="text-slate-400">(Optional)</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input id="signup-field-4"
                        type="email"
                        name="personalEmail"
                        placeholder="personal@gmail.com"
                        value={formData.personalEmail}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pr-3 pl-10 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-field-5" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input id="signup-field-5"
                        type="tel"
                        name="phone"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pr-3 pl-10 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="signup-field-6" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input id="signup-field-6"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        required
                        placeholder="Min 8 characters"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pr-8 pl-10 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-field-7" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Confirm Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <input id="signup-field-7"
                        type={showPassword ? "text" : "password"}
                        name="confirmPassword"
                        required
                        placeholder="Re-enter password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pr-8 pl-10 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 transition"
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
                {/* Program level and approved program */}
                <div>
                  <label htmlFor="signup-field-8" className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Program Level <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <select id="signup-field-8"
                      name="programLevel"
                      value={formData.programLevel}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pr-4 pl-10 text-sm text-slate-900 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                    >
                      <option value="">Select program level</option>
                      <option value="Undergraduate">Undergraduate (B.E.)</option>
                      <option value="Postgraduate">Postgraduate</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="signup-field-9" className="block text-xs font-semibold text-slate-700">
                      Academic Program <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Layers className="h-4 w-4" />
                    </div>
                    <select id="signup-field-9"
                      name="programCode"
                      value={formData.programCode}
                      onChange={handleChange}
                      disabled={!formData.programLevel || loadingConfig || departments.length === 0}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pr-4 pl-10 text-sm text-slate-900 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">{loadingConfig ? "Loading approved programs..." : "Select academic program"}</option>
                      {programsForLevel.map((program) => (
                        <option key={program.code} value={program.code}>
                          {program.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!loadingConfig && departments.length === 0 && (
                    <p className="mt-1 text-xs text-rose-600">Approved programs could not be loaded. Refresh the page or contact the Placement Office.</p>
                  )}
                </div>

                {/* Admission Year & Current Semester Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="signup-field-10" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Admission Year <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <select id="signup-field-10"
                        name="admissionYear"
                        value={formData.admissionYear || ""}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pr-4 pl-10 text-sm text-slate-900 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                      >
                        <option value="">Select admission year</option>
                        {admissionYearOptions.map((item) => (
                          <option key={item.year} value={item.year}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-field-11" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Current Semester <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <select id="signup-field-11"
                        name="currentSemester"
                        value={formData.currentSemester}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pr-4 pl-10 text-sm text-slate-900 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
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
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span>Configurable Academic Progression</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800/90">
                    Admission year <strong>{formData.admissionYear || "—"}</strong> in a{" "}
                    <strong>{formData.courseDurationYears || "—"}-year {formData.course || "program"}</strong>{" "}
                    program maps deterministically to the{" "}
                    <strong className="text-amber-900">Class of {expectedGraduationYear || "—"}</strong> placement cohort.
                  </p>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 3: COHORT & PLACEMENT SESSION ASSIGNMENT            */}
            {/* ======================================================== */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in-50">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-orange-700">
                    Academic Mapping Calculation
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">Program:</span>
                      <p className="font-semibold text-slate-900 truncate">{selectedProgram?.name || "Not selected"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Department:</span>
                      <p className="font-semibold text-slate-900 truncate">{formData.department || "—"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Admission Year:</span>
                      <p className="font-semibold text-slate-900">{formData.admissionYear || "—"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Expected Graduation:</span>
                      <p className="font-semibold text-emerald-700">Class of {expectedGraduationYear}</p>
                    </div>
                  </div>
                </div>

                {/* Placement Session Status Display */}
                {matchingSession ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs text-emerald-900">
                    <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span>Placement Session Verified & Linked</span>
                    </div>
                    <div className="mt-2.5 space-y-1 text-xs">
                      <p>
                        <span className="text-emerald-700 font-semibold">Session Name:</span>{" "}
                        {matchingSession.name || `Class of ${expectedGraduationYear} Placement Session`}
                      </p>
                      <p>
                        <span className="text-emerald-700 font-semibold">Academic Period:</span>{" "}
                        {matchingSession.academicYear || `${expectedGraduationYear - 1}-${expectedGraduationYear}`}
                      </p>
                      <p>
                        <span className="text-emerald-700 font-semibold">Cohort Status:</span>{" "}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {matchingSession.isActive ? "ACTIVE TPO COHORT" : "UPCOMING"}
                        </span>
                      </p>
                    </div>
                    <p className="mt-3 text-[11px] text-emerald-800/80 border-t border-emerald-200 pt-2">
                      Your applications, placement drive eligibility, and interview schedules will be strictly scoped to this verified placement session.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900">
                    <div className="flex items-center gap-2 font-bold text-amber-800 text-sm">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <span>No Active Placement Session Found</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-amber-800">
                      No placement session is configured for the <strong>Class of {expectedGraduationYear}</strong>.
                      College guidelines require the Training & Placement Office (TPO) to initialize and activate this cohort session before student onboarding.
                    </p>
                    <p className="mt-2 text-[11px] text-amber-700 font-medium">
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
                    <label htmlFor="signup-field-12" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Date of Birth <span className="text-slate-400">(Optional)</span>
                    </label>
                    <input id="signup-field-12"
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-sm text-slate-900 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="signup-field-13" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Gender
                    </label>
                    <select id="signup-field-13"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-sm text-slate-900 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                {/* Profile Completion Note */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <ShieldCheck className="h-4 w-4 text-orange-600" />
                    <span>Gradual Profile Completion Workflow</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    Only essential account & cohort details are required now.
                    Detailed semester results, 10th/12th percentages, backlog ledgers, family info, and master resume uploads can be completed anytime in your candidate drawer after registration.
                  </p>
                </div>

                {/* Consent Checkbox */}
                <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 transition hover:bg-orange-50/80">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="consentAgreed"
                      checked={formData.consentAgreed}
                      onChange={handleChange}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500/30 accent-orange-600"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed font-medium">
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60 shadow-2xs"
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 via-rose-600 to-indigo-700 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-600/25 transition hover:from-orange-500 hover:to-indigo-600 active:scale-95 disabled:opacity-50"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !formData.consentAgreed}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500 active:scale-95 disabled:opacity-50"
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
          <div className="mt-6 text-center text-xs text-slate-500">
            Already registered?{" "}
            <Link
              to="/login"
              className="font-bold text-orange-600 hover:text-orange-700 hover:underline transition"
            >
              Sign In here
            </Link>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-4 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-800"
          >
            ← Return to College Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}