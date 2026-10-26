import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";

const IndexHome = lazy(() => import("./components/HomePageDashboard/IndexHome"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));

function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        gutter={10}
        containerStyle={{ top: 16, right: 16, left: 16 }}
        toastOptions={{
          duration: 3500,
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            borderRadius: "0.875rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            lineHeight: 1.45,
            padding: "10px 14px",
            maxWidth: "420px",
            boxShadow: "0 12px 24px -6px rgb(15 23 42 / 0.25), 0 4px 8px -2px rgb(15 23 42 / 0.12)",
          },
          success: { iconTheme: { primary: "#34d399", secondary: "#0f172a" } },
          error: { duration: 5000, iconTheme: { primary: "#fb7185", secondary: "#0f172a" } },
        }}
      />
      <Suspense
        fallback={
          <div
            className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas text-sm font-semibold text-slate-500"
            role="status"
          >
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" aria-hidden="true" />
            Loading CampusFlow…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<IndexHome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected Student Portal Routes */}
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/placement-drives"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-applications"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student-profile"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student-support"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin / TPO Portal Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/drives"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard initialTab="drives" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/automated-placement-drives"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard initialTab="automated_drives" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/companies"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard initialTab="companies" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/applications"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard initialTab="applications" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/support"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard initialTab="support" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/students"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard initialTab="students" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard initialTab="analytics" />
            </ProtectedRoute>
          }
        />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
