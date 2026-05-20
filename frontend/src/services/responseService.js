import { apiRequest } from "./api";
import { API_BASE_URL } from "./api";

const toQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

export const getAgentDashboardData = async (token, params = {}) => {
  const [dashboard, history] = await Promise.all([
    apiRequest("/agents/dashboard", { method: "GET", token }),
    apiRequest(`/agents/history${toQueryString(params.history)}`, { method: "GET", token }),
  ]);

  return {
    summary: dashboard.data.summary,
    session: dashboard.data.session,
    recentToday: dashboard.data.recentToday || [],
    history: history.data.records || [],
    pagination: history.data.pagination,
  };
};

export const getAgentHistory = async (token, params = {}) => {
  const response = await apiRequest(`/agents/history${toQueryString(params)}`, { method: "GET", token });
  return response.data;
};

export const createAgentResponse = async (payload, token) => {
  const response = await apiRequest("/responses", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const getAllResponses = async (token, params = {}) => {
  const response = await apiRequest(`/responses${toQueryString(params)}`, { method: "GET", token });
  return response.data;
};

export const downloadResponsesExport = async (token) => {
  const response = await fetch(`${API_BASE_URL}/responses/export`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Export failed");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `call-responses-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
