const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { query } = require("../config/db");

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
      const sessionResult = await query(
        `INSERT INTO agent_sessions (user_id, login_time, status)
         VALUES ($1, CURRENT_TIMESTAMP, 'online')
         RETURNING id`,
        [user.id]
      );

      sessionId = sessionResult.rows[0]?.id || null;
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
             break_count,
             status
           )
           VALUES (
             $1,
             CURRENT_TIMESTAMP,
             CASE WHEN $2 = 'break' THEN CURRENT_TIMESTAMP ELSE NULL END,
             CASE WHEN $2 = 'break' THEN 1 ELSE 0 END,
             $2
           )
           RETURNING id`,
          [req.user.id, normalizedStatus]
        );

        sessionId = createdSession.rows[0]?.id || null;
      }
    }

    if (req.user.role === "agent" && sessionId) {
      if (normalizedStatus === "break") {
        await query(
          `UPDATE agent_sessions
           SET
             status = 'break',
             break_start_time = COALESCE(break_start_time, CURRENT_TIMESTAMP),
             break_count = CASE WHEN break_start_time IS NULL THEN break_count + 1 ELSE break_count END,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2 AND logout_time IS NULL`,
          [sessionId, req.user.id]
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
             break_start_time = NULL,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2 AND logout_time IS NULL`,
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
             break_start_time = NULL,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2 AND logout_time IS NULL`,
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
               EXTRACT(EPOCH FROM (COALESCE(logout_time, CURRENT_TIMESTAMP) - login_time))::int
                 - total_break_duration
                 - CASE
                     WHEN logout_time IS NULL AND break_start_time IS NOT NULL
                       THEN GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0)
                     ELSE 0
                   END,
               0
             )
           ) FILTER (WHERE logout_time IS NULL), 0)::int AS active_session_duration,
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
           COUNT(*) FILTER (WHERE logout_time IS NULL)::int AS active_session_count
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
         COALESCE(sm.active_session_duration, 0) AS active_session_duration,
         COALESCE(sm.break_count, 0) AS break_count,
         COALESCE(sm.total_break_duration, 0) AS total_break_duration,
         COALESCE(sm.current_break_duration, 0) AS current_break_duration,
         COALESCE(sm.active_session_count, 0) AS active_session_count,
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

module.exports = {
  login,
  register,
  getProfile,
  updateStatus,
  getAllAgents,
  getAgentMonitoring,
};
