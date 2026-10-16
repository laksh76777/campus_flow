import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { RefreshCw, Calendar } from "lucide-react";

import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminNavbar from "../../components/admin/AdminNavbar";
import AdminOverview from "../../components/admin/AdminOverview";
import PlacementAnalytics from "../../components/admin/PlacementAnalytics";
import ManageDrives from "../../components/admin/ManageDrives";
import ManageCompanies from "../../components/admin/ManageCompanies";
import ManageApplications from "../../components/admin/ManageApplications";
import ManageStudents from "../../components/admin/ManageStudents";
import ManageSessions from "../../components/admin/ManageSessions";
import ExcelMigrationHub from "../../components/admin/ExcelMigrationHub";
import ManageAnnouncements from "../../components/admin/ManageAnnouncements";
import AutomatedPlacementDrives from "../../components/admin/AutomatedPlacementDrives";

import { useAuth } from "../../context/authContextDef";
import {
  getAdminDashboardStats,
  getAllCompanies,
  getAllPlacementDrives,
  createPlacementDrive,
  deactivatePlacementDrive,
  reactivatePlacementDrive,
  deletePlacementDrive,
  getAllApplications,
  updateApplicationStatus,
  getAllStudentProfiles,
} from "../../services/adminService";
import { getAllPlacementSessions } from "../../services/sessionService";

const ADMIN_TABS = [
  "overview",
  "analytics",
  "students",
  "drives",
  "automated_drives",
  "companies",
  "applications",
  "sessions",
  "excel_hub",
  "announcements",
];

