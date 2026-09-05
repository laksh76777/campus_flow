import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { RefreshCw } from "lucide-react";

import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminNavbar from "../../components/admin/AdminNavbar";
import AdminOverview from "../../components/admin/AdminOverview";
import ManageDrives from "../../components/admin/ManageDrives";
import ManageCompanies from "../../components/admin/ManageCompanies";
import ManageApplications from "../../components/admin/ManageApplications";
import ManageStudents from "../../components/admin/ManageStudents";

import { useAuth } from "../../context/authContextDef";
import {
  getAdminDashboardStats,
  getAllCompanies,
  getAllPlacementDrives,
  createPlacementDrive,
  deactivatePlacementDrive,
  reactivatePlacementDrive,
  getAllApplications,
  updateApplicationStatus,
  getAllStudentProfiles,
} from "../../services/adminService";

// Fallback seed data for corporate partners
const fallbackCompanies = [
  {
    _id: "comp-1",
    companyName: "Google",
    industry: "Information Technology",
    location: "Bengaluru / Hyderabad",
    companyWebsite: "https://careers.google.com",
    contactEmail: "university-recruiting@google.com",
    contactPhone: "+91 80 6721 8000",
    companyDescription:
      "Global technology leader building products for billons of users worldwide.",
    isActive: true,
  },
  {
    _id: "comp-2",
    companyName: "Microsoft",
    industry: "Information Technology",
    location: "Hyderabad / Noida",
    companyWebsite: "https://careers.microsoft.com",
    contactEmail: "campus-in@microsoft.com",
    contactPhone: "+91 40 6699 0000",
    companyDescription:
      "Empowering every person and organization on the planet to achieve more.",
    isActive: true,
  },
  {
    _id: "comp-3",
    companyName: "Amazon",
    industry: "E-Commerce & Cloud Computing",
    location: "Bengaluru / Chennai",
    companyWebsite: "https://amazon.jobs",
    contactEmail: "campus-hiring@amazon.com",
    contactPhone: "+91 80 4100 0000",
    companyDescription:
      "Earth's most customer-centric company and AWS cloud platform provider.",
    isActive: true,
  },
  {
    _id: "comp-4",
    companyName: "Atlassian",
    industry: "Enterprise Software",
    location: "Remote / Bengaluru",
    companyWebsite: "https://www.atlassian.com/company/careers",
    contactEmail: "university-india@atlassian.com",
    contactPhone: "+91 80 4567 8900",
    companyDescription:
      "Pioneering collaboration software including Jira, Confluence, and Trello.",
    isActive: true,
  },
];

// Fallback seed data for placement drives
const fallbackDrives = [
  {
    _id: "drive-1",
    company: {
      _id: "comp-1",
      companyName: "Google",
    },
    jobTitle: "Software Development Engineer",
    package: 24,
    location: "Bengaluru / Hyderabad",
    jobType: "full-time",
    eligibleBranches: ["CSE", "IT", "ECE"],
    minimumCGPA: 7.5,
    maximumBacklogs: 0,
    graduationYear: 2026,
    applicationStartDate: new Date().toISOString(),
    applicationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    driveDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    venue: "Online OA & Google Meet",
    isActive: true,
  },
  {
    _id: "drive-2",
    company: {
      _id: "comp-2",
      companyName: "Microsoft",
    },
    jobTitle: "Cloud Solution Engineer",
    package: 18.5,
    location: "Hyderabad / Noida",
    jobType: "full-time",
    eligibleBranches: ["CSE", "IT", "ECE"],
    minimumCGPA: 7.0,
    maximumBacklogs: 1,
    graduationYear: 2026,
    applicationStartDate: new Date().toISOString(),
    applicationDeadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    driveDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    venue: "Main Auditorium & MS Teams",
    isActive: true,
  },
  {
    _id: "drive-3",
    company: {
      _id: "comp-3",
      companyName: "Amazon",
    },
    jobTitle: "SDE Summer Intern 2026",
    package: 14,
    location: "Bengaluru",
    jobType: "internship",
    eligibleBranches: ["CSE", "IT"],
    minimumCGPA: 7.0,
    maximumBacklogs: 0,
    graduationYear: 2026,
    applicationStartDate: new Date().toISOString(),
    applicationDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    driveDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
    venue: "Chime & Campus Lab 4",
    isActive: true,
  },
  {
    _id: "drive-4",
    company: {
      _id: "comp-4",
      companyName: "Atlassian",
    },
    jobTitle: "Associate Software Engineer",
    package: 22,
    location: "Remote / Bengaluru",
    jobType: "full-time",
    eligibleBranches: ["CSE", "IT", "ECE"],
    minimumCGPA: 8.0,
    maximumBacklogs: 0,
    graduationYear: 2026,
    applicationStartDate: new Date().toISOString(),
    applicationDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    driveDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    venue: "Virtual Assessment",
    isActive: false,
  },
];

