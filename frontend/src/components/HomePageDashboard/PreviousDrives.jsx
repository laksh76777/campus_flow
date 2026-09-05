import { Link } from "react-router-dom";
import {
  Briefcase,
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/authContextDef";

const featuredDrives = [
  {
    company: "Google",
    initial: "G",
    role: "Software Development Engineer",
    package: "₹24.0 LPA",
    location: "Bengaluru / Hyderabad",
    type: "Full-Time",
    branches: ["CSE", "IT", "ECE"],
    minCGPA: 7.5,
    status: "Active",
    deadline: "5 Days Left",
    color: "from-blue-600 to-indigo-600",
  },
  {
    company: "Microsoft",
    initial: "M",
    role: "Cloud Solution Engineer",
    package: "₹18.5 LPA",
    location: "Hyderabad / Noida",
    type: "Full-Time",
    branches: ["CSE", "IT", "ECE"],
    minCGPA: 7.0,
    status: "Active",
    deadline: "8 Days Left",
    color: "from-cyan-600 to-blue-600",
  },
  {
    company: "Amazon",
    initial: "A",
    role: "SDE Summer Intern 2026",
    package: "₹14.0 LPA",
    location: "Bengaluru",
    type: "Internship",
    branches: ["CSE", "IT"],
    minCGPA: 7.0,
    status: "Active",
    deadline: "3 Days Left",
    color: "from-amber-500 to-orange-600",
  },
  {
    company: "Atlassian",
    initial: "A",
    role: "Associate Software Engineer",
    package: "₹22.0 LPA",
    location: "Remote / Bengaluru",
    type: "Full-Time",
    branches: ["CSE", "IT", "ECE"],
    minCGPA: 8.0,
    status: "Upcoming",
    deadline: "10 Days Left",
    color: "from-blue-700 to-indigo-800",
  },
  {
    company: "Goldman Sachs",
    initial: "G",
    role: "Analyst – Technology",
    package: "₹25.0 LPA",
    location: "Bengaluru",
    type: "Full-Time",
    branches: ["CSE", "IT", "ECE", "EEE"],
    minCGPA: 8.0,
    status: "Upcoming",
    deadline: "14 Days Left",
    color: "from-slate-700 to-slate-900",
  },
  {
    company: "Adobe",
    initial: "A",
    role: "Product Intern & FTE",
    package: "₹21.0 LPA",
    location: "Noida / Bengaluru",
    type: "Full-Time",
    branches: ["CSE", "IT"],
    minCGPA: 7.8,
    status: "Active",
    deadline: "6 Days Left",
    color: "from-rose-600 to-red-600",
  },
];

export default function PreviousDrives() {
  const { isAuthenticated, userRole } = useAuth();
  const portalLink = !isAuthenticated
    ? "/login?role=student&redirect=/student-dashboard"
    : userRole === "admin"
    ? "/admin-dashboard"
    : "/student-dashboard";

  return (
    <section id="drives" className="bg-slate-50/75 py-16 sm:py-24 border-y border-slate-200/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-12">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-100">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              CAMPUS RECRUITMENT DRIVES
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Featured & Active Placement Drives
            </h2>
            <p className="mt-2 text-sm text-slate-600 max-w-xl">
              Verified corporate hiring drives with transparent criteria, competitive packages, and streamlined digital application tracking.
            </p>
          </div>

          <Link
            to={portalLink}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:border-blue-300 hover:text-blue-600 transition self-start md:self-auto"
          >
            <span>View All in Student Portal</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Drives Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredDrives.map((drive, idx) => (
            <div
              key={idx}
              className="group relative rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-200/80"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr ${drive.color} text-lg font-bold text-white shadow-md`}
                >
                  {drive.initial}
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                    drive.status === "Active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {drive.status === "Active" ? "● Live Drive" : "✓ Finished"}
                </span>
              </div>

              {/* Title & Company */}
              <div className="mt-4">
                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
                  {drive.company}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {drive.role}
                </p>
              </div>

              {/* Package Badge */}
              <div className="mt-3.5 inline-block rounded-xl bg-blue-50/80 px-3 py-1.5 text-sm font-extrabold text-blue-700 border border-blue-100">
                {drive.package} <span className="text-[11px] font-normal text-slate-500">CTC</span>
              </div>

              {/* Metadata details */}
              <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{drive.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700">{drive.deadline}</span>
                </div>
              </div>

              {/* Eligibility Badges */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {drive.branches.map((b, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                  >
                    {b}
                  </span>
                ))}
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/60">
                  Min {drive.minCGPA} CGPA
                </span>
              </div>

              {/* Action Button */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <Link
                  to={portalLink}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition group-hover:bg-blue-600 group-hover:text-white"
                >
                  <span>Apply via Portal</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}