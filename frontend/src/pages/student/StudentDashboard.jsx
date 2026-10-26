import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Sparkles,
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
  Bell,
  MessageSquare,
  AlertCircle,
  X,
  Mail,
  Check,
  Building2,
  FileText,
  Layers,
  AlertTriangle,
  Home,
  Users as UsersIcon,
  Lock,
  Phone,
  Trash2,
} from "lucide-react";

import StudentSidebar from "../../components/studentDashboard/StudentSidebar";
import StudentNavbar from "../../components/studentDashboard/StudentNavbar";
import DashboardStats from "../../components/studentDashboard/DashboardStats";
import RecentDrives from "../../components/studentDashboard/RecentDrives";
import RecentApplications from "../../components/studentDashboard/RecentApplications";
import ApplyModal from "../../components/studentDashboard/ApplyModal";
import ProfileDrawer, { cleanCertificateTitle, getEffectiveCredentialUrl } from "../../components/studentDashboard/ProfileDrawer";
import ProfileModificationModal from "../../components/studentDashboard/ProfileModificationModal";
import StudentSupportChat from "../../components/studentDashboard/StudentSupportChat";

import {
  getStudentDashboardStats,
  getCurrentStudentProfile,
  getMyEligibleDrives,
  getMyApplications,
  applyForDrive,
  withdrawApplication,
  respondToOffer,
} from "../../services/studentService";
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
} from "../../services/notificationService";
import { useAuth } from "../../context/authContextDef";
import { getResumeViewUrl } from "../../utils/resumeHelper";
import useOverlay from "../../hooks/useOverlay";

