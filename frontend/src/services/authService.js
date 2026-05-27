import { apiRequest } from "./api";

const agentSessionStorageKeys = [
  "agentLoginTime",
  "agentWorkDuration",
  "agentDashboardSession",
  "agentSessionStats",
  "agentBreakState",
  "agentTimerState",
  "agentDashboardState",
  "agentActiveSession",
  "agentSessionLoginTime",
  "login_time",
  "loginTime",
  "sessionLoginTime",
];

const isAgentSessionCacheKey = (key) => {
  const normalized = key.toLowerCase();
  const sessionTerms = ["session", "login", "dashboard", "timer", "duration", "break", "work"];

  return (
    agentSessionStorageKeys.some((cacheKey) => cacheKey.toLowerCase() === normalized) ||
    normalized.includes("login_time") ||
    normalized.includes("sessionlogintime") ||
    (normalized.includes("agent") && sessionTerms.some((term) => normalized.includes(term)))
  );
};

const clearStorageByKey = (storage) => {
  if (!storage) {
    return;
  }

  Object.keys(storage).forEach((key) => {
    if (isAgentSessionCacheKey(key)) {
      storage.removeItem(key);
    }
  });
};

export const clearAgentSessionCache = ({ clearAuth = false } = {}) => {
  clearStorageByKey(sessionStorage);
  clearStorageByKey(localStorage);

  if (clearAuth) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
  }
};

export const loginUser = async (payload) => {
  const response = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const registerUser = async (payload) => {
  const response = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const updateUserStatus = async (status, token, breakDetails = {}) => {
  return apiRequest("/auth/status", {
    method: "PUT",
    token,
    body: JSON.stringify({ status, ...breakDetails }),
  });
};

export const getAgents = async (token) => {
  const response = await apiRequest("/auth/agents", {
    method: "GET",
    token,
  });

  return response.data;
};

export const getAgentMonitoring = async (token) => {
  const response = await apiRequest("/auth/agents/monitoring", {
    method: "GET",
    token,
  });

  return response.data;
};

export const updateAgent = async (id, payload, token) => {
  const response = await apiRequest(`/agents/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const deleteAgent = async (id, token) => {
  const response = await apiRequest(`/agents/${id}`, {
    method: "DELETE",
    token,
  });

  return response.data;
};

export const forceLogoutAgent = async (id, token) => {
  const response = await apiRequest(`/admin/force-logout/${id}`, {
    method: "POST",
    token,
  });

  return response.data;
};

export const forceLogoutAllAgents = async (token) => {
  const response = await apiRequest("/admin/force-logout-all", {
    method: "POST",
    token,
  });

  return response.data;
};

export const persistSession = ({ token, user }) => {
  clearAgentSessionCache();
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};
