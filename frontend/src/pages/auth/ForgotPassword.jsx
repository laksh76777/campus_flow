import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  GraduationCap,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  KeyRound,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import {
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  completePasswordReset,
} from "../../services/authService";

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") === "admin" ? "admin" : "student";
  const [role, setRole] = useState(initialRole);
  const navigate = useNavigate();

  // Multi-step flow: "EMAIL" -> "OTP" -> "PASSWORD" -> "SUCCESS"
  const [step, setStep] = useState("EMAIL");

  // Form State
  const [email, setEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [resetToken, setResetToken] = useState(""); // Kept ONLY in component state!
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Timers
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(300); // 5 mins
  const [cooldownSeconds, setCooldownSeconds] = useState(0); // 60s resend cooldown

  const otpInputsRef = useRef([]);

  // Sync role from URL query param
  useEffect(() => {
    const queryRole = searchParams.get("role");
    if (queryRole === "admin" || queryRole === "student") {
      setRole(queryRole);
    }
  }, [searchParams]);

  // Expiration countdown
  useEffect(() => {
    if (step !== "OTP" || otpExpirySeconds <= 0) return;
    const interval = setInterval(() => {
      setOtpExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, otpExpirySeconds]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // STEP 1: Request OTP
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please provide a valid registered email address.");
      return;
    }

    try {
      setLoading(true);
      const res = await requestPasswordResetOtp(cleanEmail, role);

      const returnedMasked = res?.data?.email || cleanEmail;
      setMaskedEmail(returnedMasked);
      setOtpExpirySeconds(300);
      setCooldownSeconds(res?.data?.cooldownSeconds || 60);
      setStep("OTP");
      toast.success("Verification code dispatched to your registered email address.");

      // Focus first OTP input
      setTimeout(() => {
        if (otpInputsRef.current[0]) {
          otpInputsRef.current[0].focus();
        }
      }, 100);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to send verification code.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // OTP Input Handlers
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("");
      setOtpDigits(digits);
      otpInputsRef.current[5]?.focus();
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");

    const fullOtp = otpDigits.join("");
    if (fullOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (otpExpirySeconds <= 0) {
      setError("The verification code has expired. Please request a new code.");
      return;
    }

    try {
      setLoading(true);
      const res = await verifyPasswordResetOtp(
        { email: email.trim(), otp: fullOtp },
        role
      );

      const token = res?.data?.resetToken;
      if (!token) {
        throw new Error("No reset authorization token returned from server.");
      }

      setResetToken(token);
      setStep("PASSWORD");
      toast.success("Verification confirmed. Please choose a new password.");
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Invalid verification code.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Submit New Password
  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    setError("");

    if (!newPassword || newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await completePasswordReset(
        {
          resetToken,
          newPassword,
          confirmPassword,
        },
        role
      );

      // Clear memory token immediately!
      setResetToken("");
      setStep("SUCCESS");
      toast.success("Password reset successfully!");
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to reset password.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 selection:bg-orange-500 selection:text-white">
      {/* Background Decorative Blur */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-orange-500/10 via-rose-500/10 to-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-orange-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 transition-transform hover:scale-105 active:scale-95"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 via-rose-500 to-indigo-600 text-white shadow-lg shadow-orange-500/25">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              Campus<span className="text-orange-500">Flow</span>
            </span>
          </Link>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <KeyRound className="h-3.5 w-3.5 text-orange-400" />
            <span>Secure Password Recovery</span>
          </div>
        </div>

        {/* Card Container */}
        <div className="rounded-3xl border border-slate-700/60 bg-white/95 backdrop-blur-xl p-6 sm:p-8 text-slate-900 shadow-2xl shadow-black/40">
          {/* Role Header Indicator */}
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {step === "EMAIL" && "Forgot Password"}
                {step === "OTP" && "Verify Security Code"}
                {step === "PASSWORD" && "Create New Password"}
                {step === "SUCCESS" && "Password Reset Complete"}
              </h2>
              <p className="text-xs text-slate-500">
                {role === "admin" ? "Placement Officer (Admin)" : "Student Account"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
              {role === "admin" ? (
                <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
              ) : (
                <GraduationCap className="h-3.5 w-3.5 text-indigo-600" />
              )}
              <span className="capitalize">{role}</span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* STEP 1: ENTER REGISTERED EMAIL */}
          {step === "EMAIL" && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Enter your registered institutional or official email address. If an account matches, a single-use 6-digit verification code will be dispatched to your inbox.
              </p>

              <div>
                <label htmlFor="reset-field-1" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {role === "student" ? "Registered Student Email" : "Admin Official Email"}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input id="reset-field-1"
                    type="email"
                    required
                    autoFocus
                    placeholder={role === "student" ? "student@campusflow.edu" : "admin@campusflow.edu"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pr-3 pl-10 text-xs sm:text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 via-rose-600 to-indigo-700 hover:from-orange-500 hover:via-rose-500 hover:to-indigo-600 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-orange-600/20 transition-all duration-200 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to={`/login?role=${role}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: VERIFY OTP */}
          {step === "OTP" && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1">
                <span className="text-slate-500 block">Verification code sent to:</span>
                <span className="font-mono font-bold text-slate-800 text-sm block">
                  {maskedEmail}
                </span>
                <span className="text-[11px] text-slate-400 block pt-0.5">
                  Check your inbox and spam folder. Code is valid for 5 minutes.
                </span>
              </div>

              {/* 6 Digit Inputs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Enter 6-Digit Code
                </label>
                <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputsRef.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="\d*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className="h-11 w-11 sm:h-12 sm:w-12 text-center font-mono text-lg font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none transition shadow-2xs"
                    />
                  ))}
                </div>
              </div>

              {/* Timer & Resend */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Expires in:</span>
                  <span
                    className={`font-mono font-bold ${
                      otpExpirySeconds < 60 ? "text-rose-600 animate-pulse" : "text-slate-700"
                    }`}
                  >
                    {formatTimer(otpExpirySeconds)}
                  </span>
                </div>

                {cooldownSeconds > 0 ? (
                  <span className="text-[11px] text-slate-400 font-medium">
                    Resend in {cooldownSeconds}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={loading}
                    className="flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 transition cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Resend Code</span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || otpDigits.join("").length !== 6 || otpExpirySeconds <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 via-rose-600 to-indigo-700 hover:from-orange-500 hover:via-rose-500 hover:to-indigo-600 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-orange-600/20 transition-all duration-200 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep("EMAIL");
                    setOtpDigits(["", "", "", "", "", ""]);
                    setError("");
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  Change email address
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: ENTER NEW PASSWORD */}
          {step === "PASSWORD" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Code verified. Set a secure new password for your account. It must be at least 8 characters long.
              </p>

              <div>
                <label htmlFor="reset-field-2" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input id="reset-field-2"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pr-10 pl-10 text-xs sm:text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reset-field-3" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input id="reset-field-3"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pr-10 pl-10 text-xs sm:text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Requirement Checklist */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      newPassword.length >= 8 ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  <span className={newPassword.length >= 8 ? "text-emerald-700 font-semibold" : "text-slate-500"}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      newPassword && newPassword === confirmPassword ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  <span
                    className={
                      newPassword && newPassword === confirmPassword
                        ? "text-emerald-700 font-semibold"
                        : "text-slate-500"
                    }
                  >
                    Passwords match
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 via-rose-600 to-indigo-700 hover:from-orange-500 hover:via-rose-500 hover:to-indigo-600 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-orange-600/20 transition-all duration-200 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>Reset Password</span>
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {step === "SUCCESS" && (
            <div className="text-center py-4 space-y-4 animate-in fade-in zoom-in-95">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-xs">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Password Updated Successfully
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Your credentials have been securely updated. You can now log into your CampusFlow portal using your new password.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate(`/login?role=${role}`)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white py-2.5 text-xs sm:text-sm font-bold shadow-md transition"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
