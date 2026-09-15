import axios from "axios";

const API_URL = (
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  ""
).replace(/\/$/, "");

export const api = axios.create({
  baseURL: API_URL,
  timeout: Number(process.env.REACT_APP_REQUEST_TIMEOUT_MS || 15000),
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth-expired"));
    }

    if (status === 403) {
      window.dispatchEvent(
        new CustomEvent("api-forbidden", {
          detail: error.response?.data,
        })
      );
    }

    if (status === 429) {
      window.dispatchEvent(
        new CustomEvent("api-rate-limited", {
          detail: error.response?.data,
        })
      );
    }

    return Promise.reject(error);
  }
);

export default api;