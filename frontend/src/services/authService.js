import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const registerStudent = async (userData) => {
  const formData = new FormData();

  const textFields = [
    "fullName",
    "email",
    "personalEmail",
    "password",
    "confirmPassword",
    "phone",
    "usn",
    "course",
    "courseDurationYears",
    "department",
    "branch",
    "admissionYear",
    "graduationYear",
    "currentSemester",
    "semester",
    "placementSession",
    "gender",
    "dob"
  ];

  textFields.forEach((key) => {
    if (userData[key] !== undefined && userData[key] !== null) {
      formData.append(key, userData[key]);
    }
  });

  if (userData.avatar && typeof userData.avatar !== "string") {
    formData.append("avatar", userData.avatar);
  }

  const response = await axios.post(`${API_URL}/users/register`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    withCredentials: true,
  });

  return response.data;
};

// Public department list for registration
export const getPublicDepartments = async (course = "") => {
  const url = course ? `${API_URL}/departments?course=${encodeURIComponent(course)}` : `${API_URL}/departments`;
  const response = await axios.get(url);
  return response.data;
};

// Public placement sessions list for cohort mapping preview
export const getPublicSessions = async () => {
  const response = await axios.get(`${API_URL}/sessions`);
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