import { apiRequest } from "./api";

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

export const updateUserStatus = async (status, token) => {
  return apiRequest("/auth/status", {
    method: "PUT",
    token,
    body: JSON.stringify({ status }),
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

export const persistSession = ({ token, user }) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};
