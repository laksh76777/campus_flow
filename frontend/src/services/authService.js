import axios from "axios";
import { API_BASE_URL, API_CONFIGURATION_ERROR } from "./apiConfig";

const ensureApiConfigured = () => {
  if (API_CONFIGURATION_ERROR) {
    throw new Error(API_CONFIGURATION_ERROR);
  }
};

export const registerStudent = async (userData) => {
  ensureApiConfigured();
  const formData = new FormData();

  Object.keys(userData).forEach((key) => {
    if (key === "avatar") return;
    if (userData[key] !== undefined && userData[key] !== null) {
      formData.append(key, userData[key]);
    }
  });

  if (userData.avatar && typeof userData.avatar !== "string") {
    formData.append("avatar", userData.avatar);
  }

  const response = await axios.post(`${API_BASE_URL}/users/register`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    withCredentials: true,
  });

  return response.data;
};

// Public department list for registration
export const getPublicDepartments = async (course = "") => {
  ensureApiConfigured();
  const url = course ? `${API_BASE_URL}/departments?course=${encodeURIComponent(course)}` : `${API_BASE_URL}/departments`;
  const response = await axios.get(url);
  return response.data;
};

// Public placement sessions list for cohort mapping preview
export const getPublicSessions = async () => {
  ensureApiConfigured();
  const response = await axios.get(`${API_BASE_URL}/sessions`);
  return response.data;
};

// Student Login
export const loginStudent = async (credentials) => {
  ensureApiConfigured();
  const response = await axios.post(`${API_BASE_URL}/users/login`, credentials, {
    withCredentials: true,
  });

  return response.data;
};

// Admin Register
export const registerAdmin = async (userData) => {
  ensureApiConfigured();
  const response = await axios.post(`${API_BASE_URL}/admin/register`, userData, {
    withCredentials: true,
  });
  return response.data;
};

// Admin Login
export const loginAdmin = async (credentials) => {
  ensureApiConfigured();
  const response = await axios.post(`${API_BASE_URL}/admin/login`, credentials, {
    withCredentials: true,
  });

  return response.data;
};

// Logout
export const logoutAuth = async (role = "student") => {
  ensureApiConfigured();
  const endpoint = role === "admin" ? `${API_BASE_URL}/admin/logout` : `${API_BASE_URL}/users/logout`;
  const token = localStorage.getItem("accessToken");
  const response = await axios.post(
    endpoint,
    {},
    {
      withCredentials: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
};

// 1. Request Password Reset OTP
export const requestPasswordResetOtp = async (email, role = "student") => {
  ensureApiConfigured();
  const endpoint = role === "admin" ? `${API_BASE_URL}/admin/forgot-password` : `${API_BASE_URL}/users/forgot-password`;
  const response = await axios.post(endpoint, { email }, { withCredentials: true });
  return response.data;
};

// 2. Verify Password Reset OTP
export const verifyPasswordResetOtp = async ({ email, otp }, role = "student") => {
  ensureApiConfigured();
  const endpoint = role === "admin" ? `${API_BASE_URL}/admin/verify-reset-otp` : `${API_BASE_URL}/users/verify-reset-otp`;
  const response = await axios.post(endpoint, { email, otp }, { withCredentials: true });
  return response.data;
};

// 3. Complete Password Reset
export const completePasswordReset = async ({ resetToken, newPassword, confirmPassword }, role = "student") => {
  ensureApiConfigured();
  const endpoint = role === "admin" ? `${API_BASE_URL}/admin/reset-password` : `${API_BASE_URL}/users/reset-password`;
  const response = await axios.post(
    endpoint,
    { resetToken, newPassword, confirmPassword },
    { withCredentials: true }
  );
  return response.data;
};