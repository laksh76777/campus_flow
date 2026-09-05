import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "./context/AuthContext";
import IndexHome from "./components/HomePageDashboard/IndexHome";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import StudentDashboard from "./pages/student/StudentDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";

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

        {/* Student Portal Routes */}
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/placement-drives" element={<StudentDashboard />} />
        <Route path="/my-applications" element={<StudentDashboard />} />
        <Route path="/student-profile" element={<StudentDashboard />} />

        {/* Admin / TPO Portal Routes */}
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/admin/drives" element={<AdminDashboard initialTab="drives" />} />
        <Route path="/admin/companies" element={<AdminDashboard initialTab="companies" />} />
        <Route path="/admin/applications" element={<AdminDashboard initialTab="applications" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;