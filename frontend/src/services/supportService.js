import api from "./api";

export const getMySupportConversations = async () => (await api.get("/support/my-conversations")).data;
export const getSupportConversation = async (id) => (await api.get(`/support/conversations/${id}`)).data;
export const createSupportConversation = async (message, subject) => (await api.post("/support/conversations", { message, subject })).data;
export const sendSupportMessage = async (id, message) => (await api.post(`/support/conversations/${id}/messages`, { message })).data;
export const requestAdminReply = async (id) => (await api.post(`/support/conversations/${id}/request-admin`)).data;
export const getAdminSupportInbox = async (status = "open") => (await api.get("/support/admin/inbox", { params: { status } })).data;
export const sendAdminSupportReply = async (id, message) => (await api.post(`/support/admin/${id}/reply`, { message })).data;
export const updateSupportStatus = async (id, status) => (await api.patch(`/support/admin/${id}/status`, { status })).data;
export const sendAdminCopilotPrompt = async (prompt, messages = []) => (await api.post("/support/admin/copilot", { prompt, messages })).data;
