import apiClient from "./apiClient.js";

export const dbService = {
  async getDoc(collection, id) {
    const res = await apiClient.get(`/api/db/${collection}/${id}`);
    return res.data;
  },

  async getDocs(collection) {
    const res = await apiClient.get(`/api/db/${collection}`);
    return res.data;
  },

  async createDoc(collection, data) {
    const res = await apiClient.post(`/api/db/${collection}`, data);
    return res.data;
  },

  async updateDoc(collection, id, data) {
    const res = await apiClient.patch(`/api/db/${collection}/${id}`, data);
    return res.data;
  },

  async deleteDoc(collection, id) {
    const res = await apiClient.delete(`/api/db/${collection}/${id}`);
    return res.data;
  },

  async commitBatch(operations) {
    const res = await apiClient.post("/api/db/batch", { operations });
    return res.data;
  },

  // Đánh dấu toàn bộ thông báo của user hiện tại là đã đọc (1 request)
  async markAllNotificationsRead() {
    const res = await apiClient.put("/api/notifications/read-all");
    return res.data;
  }
};

export default dbService;
