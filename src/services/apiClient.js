import axios from "axios";

const apiClient = axios.create({
  baseURL: "/",
  headers: {
    "Content-Type": "application/json"
  }
});

// Attach JWT token automatically if present
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("safeone_jwt_token") || sessionStorage.getItem("safeone_jwt_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    // For multipart uploads the browser must set Content-Type itself so the
    // multipart boundary is included. A manual "multipart/form-data" (or the
    // default application/json) drops the boundary and makes multer reject the
    // request with 400 "Boundary not found". Strip it so axios/browser handle it.
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      if (config.headers && typeof config.headers.delete === "function") {
        config.headers.delete("Content-Type");
      } else if (config.headers) {
        delete config.headers["Content-Type"];
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Clean interceptor for 401 Unauthorized errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("safeone_jwt_token");
      sessionStorage.removeItem("safeone_jwt_token");
      
      // Check if this was the initial session recovery request
      const isAuthCheck = error.config.url && error.config.url.includes("/api/auth/me");
      
      if (isAuthCheck) {
        // Dispatch silent event so App.jsx sets state cleanly (no hard reloads)
        window.dispatchEvent(new CustomEvent("safeone-auth-failed"));
      } else {
        // Mid-session expiration: clean redirect to root login view
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
