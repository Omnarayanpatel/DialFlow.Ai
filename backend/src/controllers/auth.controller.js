const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { query, withTransaction } = require("../config/db");

const buildToken = (user, sessionId = null) =>
  jwt.sign(
    {
      id: user.id,
      employeeId: user.employee_id,
      zohoId: user.zoho_id,
      name: user.name,
      role: user.role,
      sessionId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  employeeId: user.employee_id,
  zohoId: user.zoho_id,
  role: user.role,
  status: normalizeStatus(user.status),
  createdAt: user.created_at,
});

const normalizeStatus = (status) => {
  const value = String(status || "offline").trim().toLowerCase();

  if (value === "online") {
    return "online";
  }

  if (value === "break" || value === "on break") {
    return "break";
  }

  return "offline";
};

const normalizeBreakDetails = ({ reason, remark } = {}) => {
  const allowedReasons = new Set(["Lunch Break", "Tea Break", "Bio Break", "Session"]);
  const cleanReason = String(reason || "").trim();
  const cleanRemark = String(remark || "").trim();

  return {
    reason: allowedReasons.has(cleanReason) ? cleanReason : "",
    remark: cleanRemark.slice(0, 500),
  };
};

const refreshUserStatusFromSessions = async (userId) => {
  const result = await query(
    `WITH active_sessions AS (
       SELECT status
       FROM agent_sessions
       WHERE user_id = $1 AND logout_time IS NULL
     )
     UPDATE users
     SET status = CASE
       WHEN EXISTS (SELECT 1 FROM active_sessions WHERE LOWER(status) = 'online') THEN 'online'
       WHEN EXISTS (SELECT 1 FROM active_sessions WHERE LOWER(status) IN ('break', 'on break')) THEN 'break'
       ELSE 'offline'
     END
     WHERE id = $1
     RETURNING status`,
    [userId]
  );

  return normalizeStatus(result.rows[0]?.status);
};

