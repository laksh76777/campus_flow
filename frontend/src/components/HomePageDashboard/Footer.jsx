import { Link } from "react-router-dom";
import {
  Building2,
  Heart,
  ArrowUp,
  ShieldCheck,
  GraduationCap,
  Briefcase,
} from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Placement Portal
                </h3>
                <p className="text-xs text-slate-400">
                  Campus Placement Management System
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-400 max-w-sm">
              An intelligent, transparent, and seamless campus placement portal connecting students with top global corporations, automating drive registrations, eligibility checks, and real-time application tracking.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-800 px-3 py-1 text-[11px] text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Backend API Connected
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#home" className="hover:text-blue-400 transition">
                  Home
                </a>
              </li>
              <li>
                <a href="#drives" className="hover:text-blue-400 transition">
                  Live Drives
                </a>
              </li>
              <li>
                <a href="#companies" className="hover:text-blue-400 transition">
                  Top Recruiters
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-blue-400 transition">
                  Placement Cell
                </a>
              </li>
            </ul>
          </div>

          {/* Portals */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Access Portals
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/login?role=student&redirect=/student-dashboard"
                  className="hover:text-blue-400 transition flex items-center gap-1.5"
                >
                  <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
                  <span>Student Portal</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/login?role=admin&redirect=/admin-dashboard"
                  className="hover:text-blue-400 transition flex items-center gap-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Admin / TPO Console</span>
                </Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-blue-400 transition">
                  Student Registration
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Office */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Contact Desk
            </h4>
            <div className="space-y-1.5 text-xs text-slate-400">
              <p>Training & Placement Office</p>
              <p className="text-slate-300">placements@university.edu</p>
              <p>Tel: +91 98765 43210</p>
              <p className="text-[11px] text-slate-500">Working hours: 9 AM - 5:30 PM</p>
            </div>
          </div>

        </div>

        {/* Bottom Subfooter */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800/80 pt-8 sm:flex-row text-xs">
          <p className="text-slate-500">
            © {currentYear} Placement Portal. All rights reserved. Built for engineering & management students.
          </p>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition"
          >
            <span>Back to top</span>
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}