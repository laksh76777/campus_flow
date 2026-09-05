import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "./context/AuthContext";
import IndexHome from "./components/HomePageDashboard/IndexHome";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import StudentDashboard from "./pages/student/StudentDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ProtectedRoute from "./components/common/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            borderRadius: "1rem",
            fontSize: "0.875rem",
          },
        }}
      />
      <Routes>
        <Route path="/" element={<IndexHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

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
          path="/student-profile"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin / TPO Portal Routes */}
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;