import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Menu,
  X,
  LogIn,
  UserPlus,
  LayoutDashboard,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/authContextDef";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated, userRole, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", href: "#home" },
    { name: "Features", href: "#features" },
    { name: "How It Works", href: "#process" },
  ];

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? "border-b border-orange-200/90 bg-white/95 shadow-md backdrop-blur-md"
          : "border-b border-orange-100/90 bg-gradient-to-r from-orange-50/90 via-white/95 to-rose-50/80 backdrop-blur-sm"
      }`}
    >
      {/* Official JSS Institutional Top Ribbon (JSS Website Signature Reddish-Maroon & Gold Theme) */}
      <div className="bg-gradient-to-r from-red-950 via-red-900 to-orange-900 text-white text-[10px] sm:text-[11px] font-semibold py-1.5 px-4 border-b border-orange-800/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="font-bold tracking-wide">
              JSS Mahavidyapeetha • JSS Academy of Technical Education, Bengaluru
            </span>
          </div>
          <span className="hidden sm:inline text-orange-200/90 font-medium">
            Affiliated to VTU Belagavi • Approved by AICTE, New Delhi
          </span>
        </div>
      </div>

      <nav className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <a
          href="#home"
          onClick={closeMenu}
          className="group flex items-center gap-3 transition"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 via-rose-600 to-indigo-700 text-white shadow-md shadow-orange-600/20 transition-transform duration-300 group-hover:scale-105">
            <Building2 className="h-6 w-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-slate-900">
                CampusFlow
              </span>
              <span className="rounded-md bg-orange-100/80 px-1.5 py-0.2 text-[10px] font-extrabold text-orange-900 border border-orange-300/70">
                JSSATEB
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500">
              College Placement Management
            </p>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <div className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-semibold text-slate-600 transition-colors duration-200 hover:text-blue-600"
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* Desktop Auth / Dashboard Buttons */}
        <div className="hidden items-center gap-3 lg:flex">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                to={userRole === "admin" ? "/admin-dashboard" : "/student-dashboard"}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 active:scale-95"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>{userRole === "admin" ? "Admin Console" : "Student Dashboard"}</span>
              </Link>
              <button
                onClick={logout}
                className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-600"
              >
                <LogIn className="h-4 w-4 text-blue-600" />
                <span>Sign In</span>
              </Link>

              <Link
                to="/signup"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:from-blue-700 hover:to-indigo-700 active:scale-95"
              >
                <UserPlus className="h-4 w-4" />
                <span>Student Register</span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 lg:hidden"
          aria-label="Toggle Menu"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile Drawer Menu */}
      {isMenuOpen && (
        <div className="border-b border-slate-200 bg-white/95 px-5 pt-3 pb-6 backdrop-blur-xl lg:hidden animate-in slide-in-from-top-2">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={closeMenu}
                className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition"
              >
                <span>{link.name}</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </a>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            {isAuthenticated ? (
              <div className="space-y-2">
                <Link
                  to={userRole === "admin" ? "/admin-dashboard" : "/student-dashboard"}
                  onClick={closeMenu}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>{userRole === "admin" ? "Admin Console" : "My Dashboard"}</span>
                </Link>
                <button
                  onClick={() => {
                    closeMenu();
                    logout();
                  }}
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700"
                >
                  <LogIn className="h-4 w-4 text-blue-600" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/signup"
                  onClick={closeMenu}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Register</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}