export default function AdminDashboard({ initialTab = "overview" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const requestedTab = searchParams.get("tab") || initialTab;
  const tabParam = ADMIN_TABS.includes(requestedTab) ? requestedTab : "overview";
  const [activeTab, setActiveTab] = useState(tabParam);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Core Data States
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoadState, setStudentsLoadState] = useState("loading");
  const [companies, setCompanies] = useState([]);
  const [drives, setDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("all");
  const [selectedDriveIdForApps, setSelectedDriveIdForApps] = useState("all");

  // Modal triggers
  const [isCreateDriveOpen, setIsCreateDriveOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);

  // Role Protection
  useEffect(() => {
    if (user && user.role && user.role !== "admin") {
      toast.error("Administrator privileges required");
      navigate("/login");
    }
  }, [user, navigate]);

  // Sync tab with URL
  useEffect(() => {
    setActiveTab(tabParam);
  }, [tabParam]);

  const handleTabChange = (newTab) => {
    if (!ADMIN_TABS.includes(newTab)) return;
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  // Load Admin Data from API
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const failedSections = [];

    try {
      // 1. Fetch Placement Sessions
      try {
        const sessRes = await getAllPlacementSessions({ includeArchived: "true" });
        if (Array.isArray(sessRes?.data)) {
          setSessions(sessRes.data);
          // Default to active session if not selected yet
          const activeSess = sessRes.data.find((s) => s.isActive);
          if (activeSess && selectedSessionId === "all") {
            // Keep "all" or select active
          }
        } else {
          failedSections.push("placement sessions (unexpected response)");
        }
      } catch (err) {
        console.warn("Failed to fetch sessions:", err.message);
        failedSections.push("placement sessions");
      }

      // 2. Fetch Stats
      try {
        const statsRes = await getAdminDashboardStats();
        if (statsRes?.data && typeof statsRes.data === "object") {
          setStats(statsRes.data);
        } else {
          failedSections.push("dashboard statistics (unexpected response)");
        }
      } catch (err) {
        console.warn("Failed to fetch dashboard stats:", err.message);
        failedSections.push("dashboard statistics");
      }

      // 3. Fetch Students Cohort
      try {
        const studentsRes = await getAllStudentProfiles({ limit: 200 });
        const studentsData = studentsRes?.data?.students || studentsRes?.data;
        if (Array.isArray(studentsData)) {
          setStudents(studentsData);
          setStudentsLoadState("loaded");
        } else {
          setStudentsLoadState("error");
          failedSections.push("student records (unexpected response)");
        }
      } catch (err) {
        console.warn("Failed to fetch students:", err.message);
        setStudentsLoadState("error");
        failedSections.push("student records");
      }

      // 4. Fetch Companies
      try {
        const compRes = await getAllCompanies();
        if (Array.isArray(compRes?.data)) {
          setCompanies(compRes.data);
        } else {
          failedSections.push("companies (unexpected response)");
        }
      } catch (err) {
        console.warn("Failed to fetch companies:", err.message);
        failedSections.push("companies");
      }

      // 5. Fetch Drives
      try {
        const driveRes = await getAllPlacementDrives();
        if (Array.isArray(driveRes?.data)) {
          setDrives(driveRes.data);
        } else {
          failedSections.push("placement drives (unexpected response)");
        }
      } catch (err) {
        console.warn("Failed to fetch placement drives:", err.message);
        failedSections.push("placement drives");
      }

      // 6. Fetch all applications
      try {
        const appsRes = await getAllApplications({ limit: 200 });
        const appsData = appsRes?.data?.applications || appsRes?.data;
        if (Array.isArray(appsData)) {
          setApplications(appsData);
        } else {
          failedSections.push("applications (unexpected response)");
        }
      } catch (err) {
        console.warn("Failed to fetch applications:", err.message);
        failedSections.push("applications");
      }

      if (failedSections.length > 0) {
        toast.error(
          `Unable to load ${failedSections.join(", ")}. Check the API connection and admin session.`
        );
      }
    } catch (err) {
      console.warn("Failed to fetch fresh admin data:", err.message);
      toast.error(
        err.response?.data?.message || "Failed to load admin dashboard data."
      );
    } finally {
      setRefreshing(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Selected session object for cohort scoping
  const activeSessionObj = useMemo(() => {
    if (selectedSessionId === "all") return null;
    return sessions.find((s) => s._id === selectedSessionId) || null;
  }, [selectedSessionId, sessions]);

  // Scoped datasets to prevent cross-session data mixing
  const scopedStudents = useMemo(() => {
    if (!activeSessionObj) return students;
    return students.filter((s) => {
      const sSessId = s.placementSession?._id || s.placementSession;
      return sSessId === activeSessionObj._id || s.graduationYear === activeSessionObj.sessionYear;
    });
  }, [students, activeSessionObj]);

  const scopedDrives = useMemo(() => {
    if (!activeSessionObj) return drives;
    return drives.filter((d) => {
      const dSessId = d.placementSession?._id || d.placementSession;
      return dSessId === activeSessionObj._id || d.graduationYear === activeSessionObj.sessionYear;
    });
  }, [drives, activeSessionObj]);

  const scopedApplications = useMemo(() => {
    if (!activeSessionObj) return applications;
    const scopedDriveIds = new Set(scopedDrives.map((d) => d._id));
    return applications.filter((app) => {
      const driveId = app.drive?._id || app.drive;
      return scopedDriveIds.has(driveId);
    });
  }, [applications, scopedDrives, activeSessionObj]);

  // Handlers for Drive
  const handleCreateDrive = async (newDriveData) => {
    try {
      // Auto-assign active placement session if selected
      let payload = newDriveData;
      if (newDriveData instanceof FormData) {
        if (activeSessionObj) {
          if (!newDriveData.get("placementSession")) {
            newDriveData.append("placementSession", activeSessionObj._id);
          }
          if (!newDriveData.get("graduationYear")) {
            newDriveData.append("graduationYear", activeSessionObj.sessionYear);
          }
        }
      } else {
        payload = { ...newDriveData };
        if (activeSessionObj) {
          payload.placementSession = activeSessionObj._id;
          payload.graduationYear = activeSessionObj.sessionYear;
        }
      }
      const res = await createPlacementDrive(payload);
      const created = res?.data;
      if (created) {
        setDrives((prev) => [created, ...prev]);
        toast.success("Placement drive created successfully");
        return created;
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to create placement drive";
      toast.error(msg);
      throw err;
    }
  };

  const handleToggleDriveStatus = async (driveId, currentActive) => {
    try {
      if (currentActive) {
        await deactivatePlacementDrive(driveId);
        toast.success("Placement drive closed");
      } else {
        await reactivatePlacementDrive(driveId);
        toast.success("Placement drive reopened");
      }
      setDrives((prev) =>
        prev.map((d) =>
          d._id === driveId ? { ...d, isActive: !currentActive } : d
        )
      );
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to update drive status";
      toast.error(msg);
    }
  };

  const handleDeletePlacementDrive = async (driveId, compName = "Corporate Recruiter", jobTitle = "Drive") => {
    const confirm = window.confirm(
      `Are you sure you want to permanently DELETE the placement drive "${jobTitle}" (${compName})?\n\nAll candidate applications, round progressions, and associated records for this drive will be deleted.`
    );
    if (!confirm) return;

    try {
      await deletePlacementDrive(driveId);
      toast.success(`Placement drive "${jobTitle}" deleted successfully`);
      setDrives((prev) => prev.filter((d) => d._id !== driveId));
      setApplications((prev) =>
        prev.filter((a) => (a.placementDrive?._id || a.placementDrive) !== driveId)
      );
      loadDashboardData(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to delete placement drive";
      toast.error(msg);
    }
  };

  // Handlers for Application
  const handleUpdateApplicationStatus = async (
    appId,
    newStatus,
    remarks,
    extraDetails = {}
  ) => {
    try {
      await updateApplicationStatus(appId, newStatus, remarks, extraDetails);
      toast.success(`Application status updated to ${newStatus}`);
      setApplications((prev) =>
        prev.map((app) =>
          app._id === appId
            ? {
                ...app,
                status: newStatus,
                remarks: remarks || app.remarks,
                ...extraDetails,
              }
            : app
        )
      );
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to update application status";
      toast.error(msg);
    }
  };

  const handleViewApplicants = (driveId) => {
    setSelectedDriveIdForApps(driveId);
    handleTabChange("applications");
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out from administrative console");
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800 antialiased selection:bg-orange-500 selection:text-white">
      {/* Sidebar Navigation */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        adminUser={user}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <AdminNavbar
          onMenuClick={() => setIsSidebarOpen(true)}
          activeTab={activeTab}
          adminUser={user}
          onLogout={handleLogout}
          students={students}
          applications={applications}
          onNavigateTab={handleTabChange}
        />

          {/* Page Body */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Global Cohort Scope & Sync Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            {/* Session Filter Dropdown */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
                  Cohort Scope:
                </span>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  <option value="all">All Cohorts (Unfiltered)</option>
                  {sessions.map((sess) => (
                    <option key={sess._id} value={sess._id}>
                      {sess.academicYear ? `${sess.academicYear} Session` : `Class of ${sess.sessionYear}`} {sess.isActive ? "• Active" : sess.isClosed ? "• Closed" : ""}
                    </option>
                  ))}
                </select>
                {activeSessionObj && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-200 hidden md:inline">
                    Isolated to {activeSessionObj.sessionYear}
                  </span>
                )}
              </div>
            </div>

            {/* Sync Live Data Button */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => loadDashboardData(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`}
                />
                <span>{refreshing ? "Syncing..." : "Sync Live Data"}</span>
              </button>
            </div>
          </div>

          {/* Active Tab View with Scoped Datasets */}
          {activeTab === "overview" && (
            <AdminOverview
              stats={stats}
              students={scopedStudents}
              drives={scopedDrives}
              companies={companies}
              applications={scopedApplications}
              onNavigateTab={handleTabChange}
              onOpenCreateDrive={() => {
                setIsCreateDriveOpen(true);
                handleTabChange("drives");
              }}
              onOpenCreateCompany={() => {
                setIsCreateCompanyOpen(true);
                handleTabChange("companies");
              }}
            />
          )}

          {activeTab === "analytics" && (
            <PlacementAnalytics
              stats={stats}
              applications={scopedApplications}
              students={scopedStudents}
              drives={scopedDrives}
              companies={companies}
            />
          )}

          {activeTab === "students" && (
            <ManageStudents
              students={students}
              dataStatus={studentsLoadState}
              sessions={sessions}
              activeSessionId={selectedSessionId}
              onSelectSession={setSelectedSessionId}
              onRefresh={() => loadDashboardData(true)}
            />
          )}

          {activeTab === "drives" && (
            <ManageDrives
              drives={scopedDrives}
              companies={companies}
              onCreateDrive={handleCreateDrive}
              onToggleDriveStatus={handleToggleDriveStatus}
              onDeleteDrive={handleDeletePlacementDrive}
              onViewApplicants={handleViewApplicants}
              isCreateModalOpen={isCreateDriveOpen}
              setIsCreateModalOpen={setIsCreateDriveOpen}
            />
          )}

          {activeTab === "automated_drives" && (
            <AutomatedPlacementDrives
              drives={scopedDrives}
              applications={scopedApplications}
              companies={companies}
              sessions={sessions}
              onRefresh={() => loadDashboardData(true)}
              onOpenDriveDetails={handleViewApplicants}
              onUpdateStatus={handleUpdateApplicationStatus}
              onDeleteDrive={handleDeletePlacementDrive}
            />
          )}

          {activeTab === "companies" && (
            <ManageCompanies
              companies={companies}
              drives={scopedDrives}
              isCreateModalOpen={isCreateCompanyOpen}
              setIsCreateModalOpen={setIsCreateCompanyOpen}
              onCompanyCreated={(newComp) =>
                setCompanies((prev) => [newComp, ...prev])
              }
              onRefresh={() => loadDashboardData(true)}
              onCreateDriveForCompany={(_company) => {
                setIsCreateDriveOpen(true);
                handleTabChange("drives");
              }}
            />
          )}

          {activeTab === "applications" && (
            <ManageApplications
              applications={scopedApplications}
              drives={scopedDrives}
              selectedDriveId={selectedDriveIdForApps}
              onSelectDrive={setSelectedDriveIdForApps}
              onUpdateStatus={handleUpdateApplicationStatus}
              onRefresh={() => loadDashboardData(true)}
            />
          )}

          {activeTab === "sessions" && (
            <ManageSessions
              onSessionChanged={() => loadDashboardData(true)}
            />
          )}

          {activeTab === "excel_hub" && (
            <ExcelMigrationHub
              sessions={sessions}
              drives={scopedDrives}
              onRefresh={() => loadDashboardData(true)}
            />
          )}

          {activeTab === "announcements" && (
            <ManageAnnouncements
              drives={scopedDrives}
            />
          )}
        </main>
      </div>
    </div>
  );
}
