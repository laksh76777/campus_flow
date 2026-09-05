import { Link } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  Building,
  GraduationCap,
  Award,
  CheckCircle2,
  Briefcase,
  ShieldCheck,
  Calendar,
} from "lucide-react";

export default function Home() {
  return (
    <section id="home" className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-full max-w-7xl">
        <div className="absolute top-10 left-10 h-72 w-72 rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute top-20 right-10 h-80 w-80 rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          
          {/* Left Column: Hero Copy & Value Proposition */}
          <div className="text-center lg:col-span-7 lg:text-left">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-xs font-bold text-blue-700 shadow-xs backdrop-blur-xs">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              <span>Campus Recruitment Season 2025–26 Is Live</span>
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            </div>

            {/* Main Catchy Heading */}
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Elevate Your Career with{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                World-Class
              </span>{" "}
              Opportunities
            </h1>

            {/* Subheading */}
            <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-600 max-w-2xl mx-auto lg:mx-0">
              The premier campus recruitment ecosystem connecting top tier engineering and
              management graduates with Fortune 500 enterprises and high-growth tech innovators.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <a
                href="#drives"
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/30 active:scale-95"
              >
                <span>Explore Live Drives</span>
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                to="/student-dashboard"
                className="flex items-center gap-2 rounded-2xl border border-slate-300/80 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
              >
                <GraduationCap className="h-4 w-4 text-blue-600" />
                <span>Student Portal</span>
              </Link>

              <Link
                to="/login"
                className="flex items-center gap-1.5 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
              >
                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                <span>Admin Login</span>
              </Link>
            </div>

            {/* Live Trust Metrics Ribbon */}
            <div className="mt-12 grid grid-cols-3 gap-4 border-t border-slate-200/80 pt-8 sm:gap-8">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  120+
                </div>
                <div className="mt-0.5 text-xs font-semibold text-slate-500">
                  Hiring Partners
                </div>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 tracking-tight">
                  ₹44.5 LPA
                </div>
                <div className="mt-0.5 text-xs font-semibold text-slate-500">
                  Highest Package
                </div>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  96.8%
                </div>
                <div className="mt-0.5 text-xs font-semibold text-slate-500">
                  Placement Rate
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Live Preview Card */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              
              {/* Decorative corner accent */}
              <div className="absolute -top-4 -right-4 h-24 w-24 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-500 opacity-20 blur-xl" />

              {/* Main Container Card */}
              <div className="relative rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-xl backdrop-blur-xl sm:p-7">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Live Recruitment Pulse
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Real-time student & drive statistics
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Active
                  </span>
                </div>

                {/* Drive Feature Pill 1 */}
                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:bg-blue-50/40 hover:border-blue-200/60">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        Top Recruiter
                      </span>
                      <h4 className="mt-1 text-sm font-bold text-slate-900">
                        Google India • SDE 1
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        CTC: <span className="font-bold text-slate-800">₹24.0 LPA</span> • Bengaluru
                      </p>
                    </div>
                    <span className="rounded-xl bg-white px-2.5 py-1 text-[11px] font-bold text-blue-600 shadow-xs border border-slate-200/60">
                      Eligible
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" /> Closes in 4 days
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3 text-slate-400" /> Full Time
                    </span>
                  </div>
                </div>

                {/* Drive Feature Pill 2 */}
                <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:bg-indigo-50/40 hover:border-indigo-200/60">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        Cloud & AI
                      </span>
                      <h4 className="mt-1 text-sm font-bold text-slate-900">
                        Microsoft • Cloud Solution Engineer
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        CTC: <span className="font-bold text-slate-800">₹18.5 LPA</span> • Hyderabad
                      </p>
                    </div>
                    <span className="rounded-xl bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-600 shadow-xs border border-slate-200/60">
                      Shortlisted
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" /> Assessment Today
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Round 2
                    </span>
                  </div>
                </div>

                {/* Bottom Highlight Stat Banner */}
                <div className="mt-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-slate-400">
                        Median Package Offered
                      </p>
                      <h4 className="text-xl font-bold tracking-tight text-white">
                        ₹11.2 LPA
                      </h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-medium text-emerald-400 flex items-center gap-1 justify-end">
                        <TrendingUp className="h-3.5 w-3.5" /> +18.4% YoY
                      </p>
                      <span className="text-[11px] text-slate-400">
                        B.Tech / MCA / M.Tech
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}