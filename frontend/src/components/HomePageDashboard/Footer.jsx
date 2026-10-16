import { Link } from "react-router-dom";
import {
  Building2,
  ArrowUp,
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
                  CampusFlow
                </h3>
                <p className="text-xs text-slate-400">
                  College placement management
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-400 max-w-sm">
              A shared workspace for students and Training &amp; Placement teams to coordinate profiles, drives, applications, and placement activity.
            </p>

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
                <a href="#features" className="hover:text-blue-400 transition">
                  Features
                </a>
              </li>
              <li>
                <a href="#process" className="hover:text-blue-400 transition">
                  How It Works
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
                  to="/login"
                  className="hover:text-blue-400 transition flex items-center gap-1.5"
                >
                  <span>Sign In</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/signup"
                  className="hover:text-blue-400 transition flex items-center gap-1.5"
                >
                  <span>Student Registration</span>
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Subfooter */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800/80 pt-8 sm:flex-row text-xs">
          <p className="text-slate-500">
            © {currentYear} CampusFlow.
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