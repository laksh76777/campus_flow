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
    <section id="home" className="relative overflow-hidden py-16 sm:py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[32rem] max-w-6xl bg-gradient-to-b from-blue-50 via-indigo-50/40 to-transparent blur-3xl" />
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
            <Users className="h-4 w-4" />
            College placement management
          </div>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Placement activities,{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              organized in one place.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 lg:mx-0 lg:text-lg">
            CampusFlow helps students and Training &amp; Placement teams manage academic profiles,
            recruitment drives, applications, and placement activity through one shared platform.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            {isAuthenticated ? (
              <Link
                to={dashboardPath}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                Open your dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                >
                  Sign in <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
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

        <div aria-label="Illustration of CampusFlow placement workspace" className="mx-auto w-full max-w-xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10 sm:p-7">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-slate-900">CampusFlow workspace</p>
                <p className="text-xs text-slate-500">Placement activity overview</p>
              </div>
              <span className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {workspaceItems.map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>One coordinated workflow</span>
                <span className="text-blue-700">Student ↔ TPO</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Profiles, drives, applications, and outcomes</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
