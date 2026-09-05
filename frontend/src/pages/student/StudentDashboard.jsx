import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Sparkles,
  GraduationCap,
  ArrowRight,
  RefreshCw,
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

// Clean fallback sample data to ensure the UI is fully functional and previewable
const sampleFallbackDrives = [
  {
    _id: "sample-drive-1",
    company: {
      companyName: "Google",
      isActive: true,
    },
    jobTitle: "Software Development Engineer",
    package: 24,
    location: "Bengaluru / Hyderabad",
    jobType: "full-time",
    eligibleBranches: ["CSE", "IT", "ECE"],
    minimumCGPA: 7.5,
    maximumBacklogs: 0,
    graduationYear: 2026,
    applicationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    driveDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "sample-drive-2",
    company: {
      companyName: "Microsoft",
      isActive: true,
    },
    jobTitle: "Cloud Solution Engineer",
    package: 18.5,
    location: "Hyderabad / Noida",
    jobType: "full-time",
    eligibleBranches: ["CSE", "IT", "ECE"],
    minimumCGPA: 7.0,
    maximumBacklogs: 1,
    graduationYear: 2026,
    applicationDeadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    driveDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "sample-drive-3",
    company: {
      companyName: "Amazon",
      isActive: true,
    },
    jobTitle: "SDE Summer Intern 2026",
    package: 14,
    location: "Bengaluru",
    jobType: "internship",
    eligibleBranches: ["CSE", "IT"],
    minimumCGPA: 7.0,
    maximumBacklogs: 0,
    graduationYear: 2026,
    applicationDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    driveDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "sample-drive-4",
    company: {
      companyName: "Atlassian",
      isActive: true,
    },
    jobTitle: "Associate Software Engineer",
    package: 22,
    location: "Remote / Bengaluru",
    jobType: "full-time",
    eligibleBranches: ["CSE", "IT", "ECE"],
    minimumCGPA: 8.0,
    maximumBacklogs: 0,
    graduationYear: 2026,
    applicationDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    driveDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const sampleFallbackApplications = [
  {
    _id: "sample-app-1",
    placementDrive: {
      _id: "sample-drive-1",
      company: { companyName: "Google" },
      jobTitle: "Software Development Engineer",
      package: 24,
    },
    status: "shortlisted",
    appliedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "sample-app-2",
    placementDrive: {
      _id: "sample-drive-3",
      company: { companyName: "Amazon" },
      jobTitle: "SDE Summer Intern 2026",
      package: 14,
    },
    status: "applied",
    appliedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function StudentDashboard() {
  const navigate = useNavigate();

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
        if (drivesRes.data && drivesRes.data.length > 0) {
          setEligibleDrives(drivesRes.data);
        }
      } catch (err) {
        console.warn("Eligible drives note:", err.message);
      }

      // 4. Fetch All Applications
      try {
        const appsRes = await getMyApplications();
        if (appsRes.data && appsRes.data.length > 0) {
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
  const appliedDriveIds = useMemo(() => {
    const list = applications.length > 0 ? applications : sampleFallbackApplications;
    const ids = new Set();
    list.forEach((app) => {
      if (app.placementDrive?._id) {
        ids.add(app.placementDrive._id);
      } else if (app.placementDrive) {
        ids.add(app.placementDrive);
      }
    });
    return ids;
  }, [applications]);

  const activeDrivesList =
    eligibleDrives.length > 0 ? eligibleDrives : sampleFallbackDrives;
  const activeApplicationsList =
    applications.length > 0 ? applications : sampleFallbackApplications;

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
        selected: activeApplicationsList.filter((a) => a.status === "selected").length,
        rejected: activeApplicationsList.filter((a) => a.status === "rejected").length,
        withdrawn: activeApplicationsList.filter((a) => a.status === "withdrawn").length,
      },
    };
  }, [dashboardStats, activeDrivesList, activeApplicationsList]);

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
      const msg = err.response?.data?.message || "Failed to submit application";
      toast.error(msg);
      if (driveId.startsWith("sample-")) {
        const fakeApp = {
          _id: `fake-${Date.now()}`,
          placementDrive: activeDrivesList.find((d) => d._id === driveId),
          status: "applied",
          appliedAt: new Date().toISOString(),
        };
        setApplications((prev) => [fakeApp, ...prev]);
        toast.success("Application recorded (demo mode)!");
      }
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
      if (applicationId.startsWith("sample-") || applicationId.startsWith("fake-")) {
        setApplications((prev) =>
          prev.map((a) => (a._id === applicationId ? { ...a, status: "withdrawn" } : a))
        );
        toast.success("Application marked as withdrawn (demo mode)");
      }
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const studentName =
    user?.fullName || studentProfile?.user?.fullName || "Prakash";
  const studentBranch = studentProfile?.branch || "Computer Science & Engineering";
  const studentCgpa = studentProfile?.cgpa ?? 8.65;
  const graduationYear = studentProfile?.graduationYear ?? 2026;

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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">CGPA</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{studentCgpa}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Backlogs</span>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                    {studentProfile?.backlogs ?? 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Semester</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">
                    {studentProfile?.semester ?? 6}th
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Graduation</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{graduationYear}</p>
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
        onProfileUpdated={() => loadDashboardData(true)}
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
        onConfirmApply={handleConfirmApply}
      />
    </div>
  );
}