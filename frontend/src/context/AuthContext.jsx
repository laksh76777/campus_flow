import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { AuthContext, useAuth } from "./authContextDef";

export { useAuth };

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("accessToken") || "");
  const [user, setUser] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [userRole, setUserRole] = useState(() => 
  localStorage.getItem("userRole") || null
);
  // Load user details & student profile
  const fetchUserData = useCallback(async () => {
    const storedToken = localStorage.getItem("accessToken");
    const storedRole = localStorage.getItem("userRole");

    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      let userRes;

      if (storedRole === "admin") {
        try {
          userRes = await api.get("/admin/current-admin");
        } catch {
          userRes = await api.get("/users/current-user");
        }
      } else {
        userRes = await api.get("/users/current-user");
      }

      if (userRes.data?.data) {
        const resData = userRes.data.data;
        const userData = resData.user || resData;

        setUser(userData);

        const role = userData.role || storedRole || "student";

        setUserRole(role);
        localStorage.setItem("userRole", role);

        if (role === "student") {
          try {
            const profileRes = await api.get(
              "/studentprofile/current-student-profile"
            );

            if (profileRes.data?.data) {
              setStudentProfile(profileRes.data.data);
            }
          } catch (err) {
            console.warn("Student profile error:", err);
          }
        } else {
          setStudentProfile(null);
        }
      }
    } catch (error) {
      console.warn("Failed to verify user session:", error.message);

      if (error.response?.status === 401) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("userRole");

        setToken("");
        setUser(null);
        setUserRole(null);
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

    const resolvedRole = userData?.role || explicitRole || "student";

    setUserRole(resolvedRole);
    localStorage.setItem("userRole", resolvedRole);

    if (userData) {
      setUser(userData);
    }
    if (resolvedRole === "admin") {
      setStudentProfile(null);
    }

    setLoading(false);
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
