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

export const getAdminLeaderboard = async (token, params = {}) => {
  const response = await apiRequest(`/rankings/admin${toQueryString(params)}`, {
    method: "GET",
    token,
  });

  return response.data;
};

export const getAgentRanking = async (token, params = {}) => {
  const response = await apiRequest(`/rankings/agent${toQueryString(params)}`, {
    method: "GET",
    token,
  });

  return response.data;
};
