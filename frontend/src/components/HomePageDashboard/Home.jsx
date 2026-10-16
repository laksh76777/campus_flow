import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  BriefcaseBusiness,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/authContextDef";

const workspaceItems = [
  { icon: GraduationCap, label: "Student profiles", color: "text-blue-600 bg-blue-50" },
  { icon: BriefcaseBusiness, label: "Placement drives", color: "text-indigo-600 bg-indigo-50" },
  { icon: ClipboardCheck, label: "Eligibility & applications", color: "text-emerald-600 bg-emerald-50" },
  { icon: FileText, label: "Documents & reports", color: "text-violet-600 bg-violet-50" },
];

export default function Home() {
  const { isAuthenticated, userRole } = useAuth();
  const dashboardPath = userRole === "admin" ? "/admin-dashboard" : "/student-dashboard";

  return (
    <section id="home" className="relative overflow-hidden py-10 sm:py-14 lg:py-18">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[32rem] max-w-6xl bg-gradient-to-b from-orange-50/60 via-indigo-50/30 to-transparent blur-3xl" />

      {/* SINGLE, WIDE, PERFECTLY CENTERED JSSATEB INSTITUTIONAL HERO BANNER */}
      <div className="mx-auto mb-10 sm:mb-12 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 rounded-3xl border border-orange-200/90 bg-gradient-to-r from-orange-50/95 via-white to-amber-50/90 p-4 sm:p-5 shadow-lg shadow-orange-950/5 backdrop-blur-md transition-all hover:border-orange-300">
          {/* Logo & Full Institutional Details */}
          <div className="flex items-center gap-3.5 sm:gap-4.5 min-w-0 text-center sm:text-left">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 border border-orange-200/80 shadow-xs">
              <img
                src="/images/jssateb/college-logo.png"
                alt="JSS Academy of Technical Education, Bengaluru Emblem"
                className="h-full w-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-slate-900">
                  JSS Academy of Technical Education, Bengaluru
                </h2>
                <span className="rounded-full bg-gradient-to-r from-orange-600 to-rose-600 px-3 py-0.5 text-[10px] sm:text-xs font-black text-white shadow-xs">
                  Official Placement Portal
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-600">
                JSS Mahavidyapeetha, Mysuru • Affiliated to VTU Belagavi • Established 1997
              </p>
            </div>
          </div>

          {/* Verified Campus Thumbnail & Location */}
          <div className="hidden sm:flex items-center gap-3 shrink-0 pl-0 sm:pl-4 border-t sm:border-t-0 sm:border-l border-orange-200/80 pt-3 sm:pt-0">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-slate-800">Main Campus</p>
              <p className="text-[11px] text-slate-500">Uttarahalli–Kengeri Road</p>
            </div>
            <div className="relative h-12 w-20 sm:w-24 shrink-0 overflow-hidden rounded-xl border border-orange-200 shadow-2xs group">
              <img
                src="/images/jssateb/campus-main.jpg"
                alt="JSSATE Bengaluru Campus"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Hero Section */}
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        {/* Left Column: Heading, Value Proposition & Actions */}
        <div className="text-center lg:text-left">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Placement activities,{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              organized in one place.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 lg:mx-0 lg:text-lg">
            CampusFlow helps students and Training &amp; Placement teams at JSSATEB manage academic profiles,
            recruitment drives, applications, and placement activity through one shared platform.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            {isAuthenticated ? (
              <Link
                to={dashboardPath}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 active:scale-95"
              >
                Open your dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 active:scale-95"
                >
                  Sign in <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 active:scale-95"
                >
                  Student registration
                </Link>
              </>
            )}
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
            >
              Explore the platform <ArrowDown className="h-4 w-4" />
            </a>
          </div>

          <p className="mt-5 text-xs text-slate-500">
            Access and available actions depend on your student or TPO account.
          </p>
        </div>

        {/* Right Column: High-Impact JSS Placement Workspace Card */}
        <div aria-label="Illustration of JSS placement workspace" className="mx-auto w-full max-w-xl">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-2xl shadow-slate-900/10 transition-all hover:border-slate-300">
            {/* Workspace Card Header with JSS Branding */}
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-600 via-rose-600 to-indigo-600 text-white shadow-md shadow-orange-600/20">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight truncate">
                    JSS Career &amp; Placement Hub
                  </h3>
                  <span className="rounded-md bg-orange-100 px-1.5 py-0.2 text-[10px] font-extrabold text-orange-900 border border-orange-200 shrink-0">
                    JSSATEB
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                  Real-time Recruitment &amp; Student Progression
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0" title="Live drive session active">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-700 hidden sm:inline">Active</span>
              </div>
            </div>

            {/* Modules Grid */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {workspaceItems.map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:bg-slate-50 hover:border-slate-200">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{label}</span>
                </div>
              ))}
            </div>

            {/* Bottom Status Banner */}
            <div className="mt-4 rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50/50 to-indigo-50 p-4 border border-orange-100/80">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Unified Campus Workflow</span>
                <span className="text-orange-700 font-extrabold">Student ↔ TPO Admin</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">
                Verified profiles, drives, shortlisting, and placement offers
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