// Fallback sample applications
const fallbackApplications = [
  {
    _id: "app-101",
    placementDrive: {
      _id: "drive-1",
      company: { companyName: "Google" },
      jobTitle: "Software Development Engineer",
      package: 24,
    },
    student: {
      _id: "stud-1",
      enrollmentNumber: "0827CS221045",
      branch: "CSE",
      cgpa: 8.85,
      activeBacklogs: 0,
      user: {
        fullName: "Aarav Sharma",
        email: "aarav.sharma@campus.edu",
      },
      resume: {
        url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      },
    },
    status: "shortlisted",
    appliedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    remarks: "Cleared coding round with 100% test cases. Shortlisted for Technical Interview 1.",
  },
  {
    _id: "app-102",
    placementDrive: {
      _id: "drive-1",
      company: { companyName: "Google" },
      jobTitle: "Software Development Engineer",
      package: 24,
    },
    student: {
      _id: "stud-2",
      enrollmentNumber: "0827IT221012",
      branch: "IT",
      cgpa: 8.2,
      activeBacklogs: 0,
      user: {
        fullName: "Priya Patel",
        email: "priya.patel@campus.edu",
      },
      resume: {
        url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      },
    },
    status: "applied",
    appliedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    remarks: "Application submitted, pending resume screening.",
  },
  {
    _id: "app-103",
    placementDrive: {
      _id: "drive-2",
      company: { companyName: "Microsoft" },
      jobTitle: "Cloud Solution Engineer",
      package: 18.5,
    },
    student: {
      _id: "stud-3",
      enrollmentNumber: "0827EC221078",
      branch: "ECE",
      cgpa: 7.9,
      activeBacklogs: 0,
      user: {
        fullName: "Rohan Verma",
        email: "rohan.verma@campus.edu",
      },
      resume: {
        url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      },
    },
    status: "selected",
    appliedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    remarks: "Selected! Official offer letter extended at ₹18.5 LPA.",
  },
  {
    _id: "app-104",
    placementDrive: {
      _id: "drive-3",
      company: { companyName: "Amazon" },
      jobTitle: "SDE Summer Intern 2026",
      package: 14,
    },
    student: {
      _id: "stud-4",
      enrollmentNumber: "0827CS221099",
      branch: "CSE",
      cgpa: 9.1,
      activeBacklogs: 0,
      user: {
        fullName: "Sneha Iyer",
        email: "sneha.iyer@campus.edu",
      },
      resume: {
        url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      },
    },
    status: "shortlisted",
    appliedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    remarks: "Invited to final round bar-raiser interview.",
  },
  {
    _id: "app-105",
    placementDrive: {
      _id: "drive-2",
      company: { companyName: "Microsoft" },
      jobTitle: "Cloud Solution Engineer",
      package: 18.5,
    },
    student: {
      _id: "stud-5",
      enrollmentNumber: "0827CS221034",
      branch: "CSE",
      cgpa: 7.1,
      activeBacklogs: 1,
      user: {
        fullName: "Vikram Rao",
        email: "vikram.rao@campus.edu",
      },
      resume: {
        url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      },
    },
    status: "rejected",
    appliedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    remarks: "Did not meet Round 1 technical threshold.",
  },
];

// Fallback sample registered students
const fallbackStudents = [
  {
    _id: "stud-1",
    enrollmentNumber: "1JS23CS104",
    branch: "Computer Science & Engineering",
    semester: 6,
    graduationYear: 2026,
    cgpa: 8.9,
    backlogs: 0,
    skills: ["React.js", "Node.js", "Python", "SQL"],
    user: {
      fullName: "Prakash Choyal",
      email: "prakashchoyal@gmail.com",
    },
    resume: {
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    },
  },
  {
    _id: "stud-2",
    enrollmentNumber: "1BI23EC195",
    branch: "Electronics & Communication",
    semester: 6,
    graduationYear: 2027,
    cgpa: 8.7,
    backlogs: 0,
    skills: ["Embedded C", "IoT", "Python", "VLSI"],
    user: {
      fullName: "Priya Choudhary",
      email: "priyachoudhary2323@gmail.com",
    },
    resume: {
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    },
  },
  {
    _id: "stud-3",
    enrollmentNumber: "0827CS221045",
    branch: "Computer Science & Engineering",
    semester: 6,
    graduationYear: 2026,
    cgpa: 8.85,
    backlogs: 0,
    skills: ["Java", "Spring Boot", "AWS", "Docker"],
    user: {
      fullName: "Aarav Sharma",
      email: "aarav.sharma@campus.edu",
    },
    resume: {
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    },
  },
];

