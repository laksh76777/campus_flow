import api from "./api";

// 1. Dashboard Statistics
export const getAdminDashboardStats = async () => {
  const response = await api.get("/dashboard/stats");
  return response.data;
};

// 2. Company Management
export const getAllCompanies = async (params = {}) => {
  const response = await api.get("/company/all-companies", { params });
  return response.data;
};

export const createCompany = async (companyData) => {
  const isFormData = companyData instanceof FormData;
  const response = await api.post("/company/create-company", companyData, {
    headers: isFormData ? { "Content-Type": "multipart/form-data" } : {},
  });
  return response.data;
};

export const updateCompany = async (companyId, updateData) => {
  const response = await api.patch(`/company/${companyId}`, updateData);
  return response.data;
};

export const deactivateCompany = async (companyId) => {
  const response = await api.patch(`/company/${companyId}/deactivate`);
  return response.data;
};

export const reactivateCompany = async (companyId) => {
  const response = await api.patch(`/company/${companyId}/reactivate`);
  return response.data;
};

// 3. Placement Drive Management
export const getAllPlacementDrives = async (params = {}) => {
  const response = await api.get("/placementdrive/all-drives", { params });
  return response.data;
};

export const createPlacementDrive = async (driveData) => {
  const response = await api.post("/placementdrive/create-placement-drive", driveData);
  return response.data;
};

export const updatePlacementDrive = async (driveId, driveData) => {
  const response = await api.patch(`/placementdrive/${driveId}`, driveData);
  return response.data;
};

export const deactivatePlacementDrive = async (driveId) => {
  const response = await api.patch(`/placementdrive/${driveId}/deactivate`);
  return response.data;
};

export const reactivatePlacementDrive = async (driveId) => {
  const response = await api.patch(`/placementdrive/${driveId}/reactivate`);
  return response.data;
};

export const getEligibleStudentsForDrive = async (driveId) => {
  const response = await api.get(`/placementdrive/${driveId}/eligible-students`);
  return response.data;
};

// 4. Application Management
export const getApplicationsByDrive = async (placementDriveId, params = {}) => {
  const response = await api.get(`/application/drive/${placementDriveId}`, { params });
  return response.data;
};

export const updateApplicationStatus = async (
  applicationId,
  status,
  remarks = "",
  extraDetails = {}
) => {
  const response = await api.patch(`/application/${applicationId}/status`, {
    status,
    remarks,
    ...extraDetails,
  });
  return response.data;
};

export const getApplicationById = async (applicationId) => {
  const response = await api.get(`/application/${applicationId}`);
  return response.data;
};

export const getAllApplications = async (params = {}) => {
  const response = await api.get("/application/all-applications", { params });
  return response.data;
};

// 5. Student Cohort Management
export const getAllStudentProfiles = async (params = {}) => {
  const response = await api.get("/studentprofile/all-students", { params });
  return response.data;
};

export const getStudentProfileById = async (studentId) => {
  const response = await api.get(`/studentprofile/${studentId}`);
  return response.data;
};

// 6. Drive Eligibility Preview & Authorized Overrides (Phase 4 & 5)
export const getDriveEligibilityPreview = async (driveId) => {
  const response = await api.get(`/placementdrive/${driveId}/eligibility-preview`);
  return response.data;
};

export const adminOverrideApplication = async (applicationId, overrideData) => {
  const response = await api.post(`/application/${applicationId}/admin-override`, overrideData);
  return response.data;
};
