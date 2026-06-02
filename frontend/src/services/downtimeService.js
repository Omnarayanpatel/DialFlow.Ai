import { apiRequest } from "./api";

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

export const createDowntimeRequest = async (payload, token) => {
  const response = await apiRequest("/downtime", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const getDowntimeRequests = async (token, params = {}) => {
  const response = await apiRequest(`/downtime${toQueryString(params)}`, {
    method: "GET",
    token,
  });

  return response.data;
};

export const getMyCurrentDowntimeRequest = async (token) => {
  const response = await apiRequest("/downtime/me/current", {
    method: "GET",
    token,
  });

  return response.data;
};

export const approveDowntimeRequest = async (id, token) => {
  const response = await apiRequest(`/downtime/${id}/approve`, {
    method: "POST",
    token,
  });

  return response.data;
};

export const rejectDowntimeRequest = async (id, token) => {
  const response = await apiRequest(`/downtime/${id}/reject`, {
    method: "POST",
    token,
  });

  return response.data;
};

export const resolveDowntimeRequest = async (id, token) => {
  const response = await apiRequest(`/downtime/${id}/resolve`, {
    method: "POST",
    token,
  });

  return response.data;
};

export const getDowntimeReport = async (token, params = {}) => {
  const response = await apiRequest(`/downtime/report${toQueryString(params)}`, {
    method: "GET",
    token,
  });

  return response.data;
};
