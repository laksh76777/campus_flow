import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Sparkles,
  GraduationCap,
  ArrowRight,
  RefreshCw,
  Award,
  ShieldCheck,
  ExternalLink,
  Plus,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Trophy,
} from "lucide-react";

import StudentSidebar from "../../components/studentDashboard/StudentSidebar";
import StudentNavbar from "../../components/studentDashboard/StudentNavbar";
import DashboardStats from "../../components/studentDashboard/DashboardStats";
import RecentDrives from "../../components/studentDashboard/RecentDrives";
import RecentApplications from "../../components/studentDashboard/RecentApplications";
import ApplyModal from "../../components/studentDashboard/ApplyModal";
import ProfileDrawer from "../../components/studentDashboard/ProfileDrawer";

import {
  getStudentDashboardStats,
  getCurrentStudentProfile,
  getMyEligibleDrives,
  getMyApplications,
  applyForDrive,
  withdrawApplication,
} from "../../services/studentService";
import { useAuth } from "../../context/authContextDef";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user: authUser, userRole, logout, studentProfile: authProfile } = useAuth();

  // If logged-in user is an admin, immediately redirect to Admin Console and avoid student calls
  useEffect(() => {
    const currentRole = userRole || localStorage.getItem("userRole") || authUser?.role;
    if (currentRole === "admin") {
      navigate("/admin-dashboard", { replace: true });
    }
  }, [userRole, authUser, navigate]);

  // Navigation and UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // overview | drives | applications | profile
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  // Apply Modal State
  const [selectedDriveToApply, setSelectedDriveToApply] = useState(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  // Live Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [eligibleDrives, setEligibleDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [user, setUser] = useState(null);

  // Load all dashboard data
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    const currentRole = userRole || localStorage.getItem("userRole") || authUser?.role;
    if (currentRole === "admin") {
      navigate("/admin-dashboard", { replace: true });
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch Student Profile
      try {
        const profileRes = await getCurrentStudentProfile();
        if (profileRes.data) {
          setStudentProfile(profileRes.data);
          if (profileRes.data.user) setUser(profileRes.data.user);
        }
      } catch (err) {
        console.warn("Student profile note:", err.message);
      }

      // 2. Fetch Dashboard Stats
      try {
        const statsRes = await getStudentDashboardStats();
        if (statsRes.data) {
          setDashboardStats(statsRes.data);
          if (statsRes.data.upcomingDrives?.length > 0) {
            setEligibleDrives(statsRes.data.upcomingDrives);
          }
          if (statsRes.data.recentApplications?.length > 0) {
            setApplications(statsRes.data.recentApplications);
          }
        }
      } catch (err) {
        console.warn("Dashboard stats note:", err.message);
      }

      // 3. Fetch Eligible Drives directly
      try {
        const drivesRes = await getMyEligibleDrives();
        if (Array.isArray(drivesRes?.data)) {
          setEligibleDrives(drivesRes.data);
        }
      } catch (err) {
        console.warn("Eligible drives note:", err.message);
      }

      // 4. Fetch All Applications
      try {
        const appsRes = await getMyApplications();
        if (Array.isArray(appsRes?.data)) {
          setApplications(appsRes.data);
        }
      } catch (err) {
        console.warn("Applications note:", err.message);
      }
    } catch (error) {
      console.error("Dashboard data load error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Derived drive lists & applied drive IDs
  // ONLY non-withdrawn applications count as applied!
  const appliedDriveIds = useMemo(() => {
    const ids = new Set();
    applications.forEach((app) => {
      if (app.status && app.status !== "withdrawn") {
        const id = app.placementDrive?._id || app.placementDrive;
        if (id) {
          ids.add(id);
          ids.add(String(id));
        }
      }
    });
    return ids;
  }, [applications]);

  // Drives where the student previously applied but has now withdrawn
  const withdrawnDriveIds = useMemo(() => {
    const ids = new Set();
    applications.forEach((app) => {
      if (app.status === "withdrawn") {
        const id = app.placementDrive?._id || app.placementDrive;
        if (id) {
          ids.add(id);
          ids.add(String(id));
        }
      }
    });
    return ids;
  }, [applications]);

  const activeDrivesList = eligibleDrives;
  const activeApplicationsList = applications;

  // Compute aggregated stats
  const aggregatedStats = useMemo(() => {
    if (dashboardStats?.applications) {
      return dashboardStats;
    }
    return {
      placementDrives: {
        activeEligible: activeDrivesList.length,
        eligible: activeDrivesList.length,
        upcoming: activeDrivesList.length,
      },
      applications: {
        total: activeApplicationsList.length,
        applied: activeApplicationsList.filter((a) => a.status === "applied").length,
        shortlisted: activeApplicationsList.filter((a) => a.status === "shortlisted").length,
        interview: activeApplicationsList.filter((a) => a.status === "interview").length,
        selected: activeApplicationsList.filter((a) => a.status === "selected").length,
        rejected: activeApplicationsList.filter((a) => a.status === "rejected").length,
        withdrawn: activeApplicationsList.filter((a) => a.status === "withdrawn").length,
      },
    };
  }, [dashboardStats, activeDrivesList, activeApplicationsList]);

  // Profile readiness calculation (0-100%) and missing requirements
  const profileScore = useMemo(() => {
    if (dashboardStats?.profileScore?.checklist) {
      return dashboardStats.profileScore;
    }

    const checklist = [
      { field: "Basic Details", completed: Boolean(studentProfile?.enrollmentNumber && (user?.fullName || authUser?.fullName)), points: 15, hint: "Name & Enrollment number" },
      { field: "Contact Info", completed: Boolean(user?.email && (user?.phone || studentProfile?.phone)), points: 10, hint: "Email & Phone number" },
      { field: "Academic Standing", completed: Boolean(studentProfile?.branch && studentProfile?.cgpa), points: 25, hint: "Branch & CGPA" },
      { field: "10th & 12th Marks", completed: Boolean(studentProfile?.tenthPercentage && studentProfile?.twelfthPercentage), points: 15, hint: "Board exam percentages" },
      { field: "Skills Portfolio", completed: Boolean(studentProfile?.skills && studentProfile.skills.length >= 3), points: 15, hint: "Add at least 3 skills" },
      { field: "Verified Resume", completed: Boolean(studentProfile?.resume?.url), points: 20, hint: "Uploaded verified resume" }
    ];

    const percentage = checklist.reduce((acc, c) => (c.completed ? acc + c.points : acc), 0);
    const missingItems = checklist.filter((c) => !c.completed);
    return { percentage, checklist, missingItems };
  }, [dashboardStats, studentProfile, user, authUser]);

  // Scheduled upcoming interviews
  const upcomingInterviews = useMemo(() => {
    if (dashboardStats?.upcomingInterviews && dashboardStats.upcomingInterviews.length > 0) {
      return dashboardStats.upcomingInterviews;
    }
    return applications.filter((app) => app.status === "interview");
  }, [dashboardStats, applications]);

  // Secured corporate placement offer details (if any)
  const offerDetails = useMemo(() => {
    if (dashboardStats?.offerDetails) return dashboardStats.offerDetails;
    const selectedApp = applications.find((app) => app.status === "selected");
    if (!selectedApp) return null;
    const drive = selectedApp.placementDrive || {};
    const company = typeof drive.company === "object" ? drive.company?.companyName : drive.companyName || "Corporate Partner";
    return {
      companyName: company,
      jobTitle: drive.jobTitle || "Software Engineer",
      package: selectedApp.offeredPackage || drive.package || 18,
      selectedAt: selectedApp.statusUpdatedAt || selectedApp.updatedAt
    };
  }, [dashboardStats, applications]);

  // Apply Handler
  const handleOpenApplyModal = (drive) => {
    setSelectedDriveToApply(drive);
    setIsApplyModalOpen(true);
  };

  const handleConfirmApply = async (driveId) => {
    try {
      await applyForDrive(driveId);
      toast.success("Application submitted successfully!");
      loadDashboardData(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to submit application";
      toast.error(msg);
      throw err;
    }
  };

  // Withdraw Handler
  const handleWithdraw = async (applicationId, companyName) => {
    const confirm = window.confirm(
      `Are you sure you want to withdraw your application for ${companyName}?`
    );
    if (!confirm) return;

    try {
      await withdrawApplication(applicationId);
      toast.success(`Withdrawn application for ${companyName}`);
      loadDashboardData(true);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to withdraw application";
      toast.error(msg);
    }
  };

  // Logout
  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const studentName =
    user?.fullName || authUser?.fullName || studentProfile?.user?.fullName || "Student";
  const studentBranch = studentProfile?.branch || authProfile?.branch || "Department Not Set";
  const studentCgpa = studentProfile?.cgpa ?? authProfile?.cgpa ?? "--";
  const graduationYear = studentProfile?.graduationYear ?? authProfile?.graduationYear ?? "----";

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex antialiased">
      {/* 
        Responsive Sidebar: 
        On desktop (>= 1024px), it is a normal flex child (sticky, w-64 xl:w-72), so it CANNOT overlap content!
        On mobile (< 1024px), it is hidden until toggled as a slide-out drawer.
      */}
      <StudentSidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        studentProfile={studentProfile}
        onLogout={handleLogout}
      />

      {/* Main Layout Area: Fills 100% of remaining width */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Sticky Header */}
        <StudentNavbar
          onMenuClick={() => setIsSidebarOpen(true)}
          activeTab={activeTab}
          user={user}
          studentProfile={studentProfile}
          onOpenProfile={() => setIsProfileDrawerOpen(true)}
        />

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 w-full max-w-7xl mx-auto">
          {/* Top Greeting Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Welcome back, {studentName} 👋
              </h2>
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
                {studentBranch} • Batch of {graduationYear} • Academic CGPA: {studentCgpa}
              </p>
            </div>

            {/* Top Right Action Controls */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => loadDashboardData(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 disabled:opacity-60 transition"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`}
                />
                <span>{refreshing ? "Syncing..." : "Sync Live Data"}</span>
              </button>

              <button
                onClick={() => setIsProfileDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span>My Profile</span>
              </button>
            </div>
          </div>

          {/* Complete Profile Notice (if student profile is pending) */}
          {!studentProfile && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-4 sm:p-5 text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Sparkles className="h-5 w-5 text-yellow-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold leading-snug">
                    Complete your Placement Profile
                  </h4>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Verify your CGPA, branch, and upload your resume to unlock company eligibility checks.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsProfileDrawerOpen(true)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-blue-700 shadow-xs hover:bg-blue-50 transition"
              >
                <span>Complete Profile</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Placed Student Offer Celebration Banner */}
              {offerDetails && (
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 p-6 text-white shadow-xl animate-in fade-in-50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner text-3xl">
                        🎉
                      </div>
                      <div>
                        <span className="rounded-full bg-emerald-400/20 px-3 py-0.5 text-xs font-bold text-emerald-200 border border-emerald-300/30">
                          Official Placement Offer Extended
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                          Congratulations, {studentName}!
                        </h3>
                        <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">
                          Selected as <strong>{offerDetails.jobTitle}</strong> at <strong>{offerDetails.companyName}</strong> with a confirmed offer package of <strong>₹{offerDetails.package} LPA</strong>.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab("applications")}
                      className="shrink-0 rounded-2xl bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-emerald-800 shadow-md hover:bg-emerald-50 transition active:scale-95"
                    >
                      View Offer Details
                    </button>
                  </div>
                </div>
              )}

              {/* Scheduled Upcoming Interviews Widget */}
              {upcomingInterviews.length > 0 && (
                <div className="rounded-3xl border border-purple-200/90 bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/40 p-5 sm:p-6 shadow-xs animate-in fade-in-50">
                  <div className="flex items-center justify-between pb-3 border-b border-purple-100">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Upcoming Scheduled Interviews ({upcomingInterviews.length})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Live candidate evaluations & technical rounds
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">
                      Active Next Round
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {upcomingInterviews.map((app) => {
                      const drive = app.placementDrive || {};
                      const comp =
                        drive.company?.companyName || drive.companyName || "Corporate Partner";
                      return (
                        <div
                          key={app._id}
                          className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs flex flex-col justify-between gap-3 hover:border-purple-300 transition"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-slate-900 text-sm">{comp}</h4>
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                {app.interviewRound || "Technical Round"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{drive.jobTitle || "Engineering Position"}</p>

                            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                              <span className="flex items-center gap-1 font-semibold text-purple-800">
                                <Clock className="h-3.5 w-3.5" />
                                <span>
                                  {app.interviewDate
                                    ? new Date(app.interviewDate).toLocaleString("en-IN", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "Date to be announced"}
                                </span>
                              </span>

                              {app.interviewLocation && (
                                <span className="flex items-center gap-1 text-slate-500 truncate max-w-xs">
                                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{app.interviewLocation}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Profile Completion Readiness Card (if incomplete) */}
              {profileScore.percentage < 100 && (
                <div className="rounded-3xl border border-blue-200/90 bg-gradient-to-br from-blue-50/60 via-white to-slate-50 p-5 sm:p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                          <Sparkles className="h-4 w-4" />
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          Placement Profile Readiness: {profileScore.percentage}% Complete
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 max-w-xl">
                        Verified profiles unlock company eligibility screening. Complete your missing items to apply for all top-tier corporate drives.
                      </p>

                      {/* Missing items chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                        {profileScore.missingItems.map((item) => (
                          <button
                            key={item.field}
                            onClick={() => setIsProfileDrawerOpen(true)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition"
                          >
                            <span>+ Complete {item.field}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Readiness gauge bar */}
                    <div className="w-full sm:w-48 shrink-0 text-center sm:text-right">
                      <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden mb-1.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-700"
                          style={{ width: `${profileScore.percentage}%` }}
                        />
                      </div>
                      <button
                        onClick={() => setIsProfileDrawerOpen(true)}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Edit Profile &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Stat Metric Cards */}
              <DashboardStats
                stats={aggregatedStats}
                studentProfile={studentProfile}
                onTabChange={setActiveTab}
                loading={loading}
              />

              {/* Two Column Grid: Eligible Drives & Applications Tracker */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Left Card: Active Eligible Drives */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <RecentDrives
                    drives={activeDrivesList}
                    appliedDriveIds={appliedDriveIds}
                    withdrawnDriveIds={withdrawnDriveIds}
                    onApplyClick={handleOpenApplyModal}
                    title="Active Eligible Drives"
                    description="Opportunities open for your branch and CGPA"
                    showSearch={false}
                    maxItems={2}
                  />
                  <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                    <button
                      onClick={() => setActiveTab("drives")}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <span>Explore all {activeDrivesList.length} placement drives</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Right Card: Recent Applications Pipeline */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <RecentApplications
                    applications={activeApplicationsList}
                    onWithdraw={handleWithdraw}
                    title="Recent Application Pipeline"
                    description="Your latest submissions and status updates"
                    showSearch={false}
                    maxItems={3}
                  />
                  <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                    <button
                      onClick={() => setActiveTab("applications")}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <span>View complete application history</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLACEMENT DRIVES */}
          {activeTab === "drives" && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
              <RecentDrives
                drives={activeDrivesList}
                appliedDriveIds={appliedDriveIds}
                withdrawnDriveIds={withdrawnDriveIds}
                onApplyClick={handleOpenApplyModal}
                title="All Eligible Placement Drives"
                description="Live recruitment drives filtered by your eligibility criteria"
                showSearch={true}
              />
            </div>
          )}

          {/* TAB 3: MY APPLICATIONS */}
          {activeTab === "applications" && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
              <RecentApplications
                applications={activeApplicationsList}
                onWithdraw={handleWithdraw}
                title="My Applications History"
                description="Real-time recruitment status updates from visiting companies"
                showSearch={true}
              />
            </div>
          )}

          {/* TAB 4: ACADEMIC PROFILE */}
          {activeTab === "profile" && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Academic Profile</h3>
                  <p className="text-xs text-slate-500">
                    Your verified credentials used for campus placements
                  </p>
                </div>
                <button
                  onClick={() => setIsProfileDrawerOpen(true)}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  Edit Portfolio
                </button>
              </div>

              {/* Stats overview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">CGPA</span>
                  <p className="text-xl font-extrabold text-slate-900 mt-1">{studentCgpa}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">10th Std</span>
                  <p className="text-xl font-extrabold text-blue-600 mt-1">
                    {studentProfile?.tenthPercentage != null ? `${studentProfile.tenthPercentage}%` : "--"}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">12th Std</span>
                  <p className="text-xl font-extrabold text-indigo-600 mt-1">
                    {studentProfile?.twelfthPercentage != null ? `${studentProfile.twelfthPercentage}%` : "--"}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Backlogs</span>
                  <p className="text-xl font-extrabold text-emerald-600 mt-1">
                    {studentProfile?.backlogs ?? 0}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Semester</span>
                  <p className="text-xl font-extrabold text-slate-900 mt-1">
                    {studentProfile?.semester ?? 6}th
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Graduation</span>
                  <p className="text-xl font-extrabold text-slate-900 mt-1">{graduationYear}</p>
                </div>
              </div>

              {/* Details table */}
              <div className="rounded-xl border border-slate-100 p-5 space-y-3 bg-slate-50/50 text-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Personal & Program Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <span className="text-slate-400">Full Name: </span>
                    <strong className="text-slate-800">{studentName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Email Address: </span>
                    <strong className="text-slate-800">{user?.email || "student@college.edu"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Enrollment ID: </span>
                    <strong className="text-slate-800">
                      {studentProfile?.enrollmentNumber || "ENR-2022-CS01"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Department: </span>
                    <strong className="text-slate-800">{studentBranch}</strong>
                  </div>
                </div>
              </div>

              {/* Verified Certificates & Credentials Section */}
              <div className="rounded-2xl border border-slate-100 p-5 sm:p-6 bg-slate-50/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Award className="h-4 w-4 text-amber-500" />
                      <span>Certificates & External Credentials</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-100">
                        {studentProfile?.certificates?.length || 0}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Verified professional credentials and online certifications
                    </p>
                  </div>

                  <button
                    onClick={() => setIsProfileDrawerOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5 text-blue-600" />
                    <span>Manage</span>
                  </button>
                </div>

                {!studentProfile?.certificates || studentProfile.certificates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
                    <Award className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">
                      No certifications added yet
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Add your certifications and verification links to impress campus recruiters.
                    </p>
                    <button
                      onClick={() => setIsProfileDrawerOpen(true)}
                      className="mt-3 inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition border border-blue-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Credentials</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {studentProfile.certificates.map((cert, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-blue-200 transition flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                            <Award className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-bold text-xs text-slate-900 leading-tight truncate">
                              {cert.title}
                            </h5>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                              {cert.issuer || "Issuing Body"}
                              {cert.issueDate ? ` • ${cert.issueDate}` : ""}
                            </p>
                            {cert.credentialId && (
                              <span className="inline-block mt-1 font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                ID: {cert.credentialId}
                              </span>
                            )}
                          </div>
                        </div>

                        {cert.certificateUrl ? (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>Verified Link</span>
                            </span>
                            <a
                              href={cert.certificateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                            >
                              <span>Verify on Site</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 italic">
                            No verification URL attached
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Slide-over Profile Drawer */}
      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        user={user}
        studentProfile={studentProfile}
        onProfileUpdated={(updated) => {
          if (updated) {
            setStudentProfile((prev) => ({ ...(prev || {}), ...updated }));
          }
          loadDashboardData(true);
        }}
      />

      {/* Confirmation Apply Modal */}
      <ApplyModal
        isOpen={isApplyModalOpen}
        onClose={() => {
          setIsApplyModalOpen(false);
          setSelectedDriveToApply(null);
        }}
        drive={selectedDriveToApply}
        studentProfile={studentProfile}
        isReapply={
          selectedDriveToApply
            ? withdrawnDriveIds.has(selectedDriveToApply._id) ||
              withdrawnDriveIds.has(String(selectedDriveToApply._id))
            : false
        }
        onConfirmApply={handleConfirmApply}
      />
    </div>
  );
}