export default function AdminDashboard({ initialTab = "overview" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const tabParam = searchParams.get("tab") || initialTab;
  const [activeTab, setActiveTab] = useState(tabParam);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Role Protection
  useEffect(() => {
    if (user && user.role && user.role !== "admin") {
      toast.error("Administrator privileges required");
      navigate("/login");
    }
  }, [user, navigate]);

  // Core Data States
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [drives, setDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedDriveIdForApps, setSelectedDriveIdForApps] = useState("all");

  // Modal triggers
  const [isCreateDriveOpen, setIsCreateDriveOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);

  // Sync tab with URL
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  // Load Admin Data from API
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      // 1. Fetch Stats
      try {
        const statsRes = await getAdminDashboardStats();
        if (statsRes?.data) setStats(statsRes.data);
      } catch (err) {
        console.warn("Failed to fetch dashboard stats:", err.message);
      }

      // 2. Fetch Students Cohort
      try {
        const studentsRes = await getAllStudentProfiles();
        if (Array.isArray(studentsRes?.data)) {
          setStudents(studentsRes.data);
        }
      } catch (err) {
        console.warn("Failed to fetch students:", err.message);
        setStudents((prev) => (prev.length > 0 ? prev : fallbackStudents));
      }

      // 3. Fetch Companies
      try {
        const compRes = await getAllCompanies();
        if (Array.isArray(compRes?.data)) {
          setCompanies(compRes.data);
        }
      } catch (err) {
        console.warn("Failed to fetch companies:", err.message);
        setCompanies((prev) => (prev.length > 0 ? prev : fallbackCompanies));
      }

      // 4. Fetch Drives
      try {
        const driveRes = await getAllPlacementDrives();
        if (Array.isArray(driveRes?.data)) {
          setDrives(driveRes.data);
        }
      } catch (err) {
        console.warn("Failed to fetch placement drives:", err.message);
        setDrives((prev) => (prev.length > 0 ? prev : fallbackDrives));
      }

      // 5. Fetch all applications
      try {
        const appsRes = await getAllApplications();
        if (Array.isArray(appsRes?.data)) {
          setApplications(appsRes.data);
        }
      } catch (err) {
        console.warn("Failed to fetch applications:", err.message);
        setApplications((prev) => (prev.length > 0 ? prev : fallbackApplications));
      }
    } catch (err) {
      console.warn("Failed to fetch fresh admin data:", err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handlers for Drive
  const handleCreateDrive = async (newDriveData) => {
    try {
      const res = await createPlacementDrive(newDriveData);
      const created = res?.data || {
        _id: `drive-${Date.now()}`,
        ...newDriveData,
        company: companies.find((c) => c._id === newDriveData.company) || {
          companyName: "Corporate Recruiter",
        },
        isActive: true,
      };
      setDrives((prev) => [created, ...prev]);
      return created;
    } catch {
      // Local fallback
      const localDrive = {
        _id: `drive-${Date.now()}`,
        ...newDriveData,
        company: companies.find((c) => c._id === newDriveData.company) || {
          companyName: "Corporate Recruiter",
        },
        isActive: true,
      };
      setDrives((prev) => [localDrive, ...prev]);
      return localDrive;
    }
  };

  const handleToggleDriveStatus = async (driveId, currentActive) => {
    try {
      if (currentActive) {
        await deactivatePlacementDrive(driveId);
        toast.success("Drive closed");
      } else {
        await reactivatePlacementDrive(driveId);
        toast.success("Drive reopened");
      }
      setDrives((prev) =>
        prev.map((d) =>
          d._id === driveId ? { ...d, isActive: !currentActive } : d
        )
      );
    } catch {
      // Local fallback toggle
      setDrives((prev) =>
        prev.map((d) =>
          d._id === driveId ? { ...d, isActive: !currentActive } : d
        )
      );
      toast.success(`Drive ${currentActive ? "closed" : "reopened"} (Local Demo)`);
    }
  };

  // Handlers for Application
  const handleUpdateApplicationStatus = async (appId, newStatus, remarks) => {
    try {
      await updateApplicationStatus(appId, newStatus, remarks);
      setApplications((prev) =>
        prev.map((app) =>
          app._id === appId
            ? { ...app, status: newStatus, remarks: remarks || app.remarks }
            : app
        )
      );
    } catch {
      // Local fallback update
      setApplications((prev) =>
        prev.map((app) =>
          app._id === appId
            ? { ...app, status: newStatus, remarks: remarks || app.remarks }
            : app
        )
      );
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
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
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
        />

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Refresh Banner */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Campus Recruitment Console Active</span>
            </div>

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

          {/* Active Tab View */}
          {activeTab === "overview" && (
            <AdminOverview
              stats={stats}
              students={students}
              drives={drives}
              companies={companies}
              applications={applications}
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

          {activeTab === "students" && (
            <ManageStudents
              students={students}
              onRefresh={() => loadDashboardData(true)}
            />
          )}

          {activeTab === "drives" && (
            <ManageDrives
              drives={drives}
              companies={companies}
              onCreateDrive={handleCreateDrive}
              onToggleDriveStatus={handleToggleDriveStatus}
              onViewApplicants={handleViewApplicants}
              isCreateModalOpen={isCreateDriveOpen}
              setIsCreateModalOpen={setIsCreateDriveOpen}
            />
          )}

          {activeTab === "companies" && (
            <ManageCompanies
              companies={companies}
              drives={drives}
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
              applications={applications}
              drives={drives}
              selectedDriveId={selectedDriveIdForApps}
              onSelectDrive={setSelectedDriveIdForApps}
              onUpdateStatus={handleUpdateApplicationStatus}
              onRefresh={() => loadDashboardData(true)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
