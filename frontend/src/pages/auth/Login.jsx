import { useState, useEffect } from "react";
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
  Sparkles,
  CheckCircle2,
} from "lucide-react";

import { loginStudent, loginAdmin } from "../../services/authService";
import { useAuth } from "../../context/authContextDef";

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = searchParams.get("role") === "admin" ? "admin" : "student";
  const [role, setRole] = useState(initialRole);

  const navigate = useNavigate();
  const { login, isAuthenticated, userRole, loading: authLoading } = useAuth();

  // If already authenticated, redirect to their proper dashboard
  useEffect(() => {
    if (isAuthenticated && !authLoading && userRole) {
      if (userRole === "admin") {
        navigate("/admin-dashboard", { replace: true });
      } else if (userRole === "student") {
        navigate("/student-dashboard", { replace: true });
      }
    }
  }, [isAuthenticated, userRole, authLoading, navigate]);

  useEffect(() => {
    const queryRole = searchParams.get("role");
    if (queryRole === "admin" || queryRole === "student") {
      setRole(queryRole);
    }
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    try {
      setLoading(true);

      let resData;
      if (role === "student") {
        resData = await loginStudent({ email: email.trim(), password });
      } else {
        resData = await loginAdmin({ email: email.trim(), password });
      }

      const token = resData?.data?.accessToken || resData?.data?.token;
      const returnedUser = resData?.data?.user || resData?.data?.admin;
      // Authoritative role from the server DB response
      const actualRole =
        returnedUser?.role ||
        (resData?.data?.admin ? "admin" : role);

      const loggedUser = returnedUser || {
        fullName: actualRole === "admin" ? "Placement Officer (Admin)" : "Student User",
        email,
        role: actualRole,
      };

      if (token) {
        login(token, loggedUser, actualRole);
      }

      toast.success(
        `Welcome back, ${loggedUser.fullName || (actualRole === "admin" ? "Admin" : "Student")}!`
      );

      // Smart safe navigation: never route an admin to a student-only URL or vice versa!
      const redirectPath = searchParams.get("redirect");
      let targetDestination = actualRole === "admin" ? "/admin-dashboard" : "/student-dashboard";

      if (redirectPath && redirectPath !== "/" && redirectPath !== "/login") {
        const isStudentRoute =
          redirectPath.startsWith("/student") ||
          redirectPath.startsWith("/placement-drives") ||
          redirectPath.startsWith("/my-applications");
        const isAdminRoute = redirectPath.startsWith("/admin");

        if (actualRole === "admin" && !isStudentRoute) {
          targetDestination = redirectPath;
        } else if (actualRole === "student" && !isAdminRoute) {
          targetDestination = redirectPath;
        }
      }

      navigate(targetDestination, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Invalid credentials. Please verify your email and password.";
      console.warn("Login attempt failed.", err.response?.status ?? "network error");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Quick fill for testing & evaluator convenience
  const fillDemoStudent = () => {
    setRole("student");
    setSearchParams({ role: "student", redirect: "/student-dashboard" });
    setEmail("student@campusflow.edu");
    setPassword("Student@12345");
    setError("");
    toast.success("Filled student credentials (student@campusflow.edu)");
  };

  const fillDemoAdmin = () => {
    setRole("admin");
    setSearchParams({ role: "admin", redirect: "/admin-dashboard" });
    setEmail("admin@campusflow.edu");
    setPassword("Admin@12345");
    setError("");
    toast.success("Filled TPO admin credentials (admin@campusflow.edu)");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#FFF5EA] via-[#FAF1E4] to-[#F5E6D3] px-3 py-4 font-sans selection:bg-orange-500 selection:text-white sm:px-4 sm:py-6">
      {/* Soft warm light ambient glowing background shades */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-96 w-96 rounded-full bg-gradient-to-br from-amber-400/25 via-orange-300/20 to-transparent blur-3xl filter" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-gradient-to-tl from-orange-400/25 via-amber-300/20 to-transparent blur-3xl filter" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[450px] rounded-full bg-amber-300/15 blur-[120px]" />

      <div className="relative z-10 w-full max-w-[420px] my-auto">
        {/* Brand Header */}
        <div className="mb-3 text-center">
          <Link
            to="/"
            className="group inline-flex items-center gap-3 rounded-2xl border border-orange-200/80 bg-white/95 px-3.5 py-1.5 text-slate-800 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-orange-300 hover:shadow-md hover:shadow-orange-100"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1 border border-orange-200 shadow-2xs transition-transform duration-300 group-hover:scale-105">
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
                <span className="text-sm font-black tracking-tight text-slate-900">
                  CampusFlow
                </span>
                <span className="rounded-md bg-orange-100 px-1.5 py-0.2 text-[9px] font-extrabold text-orange-900 border border-orange-200">
                  JSSATEB
                </span>
              </div>
              <span className="block text-[10px] font-medium text-slate-500">
                Placement Management Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Main Card (Light Theme - Centered & Optimized Height) */}
        <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-5 shadow-xl shadow-orange-950/5 backdrop-blur-sm sm:p-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-800 shadow-2xs">
              <Sparkles className="h-3 w-3 text-orange-600" />
              <span>Authorized Portal Access</span>
            </span>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              Sign In to Portal
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Select your role to access your personalized placement dashboard
            </p>
          </div>

          {/* Role Segmented Tabs (Light Theme) */}
          <div className="mt-3.5 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100/80 p-1">
            <button
              type="button"
              onClick={() => {
                setRole("student");
                setError("");
                setSearchParams({ role: "student", redirect: "/student-dashboard" });
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition-all duration-200 ${
                role === "student"
                  ? "bg-gradient-to-r from-orange-600 via-rose-600 to-indigo-700 text-white shadow-sm shadow-orange-600/25 ring-1 ring-orange-500/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Student</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRole("admin");
                setError("");
                setSearchParams({ role: "admin", redirect: "/admin-dashboard" });
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition-all duration-200 ${
                role === "admin"
                  ? "bg-gradient-to-r from-red-800 via-orange-700 to-amber-600 text-white shadow-sm shadow-orange-700/25 ring-1 ring-amber-500/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Admin / TPO</span>
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 animate-in fade-in">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500 mt-1 shrink-0" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="mt-3.5 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                {role === "student" ? "College Email or USN" : "Admin Official Email Address"}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder={role === "student" ? "student@campusflow.edu" : "admin@campusflow.edu"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pr-3 pl-9 text-xs sm:text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700">Password</label>
                <span className="text-[10px] font-medium text-orange-600 hover:text-orange-700 hover:underline cursor-pointer">
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pr-9 pl-9 text-xs sm:text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:outline-none"
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

            <button
              type="submit"
              disabled={loading}
              className={`mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition-all duration-200 active:scale-[0.99] disabled:opacity-60 ${
                role === "admin"
                  ? "bg-gradient-to-r from-red-800 via-orange-700 to-amber-600 hover:from-red-700 hover:via-orange-600 hover:to-amber-500 shadow-orange-700/20"
                  : "bg-gradient-to-r from-orange-600 via-rose-600 to-indigo-700 hover:from-orange-500 hover:via-rose-500 hover:to-indigo-600 shadow-orange-600/20"
              }`}
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Sign In as {role === "admin" ? "Placement Admin" : "Student"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fillers for Evaluator (Compact Light Theme) */}
          <div className="mt-3.5 border-t border-slate-100 pt-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                Quick 1-Click Demo Fill:
              </p>
              <span className="text-[9px] text-orange-700 font-semibold bg-orange-100/70 px-1.5 py-0.2 rounded-full border border-orange-200">
                Evaluator Mode
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={fillDemoStudent}
                className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-center transition-all duration-200 hover:border-orange-400 hover:bg-orange-50/40 hover:shadow-2xs"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold text-orange-600 group-hover:text-orange-700">
                  <CheckCircle2 className="h-3 w-3 text-orange-600" />
                  <span>Student Demo</span>
                </div>
                <span className="mt-0.5 text-[9px] text-slate-700 font-mono">student@campusflow.edu</span>
                <span className="text-[9px] text-slate-400 font-mono">Student@12345</span>
              </button>

              <button
                type="button"
                onClick={fillDemoAdmin}
                className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-center transition-all duration-200 hover:border-amber-400 hover:bg-amber-50/40 hover:shadow-2xs"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 group-hover:text-amber-800">
                  <CheckCircle2 className="h-3 w-3 text-amber-600" />
                  <span>Admin / TPO</span>
                </div>
                <span className="mt-0.5 text-[9px] text-slate-700 font-mono">admin@campusflow.edu</span>
                <span className="text-[9px] text-slate-400 font-mono">Admin@12345</span>
              </button>
            </div>
          </div>

          {/* Register Link */}
          <div className="mt-3 text-center text-[11px] text-slate-500">
            Don&apos;t have a student account yet?{" "}
            <Link
              to="/signup"
              className="font-bold text-orange-600 hover:text-orange-700 hover:underline transition"
            >
              Register as Student
            </Link>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-2.5 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-800"
          >
            ← Return to College Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}