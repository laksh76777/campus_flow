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
  const isFormData = driveData instanceof FormData;
  const response = await api.post("/placementdrive/create-placement-drive", driveData, {
    headers: isFormData ? { "Content-Type": "multipart/form-data" } : {},
  });
  return response.data;
};

export const updatePlacementDrive = async (driveId, driveData) => {
  const isFormData = driveData instanceof FormData;
  const response = await api.patch(`/placementdrive/${driveId}`, driveData, {
    headers: isFormData ? { "Content-Type": "multipart/form-data" } : {},
  });
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

export const deletePlacementDrive = async (driveId) => {
  const response = await api.delete(`/placementdrive/${driveId}`);
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

export const getCompleteStudentDirectory = async (pageSize = 200) => {
  const firstPage = await getAllStudentProfiles({ page: 1, limit: pageSize });
  const firstStudents = firstPage?.data?.students || (Array.isArray(firstPage?.data) ? firstPage.data : []);
  const totalPages = Math.max(1, Number(firstPage?.data?.pagination?.pages) || 1);
  const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
  const rest = [];

  for (let index = 0; index < remainingPages.length; index += 5) {
    const batch = remainingPages.slice(index, index + 5);
    const responses = await Promise.all(batch.map((page) => getAllStudentProfiles({ page, limit: pageSize })));
    rest.push(...responses.flatMap((response) => response?.data?.students || []));
  }

  return [...firstStudents, ...rest];
};

export const getStudentProfileById = async (studentId) => {
  const response = await api.get(`/studentprofile/${studentId}`);
  return response.data;
};

export const getStudentResumeDownloadUrl = async (studentId) => {
  const response = await api.get(`/studentprofile/${studentId}/resume-download`);
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

// 7. Automated Placement Drive Lifecycle Management (Phase 2)
export const getAutomatedDriveWorkspace = async (driveId) => {
  const response = await api.get(`/placementdrive/${driveId}/automated-workspace`);
  return response.data;
};

export const configureSelectionRounds = async (driveId, rounds) => {
  const response = await api.put(`/placementdrive/${driveId}/automated-rounds`, { rounds });
  return response.data;
};

export const exportCompanyRoster = async (driveId, roundNumber = 1, format = "xlsx") => {
  const response = await api.get(`/placementdrive/${driveId}/export-company-roster`, {
    params: { roundNumber, format },
    responseType: "blob",
  });
  return response.data;
};

export const previewCompanyResults = async (driveId, formData) => {
  const response = await api.post(`/placementdrive/${driveId}/preview-results`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const commitCompanyResults = async (driveId, commitData) => {
  const response = await api.post(`/placementdrive/${driveId}/commit-results`, commitData);
  return response.data;
};

export const enrollEligibleStudents = async (driveId) => {
  const response = await api.post(`/placementdrive/${driveId}/enroll-eligible-students`);
  return response.data;
};

// Student Profile Locking & Modification Requests
export const getModificationRequests = async () => {
  const response = await api.get("/studentprofile/modification-requests");
  return response.data;
};

export const reviewModificationRequest = async (requestId, { action, reviewRemarks }) => {
  const response = await api.post(`/studentprofile/modification-requests/${requestId}/review`, {
    action,
    reviewRemarks,
  });
  return response.data;
};

export const unlockStudentProfile = async (studentId) => {
  const response = await api.post(`/studentprofile/${studentId}/unlock-profile`);
  return response.data;
};
