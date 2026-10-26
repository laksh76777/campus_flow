import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { RefreshCw, Calendar, Trash2, Archive } from "lucide-react";

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
import AdminSupportInbox from "../../components/admin/AdminSupportInbox";

import { useAuth } from "../../context/authContextDef";
import useOverlay from "../../hooks/useOverlay";
import {
  getAdminDashboardStats,
  getAllCompanies,
  getAllPlacementDrives,
  createPlacementDrive,
  updatePlacementDrive,
  deactivatePlacementDrive,
  reactivatePlacementDrive,
  deletePlacementDrive,
  getAllApplications,
  updateApplicationStatus,
  getCompleteStudentDirectory,
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
  "support",
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
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { driveId, compName, jobTitle }
  const [deletingDrive, setDeletingDrive] = useState(false);
  useOverlay(Boolean(deleteConfirmation), () => {
    if (!deletingDrive) setDeleteConfirmation(null);
  });

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
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tabParam]);

  const handleTabChange = (newTab) => {
    if (!ADMIN_TABS.includes(newTab)) return;
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  // Load Admin Data from API
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const failedSections = [];
    const loadSection = async (label, request, validate, apply) => {
      try {
        const value = await request();
        if (!validate(value)) throw new Error("Unexpected response format");
        apply(value);
      } catch (error) {
        failedSections.push(label);
        console.warn(`Failed to fetch ${label}:`, error.message);
        if (label === "student records") setStudentsLoadState("error");
      }
    };

    try {
      await Promise.all([
        loadSection("placement sessions", () => getAllPlacementSessions({ includeArchived: "true" }), (res) => Array.isArray(res?.data), (res) => setSessions(res.data)),
        loadSection("dashboard statistics", getAdminDashboardStats, (res) => res?.data && typeof res.data === "object", (res) => setStats(res.data)),
        loadSection("student records", getCompleteStudentDirectory, Array.isArray, (data) => {
          setStudents(data);
          setStudentsLoadState("loaded");
        }),
        loadSection("companies", getAllCompanies, (res) => Array.isArray(res?.data), (res) => setCompanies(res.data)),
        loadSection("placement drives", getAllPlacementDrives, (res) => Array.isArray(res?.data), (res) => setDrives(res.data)),
        loadSection("applications", () => getAllApplications({ limit: 200 }), (res) => Array.isArray(res?.data?.applications || res?.data), (res) => setApplications(res.data?.applications || res.data)),
      ]);
      if (failedSections.length > 0) {
        toast.error(`Unable to load ${failedSections.join(", ")}. Check the API connection and admin session.`);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

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
      return String(dSessId) === String(activeSessionObj._id) || Number(d.graduationYear) === Number(activeSessionObj.sessionYear);
    });
  }, [drives, activeSessionObj]);

  const scopedApplications = useMemo(() => {
    if (!activeSessionObj) return applications;
    const scopedDriveIds = new Set(scopedDrives.map((d) => String(d._id)));
    return applications.filter((app) => {
      const driveId = String(app.placementDrive?._id || app.placementDrive || app.drive?._id || app.drive || "");
      return scopedDriveIds.has(driveId);
    });
  }, [applications, scopedDrives, activeSessionObj]);

  // Handlers for Drive
  const handleCreateDrive = async (newDriveData) => {
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
      return created;
    }
  };

  // Save edits and replace the drive with the server's confirmed copy
  const handleUpdateDrive = async (driveId, changes) => {
    const res = await updatePlacementDrive(driveId, changes);
    const saved = res?.data;
    if (!saved?._id) {
      throw new Error("The server did not return the updated drive.");
    }
    setDrives((prev) => prev.map((d) => (d._id === saved._id ? saved : d)));
    return saved;
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

  const handleDeletePlacementDrive = (driveId, compName = "Corporate Recruiter", jobTitle = "Placement Drive") => {
    setDeleteConfirmation({ driveId, compName, jobTitle });
  };

  const confirmDeletePlacementDrive = async () => {
    if (!deleteConfirmation) return;
    const { driveId, jobTitle } = deleteConfirmation;
    try {
      setDeletingDrive(true);
      await deletePlacementDrive(driveId);
      toast.success(`Placement drive "${jobTitle}" deleted & archived successfully`);
      setDrives((prev) => prev.filter((d) => d._id !== driveId));
      await loadDashboardData(true);
      setDeleteConfirmation(null);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to delete placement drive";
      toast.error(msg);
    } finally {
      setDeletingDrive(false);
    }
  };

  // Handlers for Application
  const handleUpdateApplicationStatus = async (
    appId,
    newStatus,
    remarks,
    extraDetails = {}
  ) => {
    const res = await updateApplicationStatus(appId, newStatus, remarks, extraDetails);
    setApplications((prev) =>
      prev.map((app) =>
        app._id === appId
          ? {
              ...app,
              status: newStatus,
              remarks: remarks || app.remarks,
              ...extraDetails,
              ...(res?.data || {}),
            }
          : app
      )
    );
    loadDashboardData(true).catch(() => {});
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
    <div className="flex min-h-screen bg-canvas font-sans text-slate-800 antialiased">
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
          <main className="flex-1 min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Global Cohort Scope & Sync Banner */}
          <div className="cf-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            {/* Session Filter Dropdown */}
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label htmlFor="cohort-scope" className="cf-eyebrow hidden sm:inline">
                  Cohort scope
                </label>
                <select
                  id="cohort-scope"
                  aria-label="Cohort scope"
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="min-h-9 max-w-full cursor-pointer rounded-xl border border-line bg-surface-muted px-3 py-1.5 text-xs font-bold text-slate-800 outline-none transition hover:border-line-strong focus:border-brand-400 focus:bg-white"
                >
                  <option value="all">All Cohorts (Unfiltered)</option>
                  {sessions.map((sess) => (
                    <option key={sess._id} value={sess._id}>
                      {sess.academicYear ? `${sess.academicYear} Session` : `Class of ${sess.sessionYear}`} {sess.isActive ? "• Active" : sess.isClosed ? "• Closed" : ""}
                    </option>
                  ))}
                </select>
                {activeSessionObj && (
                  <span className="cf-badge hidden border-emerald-200 bg-emerald-50 text-emerald-700 md:inline-flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    Isolated to {activeSessionObj.sessionYear}
                  </span>
                )}
              </div>
            </div>

            {/* Sync Live Data Button */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => loadDashboardData(true)}
                disabled={refreshing}
                aria-busy={refreshing}
                className="cf-btn cf-btn-secondary"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`}
                />
                <span>{refreshing ? "Syncing…" : "Sync Live Data"}</span>
              </button>
            </div>
          </div>

          {/* Active Tab View with Scoped Datasets (keyed so each tab fades in) */}
          <div key={activeTab} className="animate-page space-y-6">
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
              onUpdateDrive={handleUpdateDrive}
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
              students={students}
            />
          )}
          {activeTab === "support" && <AdminSupportInbox />}
          </div>
        </main>
      </div>

      {/* Delete Placement Drive Confirmation Modal */}
      {deleteConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-drive-title"
        >
          <div className="cf-backdrop" aria-hidden="true" onClick={() => !deletingDrive && setDeleteConfirmation(null)} />
          <div className="relative w-full max-w-md space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 id="delete-drive-title" className="text-base font-bold text-slate-900">Delete Placement Drive?</h3>
                <p className="text-xs text-slate-500 truncate max-w-[260px]">
                  {deleteConfirmation.jobTitle} • {deleteConfirmation.compName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove this recruitment drive? Active recruitment and application submissions for this drive will stop immediately.
            </p>

            <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-[11px] text-amber-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Archive className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Candidate History Preserved as Archived</span>
              </p>
              <p className="text-amber-700">
                All candidates who applied will be safely preserved under <strong>{deleteConfirmation.compName}</strong> in <em>Applicant Review & Shortlisting</em>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                autoFocus
                onClick={() => setDeleteConfirmation(null)}
                disabled={deletingDrive}
                className="cf-btn cf-btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeletePlacementDrive}
                disabled={deletingDrive}
                aria-busy={deletingDrive}
                className="cf-btn cf-btn-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{deletingDrive ? "Deleting..." : "Delete & Archive Drive"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
