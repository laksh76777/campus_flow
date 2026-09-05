import api from "./api";

// 1. Dashboard Statistics
export const getAdminDashboardStats = async () => {
  const response = await api.get("/dashboard/stats");
  return response.data;
};

// 2. Company Management
export const getAllCompanies = async () => {
  const response = await api.get("/company/all-companies");
  return response.data;
};

export const createCompany = async (companyData) => {
  // If companyData is FormData (for logo file upload) or JSON
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
export const getAllPlacementDrives = async () => {
  const response = await api.get("/placementdrive/all-drives");
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
export const getApplicationsByDrive = async (placementDriveId) => {
  const response = await api.get(`/application/drive/${placementDriveId}`);
  return response.data;
};

export const updateApplicationStatus = async (applicationId, status, remarks = "") => {
  const response = await api.patch(`/application/${applicationId}/status`, {
    status,
    remarks,
  });
  return response.data;
};

export const getApplicationById = async (applicationId) => {
  const response = await api.get(`/application/${applicationId}`);
  return response.data;
};
