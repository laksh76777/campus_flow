import api from "./api";

// 1. Get all placement sessions
export const getAllPlacementSessions = async (params = {}) => {
  const response = await api.get("/sessions", { params });
  return response.data;
};

// 2. Get currently active placement session
export const getActivePlacementSession = async () => {
  const response = await api.get("/sessions/active");
  return response.data;
};

// 3. Get single session with analytics by ID
export const getPlacementSessionById = async (sessionId) => {
  const response = await api.get(`/sessions/${sessionId}`);
  return response.data;
};

// 4. Create new placement session (Admin)
export const createPlacementSession = async (sessionData) => {
  const response = await api.post("/sessions", sessionData);
  return response.data;
};

// 5. Update placement session (Admin)
export const updatePlacementSession = async (sessionId, sessionData) => {
  const response = await api.patch(`/sessions/${sessionId}`, sessionData);
  return response.data;
};

// 6. Set placement session as active (Admin)
export const activatePlacementSession = async (sessionId) => {
  const response = await api.patch(`/sessions/${sessionId}/activate`);
  return response.data;
};

// 7. Close placement session (Admin)
export const closePlacementSession = async (sessionId) => {
  const response = await api.patch(`/sessions/${sessionId}/close`);
  return response.data;
};

// 8. Archive placement session (Admin)
export const archivePlacementSession = async (sessionId) => {
  const response = await api.patch(`/sessions/${sessionId}/archive`);
  return response.data;
};

// 9. Seed default placement sessions (2025-2029)
export const seedDefaultSessions = async () => {
  const response = await api.post("/sessions/seed-defaults");
  return response.data;
};

// 10. Preview migration / backfill mappings
export const previewSessionBackfill = async () => {
  const response = await api.get("/sessions/backfill/preview");
  return response.data;
};

// 11. Execute migration / backfill
export const executeSessionBackfill = async (confirmedMappings) => {
  const response = await api.post("/sessions/backfill/execute", { confirmedMappings });
  return response.data;
};

// 12. Transfer students to another session
export const transferStudentsSession = async ({ studentIds, targetSessionId, updateGraduationYear = true }) => {
  const response = await api.post("/sessions/transfer-students", {
    studentIds,
    targetSessionId,
    updateGraduationYear
  });
  return response.data;
};
