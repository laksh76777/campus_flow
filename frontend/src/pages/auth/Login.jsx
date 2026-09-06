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
  Building2,
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
      console.error("Login failed:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Invalid credentials. Please verify your email and password.";
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
    setEmail("prakashchoyal85@gmail.com");
    setPassword("12345678");
    setError("");
    toast.success("Filled student credentials");
  };

  const fillDemoAdmin = () => {
    setRole("admin");
    setSearchParams({ role: "admin", redirect: "/admin-dashboard" });
    setEmail("sarangowda@gmail.com");
    setPassword("12345678");
    setError("");
    toast.success("Filled admin credentials");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
      {/* Dynamic ambient background glow circles */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl filter" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl filter" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-blue-900/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Top Logo & System Brand */}
        <div className="mb-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-white shadow-xl backdrop-blur-md transition hover:border-blue-500/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 font-bold text-white shadow-md shadow-blue-500/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="text-left">
              <span className="block text-sm font-bold tracking-tight text-white">
                Placement Portal
              </span>
              <span className="block text-[11px] font-medium text-slate-400">
                Placement Management System
              </span>
            </div>
          </Link>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
              <Sparkles className="h-3 w-3" /> Secure Access
            </span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Sign In to Portal
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Select your role to access your personalized placement dashboard
            </p>
          </div>

          {/* Role Segmented Tabs */}
          <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => {
                setRole("student");
                setError("");
                setSearchParams({ role: "student", redirect: "/student-dashboard" });
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all duration-200 ${
                role === "student"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Student
            </button>

            <button
              type="button"
              onClick={() => {
                setRole("admin");
                setError("");
                setSearchParams({ role: "admin", redirect: "/admin-dashboard" });
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all duration-200 ${
                role === "admin"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Admin / TPO
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                {role === "student" ? "Institute Email Address" : "Admin Email Address"}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder={role === "student" ? "student@example.com" : "admin@placement.edu"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-600 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <span className="text-[11px] text-blue-400 hover:underline cursor-pointer">
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pr-10 pl-10 text-sm text-white placeholder-slate-600 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Sign In as {role === "admin" ? "Admin" : "Student"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fillers for Evaluator */}
          <div className="mt-6 border-t border-slate-800/80 pt-4">
            <p className="text-center text-[11px] font-medium text-slate-500 mb-2.5">
              Quick 1-Click Demo Fill:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={fillDemoStudent}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-2 text-[11px] font-medium text-slate-400 hover:border-blue-500/40 hover:text-white transition"
              >
                <CheckCircle2 className="h-3 w-3 text-blue-400" />
                Student Demo
              </button>
              <button
                type="button"
                onClick={fillDemoAdmin}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-2 text-[11px] font-medium text-slate-400 hover:border-indigo-500/40 hover:text-white transition"
              >
                <CheckCircle2 className="h-3 w-3 text-indigo-400" />
                Admin Demo
              </button>
            </div>
          </div>

          {/* Register Link */}
          <div className="mt-6 text-center text-xs text-slate-400">
            Don&apos;t have a student account yet?{" "}
            <Link
              to="/signup"
              className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
            >
              Register as Student
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