import api from "./api";

// Fetch student dashboard statistics & upcoming drives & recent applications
export const getStudentDashboardStats = async () => {
  const response = await api.get("/dashboard/student/stats");
  return response.data;
};

// Fetch current logged in student's academic profile
export const getCurrentStudentProfile = async () => {
  const response = await api.get("/studentprofile/current-student-profile");
  return response.data;
};

// Fetch placement drives where the student meets eligibility criteria
export const getMyEligibleDrives = async () => {
  const response = await api.get("/placementdrive/my-eligible-drives");
  return response.data;
};

// Fetch all active placement drives
export const getAllPlacementDrives = async () => {
  const response = await api.get("/placementdrive/all-drives");
  return response.data;
};

// Fetch all applications submitted by the current student
export const getMyApplications = async () => {
  const response = await api.get("/application/my-applications");
  return response.data;
};

// Apply for a specific placement drive
export const applyForDrive = async (driveId) => {
  const response = await api.post(`/application/${driveId}/apply`);
  return response.data;
};

// Withdraw a submitted application
export const withdrawApplication = async (applicationId) => {
  const response = await api.patch(`/application/${applicationId}/withdraw`);
  return response.data;
};

// Update student profile details
export const updateStudentProfile = async (profileData) => {
  const response = await api.patch("/studentprofile/update-profile", profileData);
  return response.data;
};

// Upload / update student resume
export const updateStudentResume = async (formData) => {
  const response = await api.patch("/studentprofile/update-resume", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};
