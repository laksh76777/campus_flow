import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { AuthContext, useAuth } from "./authContextDef";

export { useAuth };

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("accessToken") || "");
  const [user, setUser] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [userRole, setUserRole] = useState(() => localStorage.getItem("userRole") || "student");

  // Load user details & student profile
  const fetchUserData = useCallback(async () => {
    const storedToken = localStorage.getItem("accessToken");
    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      // Get current user info
      const userRes = await api.get("/users/current-user");
      if (userRes.data?.data) {
        const userData = userRes.data.data;
        setUser(userData);
        if (userData.role) {
          setUserRole(userData.role);
          localStorage.setItem("userRole", userData.role);
        }
      }

      // Try fetching student profile ONLY if student
      const activeRole = userRes.data?.data?.role || localStorage.getItem("userRole");
      if (activeRole === "student") {
        try {
          const profileRes = await api.get("/studentprofile/current-student-profile");
          if (profileRes.data?.data) {
            setStudentProfile(profileRes.data.data);
          }
        } catch (err) {
          // Normal for uninitialized student profiles
        }
      } else {
        setStudentProfile(null);
      }
    } catch (error) {
      console.warn("Failed to verify user session:", error.message);
      if (error.response?.status === 401) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("userRole");
        setToken("");
        setUser(null);
        setStudentProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const login = (newToken, userData, explicitRole = null) => {
    localStorage.setItem("accessToken", newToken);
    setToken(newToken);
    // Ground-truth database role takes priority over explicit UI tab role
    const resolvedRole = userData?.role || explicitRole || "student";
    setUserRole(resolvedRole);
    localStorage.setItem("userRole", resolvedRole);
    if (userData) setUser(userData);
    fetchUserData();
  };

  const logout = async () => {
    try {
      const currentRole = userRole || localStorage.getItem("userRole");
      if (currentRole === "admin") {
        await api.post("/admin/logout");
      } else {
        await api.post("/users/logout");
      }
    } catch (err) {
      console.warn("Logout error:", err.message);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userRole");
      setToken("");
      setUser(null);
      setUserRole("student");
      setStudentProfile(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        userRole,
        studentProfile,
        loading,
        isAuthenticated: !!token,
        isAdmin: userRole === "admin",
        login,
        logout,
        refreshProfile: fetchUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