const STUDENT_ROUTE_TABS = {
  "/student-dashboard": "overview",
  "/placement-drives": "drives",
  "/my-applications": "applications",
  "/notifications": "notifications",
  "/student-profile": "profile",
  "/student-support": "support",
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, userRole, logout } = useAuth();

  // If logged-in user is an admin, immediately redirect to Admin Console and avoid student calls
  useEffect(() => {
    const currentRole = userRole || localStorage.getItem("userRole") || authUser?.role;
    if (currentRole === "admin") {
      navigate("/admin-dashboard", { replace: true });
    }
  }, [userRole, authUser, navigate]);

  // Navigation and UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(
    () => STUDENT_ROUTE_TABS[location.pathname] || "overview"
  );

  // Sync activeTab whenever the route URL changes
  useEffect(() => {
    const routeTab = STUDENT_ROUTE_TABS[location.pathname];
    if (routeTab) {
      setActiveTab(routeTab);
    }
  }, [location.pathname]);

  // Live Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [dashboardStats, setDashboardStats] = useState(null);
  const [eligibleDrives, setEligibleDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [user, setUser] = useState(null);
  const dashboardRequestId = useRef(0);
  const notificationRequestId = useRef(0);
  const accountId = useRef(authUser?._id);
  const authUserId = authUser?._id;
  const authUserRole = authUser?.role;

  // Profile Drawer & Modification Review State
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [drawerSection, setDrawerSection] = useState("academic");
  const [drawerEditing, setDrawerEditing] = useState(false);
  const [isModModalOpen, setIsModModalOpen] = useState(false);

  const isProfileLocked = Boolean(
    studentProfile?.isProfileLocked && studentProfile?.verificationStatus !== "REVERIFICATION_REQUESTED"
  );

  const handleOpenProfileToSection = (section = "academic", edit = true) => {
    if (!studentProfile) {
      toast.error("Your student profile is unavailable. Refresh or contact the TPO office.");
      return;
    }
    setDrawerSection(section);
    setDrawerEditing(section === "certificates" ? Boolean(edit) : Boolean(edit && !isProfileLocked));
    setIsProfileDrawerOpen(true);
  };

  const getSectionForField = (field = "") => {
    const f = (field || "").toLowerCase();
    if (f.includes("10th") || f.includes("12th") || f.includes("secondary") || f.includes("diploma")) {
      return "secondary";
    }
    if (f.includes("resume") || f.includes("document")) {
      return "resume";
    }
    if (f.includes("sgpa") || f.includes("semester")) {
      return "semesters";
    }
    if (f.includes("backlog")) {
      return "backlogs";
    }
    if (f.includes("certificate") || f.includes("credential")) {
      return "certificates";
    }
    if (f.includes("gap")) {
      return "gaps";
    }
    if (f.includes("contact") || f.includes("family") || f.includes("address") || f.includes("avatar") || f.includes("phone")) {
      return "family";
    }
    return "academic";
  };

  // Apply Modal State
  const [selectedDriveToApply, setSelectedDriveToApply] = useState(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  const semMap = useMemo(() => {
    const map = {};
    const semesterResults = Array.isArray(studentProfile?.semesterResults)
      ? studentProfile.semesterResults.filter((result) => result && typeof result === "object")
      : [];
    semesterResults.forEach((s) => {
      map[s.semester] = s.sgpa;
    });
    return map;
  }, [studentProfile]);

  // Notification / Message Center States
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifFilter, setNotifFilter] = useState("all");
  const [selectedNotification, setSelectedNotification] = useState(null);
  useOverlay(Boolean(selectedNotification), () => setSelectedNotification(null));

  useEffect(() => {
    const nextAccountId = authUser?._id;
    if (
      accountId.current &&
      nextAccountId &&
      String(accountId.current) !== String(nextAccountId)
    ) {
      dashboardRequestId.current += 1;
      notificationRequestId.current += 1;
      setStudentProfile(null);
      setProfileLoadError("");
      setDashboardStats(null);
      setEligibleDrives([]);
      setApplications([]);
      setNotifications([]);
      setUnreadCount(0);
      setLoadingNotifs(false);
      setSelectedNotification(null);
      setUser(null);
      setLoading(true);
    }
    accountId.current = nextAccountId;
  }, [authUser?._id]);

  // Notifications loader & auto-poll
  const fetchNotifications = useCallback(async () => {
    const requestId = ++notificationRequestId.current;
    try {
      setLoadingNotifs(true);
      const res = await getMyNotifications();
      if (requestId === notificationRequestId.current && res?.data) {
        setNotifications(Array.isArray(res.data.notifications) ? res.data.notifications : []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      if (requestId === notificationRequestId.current) {
        console.warn("Notifications sync notice:", err.message);
      }
    } finally {
      if (requestId === notificationRequestId.current) setLoadingNotifs(false);
    }
  }, [authUserId, setLoadingNotifs, setNotifications, setUnreadCount]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Full Day, Date, Time formatting helper
  const formatNotificationFullDate = (dateStr) => {
    if (!dateStr) return "Just now";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      const diffSec = Math.floor((new Date() - new Date(dateStr)) / 1000);
      if (diffSec < 60) return "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

  const getNotificationTypeConfig = (type = "") => {
    switch (type) {
      case "urgent":
        return {
          label: "Urgent Alert",
          badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
          icon: AlertCircle,
          iconBg: "bg-rose-50 text-rose-600",
        };
      case "interview":
        return {
          label: "Interview Schedule",
          badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
          icon: Calendar,
          iconBg: "bg-purple-50 text-purple-600",
        };
      case "selection":
      case "offer":
        return {
          label: "Offer / Selection",
          badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
          icon: Trophy,
          iconBg: "bg-emerald-50 text-emerald-600",
        };
      case "deadline_reminder":
        return {
          label: "Deadline Reminder",
          badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
          icon: Clock,
          iconBg: "bg-amber-50 text-amber-600",
        };
      case "announcement":
        return {
          label: "TPO Announcement",
          badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
          icon: Bell,
          iconBg: "bg-blue-50 text-blue-600",
        };
      case "rejection":
        return {
          label: "Status Update",
          badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
          icon: MessageSquare,
          iconBg: "bg-slate-50 text-slate-500",
        };
      default:
        return {
          label: "Recruitment Update",
          badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
          icon: MessageSquare,
          iconBg: "bg-blue-50 text-blue-600",
        };
    }
  };

  const handleOpenNotificationModal = async (notification) => {
    setSelectedNotification(notification);
    if (!notification.isRead) {
      try {
        await markNotificationAsRead(notification._id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n))
        );
      } catch (err) {
        console.warn("Mark read notice:", err.message);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error("Could not mark notifications read");
    }
  };

  const handleDeleteNotification = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (selectedNotification?._id === id) {
        setSelectedNotification(null);
      }
      toast.success("Notification removed");
    } catch (err) {
      toast.error("Failed to delete notification");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all your notifications?")) return;
    try {
      await clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      setSelectedNotification(null);
      toast.success("All notifications cleared");
    } catch (err) {
      toast.error("Failed to clear notifications");
    }
  };

  const displayedNotifications = useMemo(() => {
    if (notifFilter === "unread") {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, notifFilter]);

  // Load all dashboard data
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    const requestId = ++dashboardRequestId.current;
    const isCurrentRequest = () => requestId === dashboardRequestId.current;
    const currentRole = userRole || localStorage.getItem("userRole") || authUserRole;
    if (currentRole === "admin") {
      navigate("/admin-dashboard", { replace: true });
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const failedSections = [];
    let sessionExpired = false;
    const recordLoadFailure = (section, error) => {
      console.warn(`${section} load failed:`, error.message);
      failedSections.push(section);
      sessionExpired ||= error.response?.status === 401;
    };

    try {
      // 1. Fetch Student Profile
      try {
        const profileRes = await getCurrentStudentProfile();
        if (!isCurrentRequest()) return;
        if (profileRes.data && typeof profileRes.data === "object") {
          const profileUserId = profileRes.data.user?._id;
          if (
            authUserId &&
            profileUserId &&
            String(profileUserId) !== String(authUserId)
          ) {
            setStudentProfile(null);
            setProfileLoadError("The loaded profile does not match the signed-in account. Sign out and sign in again.");
            failedSections.push("student profile (account mismatch)");
          } else {
            setStudentProfile(profileRes.data);
            setProfileLoadError("");
            if (profileRes.data.user) setUser(profileRes.data.user);
          }
        } else {
          setStudentProfile(null);
          setProfileLoadError("The student profile response was empty. Refresh or contact the TPO office.");
          failedSections.push("student profile (unexpected response)");
        }
      } catch (err) {
        if (!isCurrentRequest()) return;
        if (err.response?.status === 404) {
          setStudentProfile(null);
          setProfileLoadError("No student profile is linked to this account yet. Contact the TPO office to complete the profile setup.");
          setDashboardStats(null);
          setEligibleDrives([]);
          setApplications([]);
          return;
        } else {
          setProfileLoadError("We could not load your student profile. Check your connection and try again.");
        }
        recordLoadFailure("Student profile", err);
      }

      // 2. Fetch Dashboard Stats
      try {
        const statsRes = await getStudentDashboardStats();
        if (!isCurrentRequest()) return;
        if (statsRes.data && typeof statsRes.data === "object") {
          setDashboardStats(statsRes.data);
          if (statsRes.data.upcomingDrives?.length > 0) {
            setEligibleDrives(statsRes.data.upcomingDrives);
          }
          if (statsRes.data.recentApplications?.length > 0) {
            setApplications(statsRes.data.recentApplications);
          }
        } else {
          failedSections.push("dashboard statistics (unexpected response)");
        }
      } catch (err) {
        if (!isCurrentRequest()) return;
        recordLoadFailure("Dashboard statistics", err);
      }

      // 3. Fetch Eligible Drives directly
      try {
        const drivesRes = await getMyEligibleDrives();
        if (!isCurrentRequest()) return;
        if (Array.isArray(drivesRes?.data)) {
          setEligibleDrives(drivesRes.data);
        } else {
          failedSections.push("eligible drives (unexpected response)");
        }
      } catch (err) {
        if (!isCurrentRequest()) return;
        recordLoadFailure("Eligible drives", err);
      }

      // 4. Fetch All Applications
      try {
        const appsRes = await getMyApplications();
        if (!isCurrentRequest()) return;
        if (Array.isArray(appsRes?.data)) {
          setApplications(appsRes.data);
        } else {
          failedSections.push("applications (unexpected response)");
        }
      } catch (err) {
        if (!isCurrentRequest()) return;
        recordLoadFailure("Applications", err);
      }

      if (failedSections.length > 0 && !sessionExpired) {
        toast.error(`Unable to load ${failedSections.join(", ")}.`);
      }
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.error("Dashboard data load error:", error);
    } finally {
      if (isCurrentRequest()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [authUserId, authUserRole, navigate, userRole]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    setActiveTab(STUDENT_ROUTE_TABS[location.pathname] || "overview");
  }, [location.pathname]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const destination = Object.entries(STUDENT_ROUTE_TABS).find(
      ([, routeTab]) => routeTab === tab
    )?.[0];

    if (destination) {
      navigate(destination);
    }
  };

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
    const serverProfileScore = dashboardStats?.profileScore;
    if (serverProfileScore && Array.isArray(serverProfileScore.checklist)) {
      return {
        ...serverProfileScore,
        percentage: Number.isFinite(serverProfileScore.percentage)
          ? serverProfileScore.percentage
          : 0,
        missingItems: Array.isArray(serverProfileScore.missingItems)
          ? serverProfileScore.missingItems
          : serverProfileScore.checklist.filter((item) => !item.completed)
      };
    }

    const checklist = [
      { field: "Basic Details", completed: Boolean(studentProfile?.enrollmentNumber && (user?.fullName || authUser?.fullName)), points: 20, hint: "Name & Enrollment number" },
      { field: "Contact Info", completed: Boolean(user?.email && (user?.phone || studentProfile?.phone || studentProfile?.alternatePhone)), points: 15, hint: "Email & Phone number" },
      { field: "Academic Standing", completed: Boolean(studentProfile?.branch && studentProfile?.cgpa), points: 25, hint: "Branch & CGPA" },
      { field: "10th & 12th Marks", completed: Boolean(studentProfile?.tenthPercentage && studentProfile?.twelfthPercentage), points: 20, hint: "Board exam percentages" },
      { field: "Verified Resume", completed: Boolean(studentProfile?.resume?.url), points: 20, hint: "Uploaded verified resume" }
    ];

    const percentage = checklist.reduce((acc, c) => (c.completed ? acc + c.points : acc), 0);
    const missingItems = checklist.filter((c) => !c.completed);
    return { percentage, checklist, missingItems };
  }, [dashboardStats, studentProfile, user, authUser]);

  const certificates = Array.isArray(studentProfile?.certificates)
    ? studentProfile.certificates
    : [];

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
    // Look for application with offer or selection
    const selectedApp = applications.find((app) =>
      ["offer_accepted", "selected", "offer_received"].includes(app.status)
    );
    if (!selectedApp) return null;
    const drive = selectedApp.placementDrive || {};
    const company =
      typeof drive.company === "object" ? drive.company?.companyName : drive.companyName || "Corporate Partner";
    return {
      applicationId: selectedApp._id,
      status: selectedApp.status,
      companyName: company,
      jobTitle: drive.jobTitle || "Software Engineer",
      package: selectedApp.offeredPackage || drive.package || 18,
      selectedAt: selectedApp.statusUpdatedAt || selectedApp.updatedAt,
    };
  }, [dashboardStats, applications]);

  // Apply Handler
  const handleOpenApplyModal = (drive) => {
    setSelectedDriveToApply(drive);
    setIsApplyModalOpen(true);
  };

  const handleConfirmApply = async (driveId, resumeFile = null, customAnswers = []) => {
    try {
      await applyForDrive(driveId, resumeFile, customAnswers);
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

  // Student Respond to Offer (Accept / Decline)
  const handleRespondOffer = async (applicationId, decision, companyName) => {
    const isAccept = decision === "accept";
    const confirmMessage = isAccept
      ? `Are you sure you want to ACCEPT the placement offer from ${companyName}? This will confirm your selection and mark your profile as officially placed.`
      : `Are you sure you want to DECLINE / REJECT the offer from ${companyName}? You will not be marked as placed and will remain eligible for other recruitment opportunities.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await respondToOffer(applicationId, decision);
      toast.success(
        isAccept
          ? `🎉 Offer accepted! Congratulations on being placed at ${companyName}!`
          : `Offer declined for ${companyName}. You remain eligible for other drives.`
      );
      loadDashboardData(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || `Failed to ${decision} offer`;
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
  const studentBranch = studentProfile?.branch || studentProfile?.department || "Department Not Set";
  const studentCgpa = studentProfile?.cgpa ?? "--";
  const graduationYear = studentProfile?.graduationYear ?? "----";
  const admissionYear = studentProfile?.admissionYear;
  const sessionName = studentProfile?.placementSession?.name || (studentProfile?.graduationYear ? `Class of ${studentProfile.graduationYear} Placement Session` : "Session Pending");

  return (
    <div className="min-h-screen bg-canvas text-slate-900 flex antialiased">
      {/* 
        Responsive Sidebar: 
        On desktop (>= 1024px), it is a normal flex child (sticky, w-64 xl:w-72), so it CANNOT overlap content!
        On mobile (< 1024px), it is hidden until toggled as a slide-out drawer.
      */}
      <StudentSidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        user={user}
        studentProfile={studentProfile}
        onLogout={handleLogout}
        unreadCount={unreadCount}
      />

      {/* Main Layout Area: Fills 100% of remaining width */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Sticky Header */}
        <StudentNavbar
            key={authUserId}
            onMenuClick={() => setIsSidebarOpen(true)}
          activeTab={activeTab}
          user={user}
          studentProfile={studentProfile}
          onOpenProfile={() => handleOpenProfileToSection("all", false)}
          onSelectTab={handleTabChange}
          unreadCount={unreadCount}
          onRefreshNotifications={fetchNotifications}
        />

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          {/* Keyed wrapper: each tab fades in on navigation */}
          <div key={activeTab} className="animate-page space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Top Greeting Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-[11px] font-bold border border-blue-200">
                      {studentBranch}
                    </span>
                    <span className="rounded-full bg-purple-50 text-purple-700 px-2.5 py-0.5 text-[11px] font-bold border border-purple-200">
                      {sessionName}
                    </span>
                    {(studentProfile?.usn || studentProfile?.enrollmentNumber) && (
                      <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[11px] font-semibold border border-slate-200">
                        USN: {studentProfile.usn || studentProfile.enrollmentNumber}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-[1.75rem] font-extrabold text-slate-900 tracking-tight break-words">
                    Welcome back, {studentName} 👋
                  </h2>
                  <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
                    {studentProfile?.degreeType || studentProfile?.course || ""} {admissionYear ? `• Admitted: ${admissionYear}` : ""} • Expected Graduation: Class of {graduationYear} • Academic CGPA: {typeof studentCgpa === "number" ? studentCgpa.toFixed(2) : studentCgpa}
                  </p>
                </div>

                {/* Top Right Action Controls */}
                <div className="flex items-center gap-2.5">
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
                    <span>{refreshing ? "Syncing..." : "Sync Live Data"}</span>
                  </button>
                </div>
              </div>
              {/* Placed Student Offer Celebration Banner */}
              {offerDetails && (
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 p-6 text-white shadow-xl animate-in fade-in-50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner text-3xl">
                        {offerDetails.status === "offer_accepted" ? "🎓" : "🎉"}
                      </div>
                      <div>
                        <span className="rounded-full bg-emerald-400/20 px-3 py-0.5 text-xs font-bold text-emerald-200 border border-emerald-300/30">
                          {offerDetails.status === "offer_accepted"
                            ? "Official Placement Confirmed & Accepted"
                            : "Official Placement Offer Extended — Action Required"}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                          Congratulations, {studentName}!
                        </h3>
                        <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">
                          {offerDetails.status === "offer_accepted" ? "Officially placed as " : "Selected as "}
                          <strong>{offerDetails.jobTitle}</strong> at <strong>{offerDetails.companyName}</strong> with a confirmed offer package of <strong>₹{offerDetails.package} LPA</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      {offerDetails.status !== "offer_accepted" ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleRespondOffer(offerDetails.applicationId, "accept", offerDetails.companyName)
                            }
                            className="rounded-2xl bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-800 shadow-md hover:bg-emerald-50 transition active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>Accept Offer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleRespondOffer(offerDetails.applicationId, "decline", offerDetails.companyName)
                            }
                            className="rounded-2xl bg-rose-500/80 hover:bg-rose-600 text-white border border-rose-400/40 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                            <span>Decline Offer</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleRespondOffer(offerDetails.applicationId, "decline", offerDetails.companyName)
                          }
                          className="rounded-2xl bg-white/20 hover:bg-white/30 text-white border border-white/30 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition active:scale-95 cursor-pointer"
                          title="Decline offer if you chose another opportunity"
                        >
                          Decline Offer
                        </button>
                      )}
                      <button
                        onClick={() => handleTabChange("applications")}
                        className="rounded-2xl bg-emerald-950/40 hover:bg-emerald-950/60 text-white px-4 py-2.5 text-xs sm:text-sm font-bold border border-white/20 transition active:scale-95 cursor-pointer"
                      >
                        All Applications
                      </button>
                    </div>
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

              {/* Profile Completion Readiness Card (Overview Tab Only) */}
              {profileScore.percentage < 100 && (
                <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/40 p-5 sm:p-6 shadow-xs hover:shadow-sm transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
                          <Sparkles className="h-4 w-4 text-yellow-300" />
                        </span>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                            Placement Profile Readiness: {profileScore.percentage}% Complete
                          </h3>
                          <p className="text-xs text-slate-500">
                            Verified profiles unlock company eligibility screening. Click any item below to fill it directly:
                          </p>
                        </div>
                      </div>

                      {/* Interactive missing items chips */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {profileScore.missingItems.map((item) => {
                          const targetSection = getSectionForField(item.field);
                          return (
                            <button
                              key={item.field}
                              type="button"
                              onClick={() => {
                                if (isProfileLocked) {
                                  setIsModModalOpen(true);
                                } else {
                                  handleOpenProfileToSection(targetSection, true);
                                }
                              }}
                              className="group inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50/90 px-2.5 py-1 text-xs font-semibold text-amber-800 shadow-2xs hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition active:scale-95 cursor-pointer"
                              title={isProfileLocked ? `Request modification for ${item.field}` : `Click to fill ${item.field}`}
                            >
                              <Plus className="h-3 w-3 text-amber-600 group-hover:text-blue-600 transition" />
                              <span>Fill {item.field}</span>
                              <ArrowRight className="h-2.5 w-2.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Readiness gauge bar */}
                    <div className="w-full sm:w-52 shrink-0 flex flex-col items-end justify-center">
                      <div className="w-full flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                        <span>Readiness</span>
                        <span className="text-blue-600">{profileScore.percentage}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 transition-all duration-700"
                          style={{ width: `${profileScore.percentage}%` }}
                        />
                      </div>
                      {isProfileLocked ? (
                        <button
                          type="button"
                          onClick={() => setIsModModalOpen(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 cursor-pointer"
                        >
                          <Lock className="h-3.5 w-3.5 text-amber-600" />
                          <span>Request TPO Modification</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenProfileToSection("academic", true)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                        >
                          <span>Edit Full Profile</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Stat Metric Cards */}
              <DashboardStats
                stats={aggregatedStats}
                studentProfile={studentProfile}
                onTabChange={handleTabChange}
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
                      onClick={() => handleTabChange("drives")}
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
                    onRespondOffer={handleRespondOffer}
                    title="Recent Application Pipeline"
                    description="Your latest submissions and status updates"
                    showSearch={false}
                    maxItems={3}
                  />
                  <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                    <button
                      onClick={() => handleTabChange("applications")}
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
                onRefresh={() => loadDashboardData(true)}
                refreshing={refreshing}
              />
            </div>
          )}

          {/* TAB 3: MY APPLICATIONS */}
          {activeTab === "applications" && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
              <RecentApplications
                applications={activeApplicationsList}
                onWithdraw={handleWithdraw}
                onRespondOffer={handleRespondOffer}
                title="My Applications History"
                description="Real-time recruitment status updates from visiting companies"
                showSearch={true}
              />
            </div>
          )}

          {activeTab === "support" && <StudentSupportChat />}

          {/* TAB 4: ACADEMIC PROFILE */}
          {activeTab === "profile" && !studentProfile && (
            <section
              className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-xs sm:p-8"
              role="status"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">Student profile unavailable</h3>
              <p className="mt-2 text-sm text-slate-600">
                {profileLoadError || "Your academic profile could not be loaded."}
              </p>
              <button
                type="button"
                onClick={() => loadDashboardData(true)}
                disabled={refreshing}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Retry profile load
              </button>
            </section>
          )}

          {activeTab === "profile" && studentProfile && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Academic Profile</h3>
                  <p className="text-xs text-slate-500">
                    Your verified credentials used for campus placements
                  </p>
                </div>
                {isProfileLocked ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900">
                      <Lock className="h-3.5 w-3.5 text-amber-700" />
                      <span>Record Locked</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsModModalOpen(true)}
                      className="rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition"
                    >
                      Request Modification
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleOpenProfileToSection("all", true)}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                  >
                    Edit Portfolio
                  </button>
                )}
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
                    {studentProfile?.semester ?? studentProfile?.currentSemester ?? "—"}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Full Name: </span>
                    <strong className="text-slate-800 text-xs">{studentName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Email Address: </span>
                    <strong className="text-slate-800 text-xs">{user?.email || "Not entered"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Mobile / Phone Number: </span>
                    <strong className="text-blue-800 text-xs flex items-center gap-1 font-mono">
                      <Phone className="h-3 w-3 text-blue-600 shrink-0" />
                      <span>{studentProfile?.alternatePhone || studentProfile?.phone || user?.phone || "No phone recorded"}</span>
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Enrollment ID (USN): </span>
                    <strong className="text-slate-800 text-xs font-mono">
                      {studentProfile?.enrollmentNumber || studentProfile?.usn || "Not assigned"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Department / Branch: </span>
                    <strong className="text-slate-800 text-xs">{studentBranch}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Gender: </span>
                    <strong className="text-slate-800 text-xs">{studentProfile?.gender || "Not specified"}</strong>
                  </div>
                  {studentProfile?.dob && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">Date of Birth: </span>
                      <strong className="text-slate-800 text-xs">
                        {new Date(studentProfile.dob).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </strong>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block text-[11px]">Current Semester: </span>
                    <strong className="text-slate-800 text-xs">
                      {studentProfile?.semester || studentProfile?.currentSemester
                        ? `Semester ${studentProfile.semester ?? studentProfile.currentSemester}`
                        : "Not entered"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Batch: </span>
                    <strong className="text-slate-800 text-xs">Class of {graduationYear}</strong>
                  </div>
                </div>
              </div>

              {/* Secondary & Higher Secondary Education (10th & 12th/Diploma) */}
              <div className="rounded-xl border border-slate-100 p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <Award className="h-4 w-4 text-emerald-600" />
                    <span>Secondary & Higher Secondary Records</span>
                  </h4>
                  {isProfileLocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                      <Lock className="h-3 w-3" /> Record Locked
                    </span>
                  ) : (
                    <button
                      onClick={() => handleOpenProfileToSection("secondary", true)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      Edit Records
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* 10th Record */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900 uppercase text-[11px]">10th Standard (SSC)</span>
                      <span className="text-sm font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                        {studentProfile?.tenthDetails?.percentage ?? studentProfile?.tenthPercentage ?? "--"}%
                      </span>
                    </div>
                    <p className="font-bold text-slate-700">{studentProfile?.tenthDetails?.schoolName || "School Name not entered"}</p>
                    <p className="text-slate-500 text-[11px]">
                      Board: {studentProfile?.tenthDetails?.board || "Not entered"} • Passing Year: {studentProfile?.tenthDetails?.passingYear || "--"}
                    </p>
                  </div>

                  {/* 12th / Diploma Record */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900 uppercase text-[11px]">
                        {studentProfile?.twelfthOrDiplomaDetails?.qualificationType || "Class 12"} Record
                      </span>
                      <span className="text-sm font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                        {studentProfile?.twelfthOrDiplomaDetails?.percentage ?? studentProfile?.twelfthPercentage ?? "--"}%
                      </span>
                    </div>
                    <p className="font-bold text-slate-700">{studentProfile?.twelfthOrDiplomaDetails?.institutionName || "Institution not entered"}</p>
                    <p className="text-slate-500 text-[11px]">
                      Authority: {studentProfile?.twelfthOrDiplomaDetails?.boardOrUniversity || "Not entered"} • Passing Year: {studentProfile?.twelfthOrDiplomaDetails?.passingYear || "--"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Semester-Wise SGPA Ledger */}
              <div className="rounded-xl border border-slate-100 p-5 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <span>Semester-Wise SGPA Breakdown (Sem 1 - 8)</span>
                  </h4>
                  <button
                    onClick={() => handleOpenProfileToSection("semesters", false)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    Manage SGPAs
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                    const sgpaVal = semMap[sem];
                    const hasVal = sgpaVal !== undefined && sgpaVal !== null;
                    return (
                      <div key={sem} className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-600">Semester {sem}</span>
                          {hasVal ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <span className="text-[10px] text-slate-400">Pending</span>
                          )}
                        </div>
                        <p className={`text-lg font-extrabold font-mono ${hasVal ? "text-blue-600" : "text-slate-300"}`}>
                          {hasVal ? Number(sgpaVal).toFixed(2) : "--"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Backlogs & Education Gaps Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Backlogs Card */}
                <div className="rounded-xl border border-slate-100 p-5 space-y-3 bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>Backlogs & Arrears</span>
                  </h4>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Active Arrears:</span>
                      <span className={`text-sm font-extrabold ${studentProfile?.backlogs > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {studentProfile?.backlogs ?? 0}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {studentProfile?.backlogs > 0
                        ? `${studentProfile.backlogs} active arrear(s) recorded.`
                        : "0 Active Arrears — Clean Academic Record."}
                    </p>
                  </div>
                </div>

                {/* Education Gaps Card */}
                <div className="rounded-xl border border-slate-100 p-5 space-y-3 bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <span>Education Gaps</span>
                  </h4>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Declared Gaps:</span>
                      <span className="text-xs font-extrabold text-slate-800">
                        {studentProfile?.hasEducationGap ? `${studentProfile?.educationGaps?.length || 1} Period(s)` : "None"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {studentProfile?.hasEducationGap
                        ? studentProfile?.educationGaps?.[0]?.reason || "Gap period declared."
                        : "Continuous academic track record."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Family & Address Information */}
              <div className="rounded-xl border border-slate-100 p-5 space-y-3 bg-slate-50/50 text-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                  <Home className="h-4 w-4 text-slate-600" />
                  <span>Family & Address Details</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold block">Parents</span>
                    <p className="font-bold text-slate-800">
                      Father: {studentProfile?.family?.fatherName || "Not entered"}
                      {studentProfile?.family?.fatherPhone ? ` (${studentProfile.family.fatherPhone})` : ""}
                    </p>
                    <p className="font-bold text-slate-800">
                      Mother: {studentProfile?.family?.motherName || "Not entered"}
                      {studentProfile?.family?.motherPhone ? ` (${studentProfile.family.motherPhone})` : ""}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold block">Current Address</span>
                    <p className="font-bold text-slate-800">{studentProfile?.currentAddress?.street || "Not entered"}</p>
                    <p className="text-slate-500 text-[11px]">
                      {studentProfile?.currentAddress?.city ? `${studentProfile.currentAddress.city}, ` : ""}
                      {studentProfile?.currentAddress?.state ? `${studentProfile.currentAddress.state} ` : ""}
                      {studentProfile?.currentAddress?.pincode ? `- ${studentProfile.currentAddress.pincode}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Master Placement Resume Card */}
              <div className="rounded-xl border border-slate-100 p-5 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span>Master Placement Resume</span>
                  </h4>
                  {isProfileLocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                      <Lock className="h-3 w-3" /> Record Locked
                    </span>
                  ) : (
                    <button
                      onClick={() => handleOpenProfileToSection("resume", true)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      Upload / Replace
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className={`h-4 w-4 ${studentProfile?.resume?.url ? "text-emerald-500" : "text-amber-500"}`} />
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {studentProfile?.resume?.url ? "Active Placement Resume Attached" : "No Resume Uploaded Yet"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Used automatically by recruiters when you apply to placement drives.
                      </p>
                    </div>
                  </div>
                  {studentProfile?.resume?.url && (
                    <a
                      href={getResumeViewUrl(studentProfile.resume.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition border border-blue-200"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>View Resume</span>
                    </a>
                  )}
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
                        {certificates.length}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Verified professional credentials and online certifications
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenProfileToSection("certificates", true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-2xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Add Certificate</span>
                    </button>
                    <button
                      onClick={() => handleOpenProfileToSection("certificates", true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                    >
                      <span>Manage</span>
                    </button>
                  </div>
                </div>

                {certificates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
                    <Award className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">
                      No certifications added yet
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Add your certifications and verification links to impress campus recruiters.
                    </p>
                    <button
                      onClick={() => handleOpenProfileToSection("certificates", true)}
                      className="mt-3 inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-2xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Add Credentials</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {certificates.map((cert, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-blue-200 transition flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                            <Award className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="font-bold text-xs text-slate-900 leading-tight truncate">
                                {cleanCertificateTitle(cert.title, cert.issuer)}
                              </h5>
                              {cert.verificationStatus === "Verified" ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                                  <span>Verified</span>
                                </span>
                              ) : cert.verificationStatus === "Needs Review" ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock className="h-2.5 w-2.5 text-amber-600" />
                                  <span>Needs Review</span>
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                              {cert.issuer || "Issuing Body"}
                              {cert.issueDate ? ` • ${cert.issueDate}` : ""}
                            </p>
                            {(cert.recipientName || cert.extractedRecipientName) && (
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                Recipient: <strong className="text-slate-800">{cert.recipientName || cert.extractedRecipientName}</strong>
                              </p>
                            )}
                            {cert.credentialId && (
                              <span className="inline-block mt-1 font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                ID: {cert.credentialId}
                              </span>
                            )}
                          </div>
                        </div>

                        {cert.duplicateStatus === "CROSS_STUDENT_DUPLICATE" && (
                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium flex items-start gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>This credential appears to be associated with another submission. Additional ownership verification is required.</span>
                          </div>
                        )}

                        {(() => {
                          const credUrl = getEffectiveCredentialUrl(cert);
                          return credUrl ? (
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span>{cert.verificationStatus || "Credential"}</span>
                              </span>
                              <a
                                href={credUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                <span>[View Credential]</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 italic">
                              No credential URL attached
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: NOTIFICATIONS & MESSAGES */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              {/* Header card */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                      Message & Notification Center
                    </h3>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                        {unreadCount} Unread
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Official announcements, placement interview schedules, and drive status alerts with full timestamps
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setNotifFilter("all")}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                        notifFilter === "all"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifFilter("unread")}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                        notifFilter === "unread"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Unread ({unreadCount})
                    </button>
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Check className="h-3.5 w-3.5 text-slate-500" />
                      <span>Mark all read</span>
                    </button>
                  )}

                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      <span>Clear all</span>
                    </button>
                  )}

                  <button aria-label="Refresh messages"
                    type="button"
                    onClick={fetchNotifications}
                    disabled={loadingNotifs}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                    title="Refresh messages"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingNotifs ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Message List */}
              {displayedNotifications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mx-auto mb-3">
                    <Bell className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No notifications found</h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                    {notifFilter === "unread"
                      ? "You're all caught up! No unread placement alerts or announcements."
                      : "Official recruitment updates and TPO notices will appear here."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedNotifications.map((notif) => {
                    const typeConfig = getNotificationTypeConfig(notif.type);
                    const TypeIcon = typeConfig.icon;
                    return (
                      <div
                        key={notif._id}
                        onClick={() => handleOpenNotificationModal(notif)}
                        className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer ${
                          !notif.isRead
                            ? "bg-blue-50/40 border-blue-200/90 shadow-xs hover:border-blue-400 hover:bg-blue-50/70"
                            : "bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeConfig.iconBg} border border-slate-100 shadow-2xs group-hover:scale-105 transition-transform`}
                          >
                            <TypeIcon className="h-5 w-5" />
                          </div>

                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${typeConfig.badgeColor}`}
                              >
                                {typeConfig.label}
                              </span>
                              {notif.companyName && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                  <Building2 className="h-3 w-3 text-slate-400" />
                                  {notif.companyName}
                                </span>
                              )}
                              {!notif.isRead && (
                                <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                              )}
                            </div>

                            <h4
                              className={`text-sm font-bold tracking-tight truncate ${
                                !notif.isRead ? "text-slate-900 font-extrabold" : "text-slate-800"
                              }`}
                            >
                              {notif.title}
                            </h4>

                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {notif.message}
                            </p>

                            {/* Interview details preview */}
                            {(notif.interviewDate || notif.interviewRound || notif.interviewLocation) && (
                              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-purple-700 font-semibold">
                                {notif.interviewDate && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      {new Date(notif.interviewDate).toLocaleDateString("en-IN", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </span>
                                )}
                                {notif.interviewRound && (
                                  <span>• Round: {notif.interviewRound}</span>
                                )}
                                {notif.interviewLocation && (
                                  <span>• 📍 {notif.interviewLocation}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Full Day, Date, Time Stamp & Action */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="text-left sm:text-right space-y-0.5">
                            <p className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                              {formatNotificationFullDate(notif.createdAt)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {formatRelativeTime(notif.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 sm:mt-2">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteNotification(notif._id, e)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete notification"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                              <span>Read message</span>
                              <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          </div>
        </main>
      </div>

      {/* Slide-over Profile Drawer */}
      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => {
          setIsProfileDrawerOpen(false);
          setDrawerEditing(false);
        }}
        user={user}
        studentProfile={studentProfile}
        initialSection={drawerSection}
        initialEditing={drawerEditing}
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
        onOpenProfileSettings={() => handleOpenProfileToSection("academic", true)}
      />

      {/* Profile Modification Request Modal */}
      <ProfileModificationModal
        isOpen={isModModalOpen}
        onClose={() => setIsModModalOpen(false)}
        studentProfile={studentProfile || {}}
        user={user || {}}
        onRequestSubmitted={() => loadDashboardData(true)}
      />

      {/* Selected Notification Reading Modal with Full Day, Date, Time */}
      {selectedNotification && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Notification details"
        >
          <div className="cf-backdrop" aria-hidden="true" onClick={() => setSelectedNotification(null)} />
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              aria-label="Close notification"
              onClick={() => setSelectedNotification(null)}
              className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Notification Header */}
            {(() => {
              const cfg = getNotificationTypeConfig(selectedNotification.type);
              const Icon = cfg.icon;
              return (
                <div className="flex items-start gap-3.5 pr-8">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${cfg.iconBg} border border-slate-100 shadow-xs`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${cfg.badgeColor}`}>
                        {cfg.label}
                      </span>
                      {selectedNotification.companyName && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          {selectedNotification.companyName}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {selectedNotification.title}
                    </h3>
                  </div>
                </div>
              );
            })()}

            {/* Timestamp Bar (Day, Date, Time) */}
            <div className="mt-4 rounded-xl bg-slate-50 p-2.5 px-3 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-bold text-slate-800">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span>{formatNotificationFullDate(selectedNotification.createdAt)}</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {formatRelativeTime(selectedNotification.createdAt)}
              </span>
            </div>

            {/* Message Body */}
            <div className="mt-4 rounded-2xl bg-white border border-slate-100 p-4 shadow-2xs">
              <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                {selectedNotification.message}
              </p>
            </div>

            {/* Interview Specific Details Card */}
            {(selectedNotification.interviewDate || selectedNotification.interviewLocation || selectedNotification.interviewRound) && (
              <div className="mt-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/80 p-3.5 space-y-2 text-xs">
                <h5 className="font-bold text-purple-950 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <span>Interview Evaluation Logistics</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-purple-900">
                  {selectedNotification.interviewRound && (
                    <div>
                      <span className="text-purple-600 font-medium">Evaluation Round: </span>
                      <strong>{selectedNotification.interviewRound}</strong>
                    </div>
                  )}
                  {selectedNotification.interviewDate && (
                    <div>
                      <span className="text-purple-600 font-medium">Date & Time: </span>
                      <strong>{formatNotificationFullDate(selectedNotification.interviewDate)}</strong>
                    </div>
                  )}
                  {selectedNotification.interviewLocation && (
                    <div className="sm:col-span-2">
                      <span className="text-purple-600 font-medium">Venue / Link: </span>
                      <strong>{selectedNotification.interviewLocation}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Offer Specific Details Card */}
            {selectedNotification.offeredPackage && (
              <div className="mt-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 p-3.5 flex items-center justify-between text-xs">
                <div>
                  <h5 className="font-bold text-emerald-950">Confirmed CTC Package</h5>
                  <p className="text-[11px] text-emerald-700">Extended offer for {selectedNotification.jobTitle || "Role"}</p>
                </div>
                <span className="text-sm font-extrabold text-emerald-700 bg-white px-3 py-1 rounded-xl border border-emerald-300">
                  ₹{selectedNotification.offeredPackage} LPA
                </span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteNotification(selectedNotification._id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                <span>Delete</span>
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNotification(null);
                    handleTabChange("drives");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold transition shadow-xs"
                >
                  <span>Explore Drives</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
