import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/authContextDef";

export default function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-500">Authenticating session...</p>
        </div>
      </div>
    );
  }

  // Not authenticated -> redirect to login with return path and suggested role
  if (!isAuthenticated) {
    const roleParam = requiredRole ? `&role=${requiredRole}` : "";
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname)}${roleParam}`}
        replace
      />
    );
  }

  // Role mismatch protection
  if (requiredRole && userRole && userRole !== requiredRole) {
    if (userRole === "admin") {
      return <Navigate to="/admin-dashboard" replace />;
    }
    return <Navigate to="/student-dashboard" replace />;
  }

  return children;
}
