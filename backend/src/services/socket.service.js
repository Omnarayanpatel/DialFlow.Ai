const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const { query } = require("../config/db");

const DOWNTIME_ADMIN_ROOM = "downtime_admins";
const DOWNTIME_ADMIN_EMPLOYEE_IDS = new Set([
  "AM21612560",
  "AMPLTMP204",
  "AM21612448",
]);

let io = null;

const getUserRoom = (userId) => `user:${userId}`;

const canJoinDowntimeAdminRoom = (user = {}) => {
  const employeeId = String(user.employee_id || user.employeeId || "").trim();
  const role = String(user.role || "").trim();

  return ["admin", "super_admin"].includes(role) && DOWNTIME_ADMIN_EMPLOYEE_IDS.has(employeeId);
};

const verifySocketUser = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return next(new Error("Authorization token is required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userResult = await query(
      "SELECT id, role, employee_id, token_version FROM users WHERE id = $1 LIMIT 1",
      [decoded.id]
    );
    const user = userResult.rows[0];
    const tokenVersion = decoded.token_version ?? decoded.tokenVersion ?? 0;

    if (!user || Number(tokenVersion) !== Number(user.token_version || 0)) {
      return next(new Error("Invalid or expired token"));
    }

    socket.user = {
      id: user.id,
      role: user.role,
      employeeId: user.employee_id,
    };

    return next();
  } catch (_error) {
    return next(new Error("Invalid or expired token"));
  }
};

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(verifySocketUser);

  io.on("connection", (socket) => {
    if (socket.user?.id) {
      socket.join(getUserRoom(socket.user.id));
    }

    if (canJoinDowntimeAdminRoom(socket.user)) {
      socket.join(DOWNTIME_ADMIN_ROOM);
    }
  });

  return io;
};

const emitToDowntimeAdmins = (eventName, downtimeRequest) => {
  if (!io || !eventName || !downtimeRequest) {
    return;
  }

  io.to(DOWNTIME_ADMIN_ROOM).emit(eventName, {
    id: downtimeRequest.id,
    agentName: downtimeRequest.agentName,
    employeeId: downtimeRequest.employeeId,
    issueType: downtimeRequest.issueType,
    comment: downtimeRequest.comment,
    requestedAt: downtimeRequest.requestedAt,
    status: downtimeRequest.status,
    approvedAt: downtimeRequest.approvedAt,
    resolvedAt: downtimeRequest.resolvedAt,
    durationSeconds: downtimeRequest.durationSeconds,
    runningDurationSeconds: downtimeRequest.runningDurationSeconds,
  });
};

const emitToUser = (userId, eventName, payload) => {
  if (!io || !userId || !eventName || !payload) {
    return;
  }

  io.to(getUserRoom(userId)).emit(eventName, payload);
};

module.exports = {
  DOWNTIME_ADMIN_EMPLOYEE_IDS,
  DOWNTIME_ADMIN_ROOM,
  canJoinDowntimeAdminRoom,
  emitToDowntimeAdmins,
  emitToUser,
  initSocket,
};
