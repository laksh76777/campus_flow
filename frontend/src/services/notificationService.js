import api from "./api";

// Fetch student's real notifications and unread count
export const getMyNotifications = async () => {
  const response = await api.get("/notifications");
  return response.data;
};

// Mark a single notification as read
export const markNotificationAsRead = async (notificationId) => {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  return response.data;
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async () => {
  const response = await api.patch("/notifications/mark-all-read");
  return response.data;
};

// Preview announcement audience count and recipients
export const getAnnouncementPreview = async (params) => {
  const response = await api.get("/notifications/announcement-preview", { params });
  return response.data;
};

// Broadcast announcement to student cohorts (Admin)
export const broadcastAnnouncement = async (announcementData) => {
  const response = await api.post("/notifications/broadcast", announcementData);
  return response.data;
};

// Get scheduled reminder jobs (Admin)
export const getScheduledReminders = async () => {
  const response = await api.get("/notifications/scheduled-reminders");
  return response.data;
};

// Manually trigger reminder worker execution (Admin)
export const triggerReminderWorker = async () => {
  const response = await api.post("/notifications/trigger-reminders");
  return response.data;
};
