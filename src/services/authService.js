import apiClient from "./apiClient.js";

export const authService = {
  async login(email, password, rememberMe = false) {
    const res = await apiClient.post("/api/auth/login", { email, password });
    if (res.data && res.data.token) {
      if (rememberMe) {
        localStorage.setItem("safeone_jwt_token", res.data.token);
        sessionStorage.removeItem("safeone_jwt_token");
      } else {
        sessionStorage.setItem("safeone_jwt_token", res.data.token);
        localStorage.removeItem("safeone_jwt_token");
      }
    }
    return res.data;
  },

  logout() {
    localStorage.removeItem("safeone_jwt_token");
    sessionStorage.removeItem("safeone_jwt_token");
    // Trigger redirect or app level logout state clean
  },

  async getMe() {
    const res = await apiClient.get("/api/auth/me");
    return res.data;
  },

  async verifyPassword(password) {
    const res = await apiClient.post("/api/auth/verify-password", { password });
    return res.data;
  },

  async updatePassword(newPassword) {
    const res = await apiClient.post("/api/auth/update-password", { newPassword });
    return res.data;
  }
};

export default authService;