const login = async (req, res, next) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and password are required",
      });
    }

    const result = await query(
      "SELECT id, name, password, employee_id, zoho_id, role, created_at FROM users WHERE employee_id = $1 LIMIT 1",
      [employeeId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid Employee ID or password",
      });
    }

    const passwordMatched = await bcrypt.compare(password, user.password);

    if (!passwordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid Employee ID or password",
      });
    }

    let sessionId = null;

    if (user.role === "agent") {
      sessionId = await withTransaction(async (client) => {
        await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);

        const activeSession = await client.query(
          `SELECT id
           FROM agent_sessions
           WHERE user_id = $1
             AND logout_time IS NULL
             AND LOWER(status) IN ('active', 'online', 'break', 'on break')
           LIMIT 1`,
          [user.id]
        );

        if (activeSession.rows[0]) {
          const conflict = new Error("Agent already logged in on another device.");
          conflict.statusCode = 409;
          throw conflict;
        }

        const sessionResult = await client.query(
          `INSERT INTO agent_sessions (user_id, login_time, status)
           VALUES ($1, CURRENT_TIMESTAMP, 'online')
           RETURNING id`,
          [user.id]
        );

        return sessionResult.rows[0]?.id || null;
      });
    }

    await query("UPDATE users SET status = 'online' WHERE id = $1", [user.id]);

    user.status = "online";

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: sanitizeUser(user),
        token: buildToken(user, sessionId),
      },
    });
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const { name, employeeId, password, role, adminCode } = req.body;

    if (!name || !employeeId || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, Employee ID, and password are required", 
      });
    }

    if (role === "admin") {
      const adminSecret = process.env.ADMIN_SECRET || "D_AI_AVY_2026";

      if (adminCode !== adminSecret) {
        return res.status(403).json({
          success: false,
          message: "Invalid Admin passcode.",
        });
      }
    }

    const existingUser = await query(
      "SELECT id FROM users WHERE employee_id = $1 LIMIT 1",
      [employeeId]
    );

    if (existingUser.rows[0]) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this employee ID",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const finalRole = role === "admin" ? "admin" : "agent";

    const createdUser = await query(
      `INSERT INTO users (name, password, employee_id, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, employee_id, zoho_id, role, created_at`,
      [
        name,
        hashedPassword,
        employeeId,
        finalRole,
      ]
    );

    const user = createdUser.rows[0];

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: sanitizeUser(user),
        token: buildToken(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, name, employee_id, zoho_id, role, status, created_at FROM users WHERE id = $1 LIMIT 1",
      [req.user.id]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const normalizedStatus = normalizeStatus(status);
    const breakDetails = normalizeBreakDetails({
      reason: req.body.breakReason || req.body.break_reason,
      remark: req.body.breakRemark || req.body.break_remark,
    });

    if (req.user.role === "agent" && normalizedStatus === "break" && !breakDetails.reason) {
      return res.status(400).json({ success: false, message: "Break reason is required" });
    }

    let sessionId = req.user.sessionId || null;

    if (req.user.role === "agent" && !sessionId) {
      const activeSession = await query(
        `SELECT id
         FROM agent_sessions
         WHERE user_id = $1 AND logout_time IS NULL
         ORDER BY login_time DESC
         LIMIT 1`,
        [req.user.id]
      );

      sessionId = activeSession.rows[0]?.id || null;

      if (!sessionId && normalizedStatus !== "offline") {
        const createdSession = await query(
          `INSERT INTO agent_sessions (
             user_id,
             login_time,
             break_start_time,
             break_end_time,
             break_reason,
             break_remark,
             break_count,
             status
           )
           VALUES (
             $1,
             CURRENT_TIMESTAMP,
             CASE WHEN $2 = 'break' THEN CURRENT_TIMESTAMP ELSE NULL END,
             NULL,
             CASE WHEN $2 = 'break' THEN $3 ELSE NULL END,
             CASE WHEN $2 = 'break' THEN $4 ELSE NULL END,
             CASE WHEN $2 = 'break' THEN 1 ELSE 0 END,
             $2
           )
           RETURNING id`,
          [req.user.id, normalizedStatus, breakDetails.reason || null, breakDetails.remark || null]
        );

        sessionId = createdSession.rows[0]?.id || null;

        if (sessionId && normalizedStatus === "break") {
          await query(
            `INSERT INTO agent_breaks (
               session_id,
               user_id,
               break_start_time,
               break_reason,
               break_remark
             )
             VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)`,
            [sessionId, req.user.id, breakDetails.reason || null, breakDetails.remark || null]
          );
        }
      }
    }

    if (req.user.role === "agent" && sessionId) {
      if (normalizedStatus === "break") {
        await query(
          `UPDATE agent_sessions
           SET
             status = 'break',
             break_start_time = COALESCE(break_start_time, CURRENT_TIMESTAMP),
             break_end_time = NULL,
             break_reason = CASE WHEN break_start_time IS NULL THEN $3 ELSE COALESCE(break_reason, $3) END,
             break_remark = CASE WHEN break_start_time IS NULL THEN $4 ELSE COALESCE(break_remark, $4) END,
             break_count = CASE WHEN break_start_time IS NULL THEN break_count + 1 ELSE break_count END,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2 AND logout_time IS NULL`,
          [sessionId, req.user.id, breakDetails.reason || null, breakDetails.remark || null]
        );

        await query(
          `INSERT INTO agent_breaks (
             session_id,
             user_id,
             break_start_time,
             break_reason,
             break_remark
           )
           SELECT $1, $2, CURRENT_TIMESTAMP, $3, $4
           WHERE NOT EXISTS (
             SELECT 1
             FROM agent_breaks
             WHERE session_id = $1 AND break_end_time IS NULL
           )`,
          [sessionId, req.user.id, breakDetails.reason || null, breakDetails.remark || null]
        );
      } else if (normalizedStatus === "online") {
        await query(
          `UPDATE agent_sessions
           SET
             status = 'online',
             total_break_duration = total_break_duration + CASE
               WHEN break_start_time IS NULL THEN 0
               ELSE GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0)
             END,
             break_end_time = CASE WHEN break_start_time IS NULL THEN break_end_time ELSE CURRENT_TIMESTAMP END,
             break_start_time = NULL,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2 AND logout_time IS NULL`,
          [sessionId, req.user.id]
        );

        await query(
          `UPDATE agent_breaks
           SET
             break_end_time = CURRENT_TIMESTAMP,
             total_break_duration = GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = (
             SELECT id
             FROM agent_breaks
             WHERE session_id = $1 AND user_id = $2 AND break_end_time IS NULL
             ORDER BY break_start_time DESC
             LIMIT 1
           )`,
          [sessionId, req.user.id]
        );
      } else {
        await query(
          `UPDATE agent_sessions
           SET
             status = 'offline',
             logout_time = CURRENT_TIMESTAMP,
             total_break_duration = total_break_duration + CASE
               WHEN break_start_time IS NULL THEN 0
               ELSE GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0)
             END,
             break_end_time = CASE WHEN break_start_time IS NULL THEN break_end_time ELSE CURRENT_TIMESTAMP END,
             break_start_time = NULL,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2 AND logout_time IS NULL`,
          [sessionId, req.user.id]
        );

        await query(
          `UPDATE agent_breaks
           SET
             break_end_time = CURRENT_TIMESTAMP,
             total_break_duration = GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = (
             SELECT id
             FROM agent_breaks
             WHERE session_id = $1 AND user_id = $2 AND break_end_time IS NULL
             ORDER BY break_start_time DESC
             LIMIT 1
           )`,
          [sessionId, req.user.id]
        );
      }

      await refreshUserStatusFromSessions(req.user.id);
    } else {
      await query(
        "UPDATE users SET status = $1 WHERE id = $2",
        [normalizedStatus, req.user.id]
      );
    }

    res.status(200).json({
      success: true,
      message: `Status updated to ${normalizedStatus}`,
      data: {
        status: normalizedStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAllAgents = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const result = await query(
      `WITH session_metrics AS (
         SELECT
           user_id,
           MIN(login_time) FILTER (WHERE logout_time IS NULL) AS login_time,
           COALESCE(SUM(
             GREATEST(
               EXTRACT(EPOCH FROM (COALESCE(logout_time, CURRENT_TIMESTAMP) - login_time))::int,
               0
             )
           ) FILTER (WHERE logout_time IS NULL), 0)::int AS staff_time_duration,
           COALESCE(SUM(
             GREATEST(
               EXTRACT(EPOCH FROM (COALESCE(logout_time, CURRENT_TIMESTAMP) - login_time))::int
                 - total_break_duration
                 - CASE
                     WHEN logout_time IS NULL AND break_start_time IS NOT NULL
                       THEN GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0)
                     ELSE 0
                 END,
               0
             )
           ) FILTER (WHERE logout_time IS NULL), 0)::int AS total_login_duration,
           COALESCE(SUM(break_count) FILTER (WHERE logout_time IS NULL), 0)::int AS break_count,
           COALESCE(SUM(
             total_break_duration + CASE
               WHEN logout_time IS NULL AND break_start_time IS NOT NULL
                 THEN GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0)
               ELSE 0
             END
           ) FILTER (WHERE logout_time IS NULL), 0)::int AS total_break_duration,
           COALESCE(SUM(
             CASE
               WHEN logout_time IS NULL AND break_start_time IS NOT NULL
                 THEN GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0)
               ELSE 0
             END
           ), 0)::int AS current_break_duration,
           BOOL_OR(logout_time IS NULL AND LOWER(status) = 'online') AS has_online_session,
           BOOL_OR(logout_time IS NULL AND LOWER(status) IN ('break', 'on break')) AS has_break_session,
           COUNT(*) FILTER (WHERE logout_time IS NULL)::int AS active_session_count,
           (ARRAY_AGG(break_reason ORDER BY break_start_time DESC NULLS LAST)
             FILTER (WHERE logout_time IS NULL AND LOWER(status) IN ('break', 'on break')))[1] AS break_reason,
           (ARRAY_AGG(break_remark ORDER BY break_start_time DESC NULLS LAST)
             FILTER (WHERE logout_time IS NULL AND LOWER(status) IN ('break', 'on break')))[1] AS break_remark,
           MAX(break_start_time) FILTER (WHERE logout_time IS NULL AND LOWER(status) IN ('break', 'on break')) AS break_start_time,
           MAX(break_end_time) FILTER (WHERE logout_time IS NULL) AS break_end_time
         FROM agent_sessions
         GROUP BY user_id
       ),
       today_agent_stats AS (
         SELECT
           employee_id,
           COUNT(*)::int AS today_calls,
           COUNT(*) FILTER (WHERE call_status = 'Connected')::int AS today_connected,
           COUNT(*) FILTER (WHERE disposition = 'Positive')::int AS today_positive
         FROM responses
         WHERE created_at::date = CURRENT_DATE
         GROUP BY employee_id
       )
       SELECT
         u.id,
         u.name,
         u.employee_id,
         u.zoho_id,
         u.role,
         CASE
           WHEN COALESCE(sm.has_online_session, false) THEN 'online'
           WHEN COALESCE(sm.has_break_session, false) THEN 'break'
           ELSE 'offline'
         END AS status,
         sm.login_time,
         COALESCE(sm.total_login_duration, 0) AS total_login_duration,
         COALESCE(sm.staff_time_duration, 0) AS active_session_duration,
         COALESCE(sm.staff_time_duration, 0) AS staff_time_duration,
         COALESCE(sm.break_count, 0) AS break_count,
         COALESCE(sm.total_break_duration, 0) AS total_break_duration,
         COALESCE(sm.current_break_duration, 0) AS current_break_duration,
         COALESCE(sm.active_session_count, 0) AS active_session_count,
         sm.break_reason,
         sm.break_remark,
         sm.break_start_time,
         sm.break_end_time,
         COALESCE(tas.today_calls, 0) AS today_calls,
         COALESCE(tas.today_connected, 0) AS today_connected,
         COALESCE(tas.today_positive, 0) AS today_positive,
         u.created_at
       FROM users u
       LEFT JOIN session_metrics sm ON sm.user_id = u.id
       LEFT JOIN today_agent_stats tas ON tas.employee_id = u.employee_id
       WHERE u.role = 'agent'
       ORDER BY u.name ASC`
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

const getAgentMonitoring = getAllAgents;

const updateAgent = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const agentId = Number.parseInt(req.params.id, 10);
    const { name, employeeId, password, role } = req.body;

    if (!Number.isFinite(agentId)) {
      return res.status(400).json({ success: false, message: "Valid agent id is required" });
    }

    if (!name?.trim() || !employeeId?.trim()) {
      return res.status(400).json({ success: false, message: "Agent name and employee ID are required" });
    }

    const normalizedRole = role === "admin" ? "admin" : "agent";
    const passwordValue = String(password || "").trim();

    const updatedAgent = await withTransaction(async (client) => {
      const currentResult = await client.query(
        "SELECT id, employee_id FROM users WHERE id = $1 LIMIT 1",
        [agentId]
      );
      const currentAgent = currentResult.rows[0];

      if (!currentAgent) {
        const error = new Error("Agent not found");
        error.statusCode = 404;
        throw error;
      }

      const duplicateResult = await client.query(
        "SELECT id FROM users WHERE employee_id = $1 AND id <> $2 LIMIT 1",
        [employeeId.trim(), agentId]
      );

      if (duplicateResult.rows[0]) {
        const error = new Error("Employee ID already exists");
        error.statusCode = 409;
        throw error;
      }

      let hashedPassword = null;

      if (passwordValue) {
        hashedPassword = await bcrypt.hash(passwordValue, 10);
      }

      const result = await client.query(
        `UPDATE users
         SET
           name = $1,
           employee_id = $2,
           role = $3,
           password = COALESCE($4, password),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING id, name, employee_id, zoho_id, role, status, created_at`,
        [name.trim(), employeeId.trim(), normalizedRole, hashedPassword, agentId]
      );

      await client.query(
        `UPDATE responses
         SET employee_id = $1, employee_name = $2
         WHERE employee_id = $3`,
        [employeeId.trim(), name.trim(), currentAgent.employee_id]
      );

      return result.rows[0];
    });

    res.status(200).json({
      success: true,
      message: "Agent updated successfully",
      data: updatedAgent,
    });
  } catch (error) {
    next(error);
  }
};

const deleteAgent = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const agentId = Number.parseInt(req.params.id, 10);

    if (!Number.isFinite(agentId)) {
      return res.status(400).json({ success: false, message: "Valid agent id is required" });
    }

    if (agentId === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account" });
    }

    const deletedAgent = await withTransaction(async (client) => {
      const result = await client.query(
        `DELETE FROM users
         WHERE id = $1 AND role = 'agent'
         RETURNING id, name, employee_id`,
        [agentId]
      );

      if (!result.rows[0]) {
        const error = new Error("Agent not found");
        error.statusCode = 404;
        throw error;
      }

      return result.rows[0];
    });

    res.status(200).json({
      success: true,
      message: "Agent deleted successfully",
      data: deletedAgent,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  register,
  getProfile,
  updateStatus,
  getAllAgents,
  getAgentMonitoring,
  updateAgent,
  deleteAgent,
};
