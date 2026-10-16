import axios from "axios";
import { API_BASE_URL, API_CONFIGURATION_ERROR } from "./apiConfig";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach bearer token if present
api.interceptors.request.use(
  (config) => {
    if (API_CONFIGURATION_ERROR) {
      return Promise.reject(new Error(API_CONFIGURATION_ERROR));
    }

    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle standard responses and errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event("campusflow:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export default api;
