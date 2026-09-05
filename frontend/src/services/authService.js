import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const registerStudent = async (userData) => {
  const formData = new FormData();

  formData.append("fullName", userData.fullName);
  formData.append("email", userData.email);
  formData.append("password", userData.password);
  formData.append("phone", userData.phone || "");

  if (userData.avatar) {
    formData.append("avatar", userData.avatar);
  }

  const response = await axios.post(`${API_URL}/users/register`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
};

// Student Login
export const loginStudent = async (credentials) => {
  const response = await axios.post(`${API_URL}/users/login`, credentials, {
    withCredentials: true,
  });

  return response.data;
};

// Admin Register
export const registerAdmin = async (userData) => {
  const response = await axios.post(`${API_URL}/admin/register`, userData, {
    withCredentials: true,
  });
  return response.data;
};

// Admin Login
export const loginAdmin = async (credentials) => {
  const response = await axios.post(`${API_URL}/admin/login`, credentials, {
    withCredentials: true,
  });

  return response.data;
};

// Logout
export const logoutAuth = async (role = "student") => {
  const endpoint = role === "admin" ? `${API_URL}/admin/logout` : `${API_URL}/users/logout`;
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