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

// Update student profile details (supports structured sections)
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

// Delete student resume
export const deleteStudentResume = async () => {
  const response = await api.delete("/studentprofile/delete-resume");
  return response.data;
};

// Upload / update user avatar image
export const updateUserAvatar = async (formData) => {
  const response = await api.patch("/users/update-avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

// Delete user avatar image
export const deleteUserAvatar = async () => {
  const response = await api.delete("/users/delete-avatar");
  return response.data;
};

// Check student eligibility breakdown for a drive
export const checkDriveEligibility = async (driveId) => {
  const response = await api.get(`/placementdrive/${driveId}/eligibility-check`);
  return response.data;
};

// Add individual semester result with SGPA and credits
export const addSemesterResult = async (semesterData) => {
  const response = await api.post("/studentprofile/semester-result", semesterData);
  return response.data;
};

// Add or update backlog record
export const addBacklogRecord = async (backlogData) => {
  const response = await api.post("/studentprofile/backlog-record", backlogData);
  return response.data;
};

// Admin verify student profile
export const verifyStudentProfile = async (studentId, verificationData) => {
  const response = await api.patch(`/studentprofile/${studentId}/verify`, verificationData);
  return response.data;
};

// Admin trigger safe migration of profiles
export const safeMigrateExistingProfiles = async () => {
  const response = await api.post("/studentprofile/migrate-profiles");
  return response.data;
};

// Student accept or decline formal placement offer
export const respondToOffer = async (applicationId, decision, remarks = "") => {
  const response = await api.patch(`/application/${applicationId}/respond-offer`, {
    decision,
    remarks
  });
  return response.data;
};

// Check drive student information requirements checklist
export const checkPreApplicationRequirements = async (driveId) => {
  const response = await api.get(`/application/${driveId}/precheck`);
  return response.data;
};

// Lock student profile after verification
export const lockProfile = async (targetUserId) => {
  const response = await api.post("/studentprofile/lock-profile", { userId: targetUserId });
  return response.data;
};

// Request profile detail modification from TPO
export const requestProfileModification = async (modificationData) => {
  const response = await api.post("/studentprofile/request-modification", modificationData);
  return response.data;
};
