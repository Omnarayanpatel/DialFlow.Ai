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

export const getManagedAdmins = async (token) => {
  const response = await apiRequest("/super-admin/admins", {
    method: "GET",
    token,
  });

  return response.data;
};

export const createManagedAdmin = async (payload, token) => {
  const response = await apiRequest("/super-admin/admins", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const updateManagedAdmin = async (id, payload, token) => {
  const response = await apiRequest(`/super-admin/admins/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });

  return response.data;
};

export const deleteManagedAdmin = async (id, token) => {
  const response = await apiRequest(`/super-admin/admins/${id}`, {
    method: "DELETE",
    token,
  });

  return response.data;
};

export const forceLogoutManagedAdmin = async (id, token) => {
  const response = await apiRequest(`/super-admin/admins/${id}/logout`, {
    method: "POST",
    token,
  });

  return response.data;
};

export const getAuditLogs = async (token, params = {}) => {
  const response = await apiRequest(`/super-admin/audit-logs${toQueryString(params)}`, {
    method: "GET",
    token,
  });

  return response.data;
};

export const createAuditLog = async (payload, token) => {
  const response = await apiRequest("/super-admin/audit-logs", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return response.data;
};
