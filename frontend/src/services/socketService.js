import { io } from "socket.io-client";

import { API_BASE_URL } from "./api";

const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api$/, "");

export const createDowntimeSocket = (token) =>
  io(SOCKET_BASE_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    withCredentials: true,
  });
