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

export const persistSession = ({ token, user }) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};
