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

// Broadcast announcement to student cohorts (Admin)
export const broadcastAnnouncement = async (announcementData) => {
  const response = await api.post("/notifications/broadcast", announcementData);
  return response.data;
};

