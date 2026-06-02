const bcrypt = require("bcryptjs");

const { query, withTransaction } = require("../config/db");
const { logAuditEvent } = require("../services/audit.service");

const sanitizeAdmin = (row) => ({
  id: row.id,
  name: row.name,
  employeeId: row.employee_id,
  email: row.email || "",
  role: row.role,
  status: normalizeAdminStatus(row.status),
  createdAt: row.created_at,
  lastActiveAt: row.updated_at,
});

const normalizeAdminStatus = (status) => {
  const value = String(status || "active").trim().toLowerCase();
  return value === "inactive" ? "inactive" : "active";
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const getPayloadEmployeeId = (body) => body.employee_id || body.employeeId;

const assertUniqueEmployeeId = async (employeeId, client = null) => {
  const runner = client || { query };
  const duplicate = await runner.query(
    "SELECT id FROM users WHERE employee_id = $1 LIMIT 1",
    [employeeId]
  );

  if (duplicate.rows[0]) {
    const error = new Error("Employee ID already exists");
    error.statusCode = 409;
    throw error;
  }
};

const assertUniqueAdminEmail = async (email, adminId = null, client = null) => {
  const runner = client || { query };
  const params = [email.toLowerCase()];
  const excludeSql = adminId ? "AND id <> $2" : "";

  if (adminId) {
    params.push(adminId);
  }

  const duplicate = await runner.query(
    `SELECT id FROM users WHERE LOWER(email) = $1 ${excludeSql} LIMIT 1`,
    params
  );

  if (duplicate.rows[0]) {
    const error = new Error("Email already exists");
    error.statusCode = 409;
    throw error;
  }
};

const formatAuditAction = (action) =>
  String(action || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getAdmins = async (_req, res, next) => {
  try {
    const [adminsResult, summaryResult] = await Promise.all([
      query(
        `SELECT id, name, employee_id, email, role, status, created_at, updated_at
         FROM users
         WHERE role = 'admin'
         ORDER BY created_at DESC, name ASC`
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE role = 'admin')::int AS total_admins,
           COUNT(*) FILTER (WHERE role = 'admin' AND LOWER(status) IN ('active', 'online'))::int AS active_admins,
           COUNT(*) FILTER (WHERE role = 'agent')::int AS total_agents,
           COUNT(*) FILTER (WHERE role = 'agent' AND LOWER(status) = 'online')::int AS online_agents
         FROM users`
      ),
    ]);

    const summary = summaryResult.rows[0] || {};

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalAdmins: summary.total_admins || 0,
          activeAdmins: summary.active_admins || 0,
          totalAgents: summary.total_agents || 0,
          onlineAgents: summary.online_agents || 0,
        },
        admins: adminsResult.rows.map(sanitizeAdmin),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, role = "admin" } = req.body;
    const employeeId = getPayloadEmployeeId(req.body);
    const passwordValue = String(password || "").trim();
    const normalizedRole = String(role || "").trim();

    if (!name?.trim() || !employeeId?.trim() || !email?.trim() || !passwordValue) {
      return res.status(400).json({ success: false, message: "Full Name, Employee ID, Email, and Password are required" });
    }

    if (normalizedRole !== "admin") {
      return res.status(400).json({ success: false, message: "Role must be admin" });
    }

    const cleanEmployeeId = employeeId.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }

    await assertUniqueEmployeeId(cleanEmployeeId);
    await assertUniqueAdminEmail(cleanEmail);

    const hashedPassword = await bcrypt.hash(passwordValue, 10);
    const result = await query(
      `INSERT INTO users (name, employee_id, email, password, role, status)
       VALUES ($1, $2, $3, $4, 'admin', 'active')
       RETURNING id, name, employee_id, email, role, status, created_at, updated_at`,
      [name.trim(), cleanEmployeeId, cleanEmail, hashedPassword]
    );

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: sanitizeAdmin(result.rows[0]),
    });
  } catch (error) {
    if (error.code === "23505") {
      const constraint = String(error.constraint || "");
      error.statusCode = 409;
      if (constraint.includes("employee_id")) {
        error.message = "Employee ID already exists";
      } else if (constraint.includes("email")) {
        error.message = "Email already exists";
      } else {
        error.message = "Unique value already exists";
      }
    }
    next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const startDate = String(req.query.startDate || "").trim();
    const endDate = String(req.query.endDate || "").trim();
    const admin = String(req.query.admin || "").trim();
    const action = String(req.query.action || "").trim();
    const params = [];
    const filters = [];

    if (startDate) {
      params.push(startDate);
      filters.push(`created_at >= $${params.length}::date`);
    }

    if (endDate) {
      params.push(endDate);
      filters.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    if (admin && admin !== "all") {
      params.push(`%${admin}%`);
      filters.push(`(admin_name ILIKE $${params.length} OR admin_employee_id ILIKE $${params.length})`);
    }

    if (action && action !== "all") {
      params.push(action);
      filters.push(`action = $${params.length}`);
    }

    const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await query(
      `SELECT
         id,
         admin_name,
         admin_employee_id,
         action,
         target,
         target_type,
         target_id,
         created_at
       FROM audit_logs
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT 500`,
      params
    );

    const logs = result.rows.map((row) => ({
      id: row.id,
      adminName: row.admin_name,
      adminEmployeeId: row.admin_employee_id || "",
      action: row.action,
      actionLabel: formatAuditAction(row.action),
      target: row.target || "",
      targetType: row.target_type || "",
      targetId: row.target_id,
      createdAt: row.created_at,
    }));

    res.status(200).json({
      success: true,
      data: {
        logs,
        filters: {
          admins: Array.from(new Set(logs.map((log) => log.adminName).filter(Boolean))),
          actions: Array.from(new Set(logs.map((log) => log.action).filter(Boolean))),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const createAuditLog = async (req, res, next) => {
  try {
    const { action, target, targetType, targetId, metadata } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, message: "Audit action is required" });
    }

    await logAuditEvent({
      req,
      action,
      target,
      targetType,
      targetId,
      metadata,
    });

    res.status(201).json({
      success: true,
      message: "Audit log created",
    });
  } catch (error) {
    next(error);
  }
};

const updateAdmin = async (req, res, next) => {
  try {
    const adminId = Number.parseInt(req.params.id, 10);
    const { name, email, password, status } = req.body;

    if (!Number.isFinite(adminId)) {
      return res.status(400).json({ success: false, message: "Valid admin id is required" });
    }

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ success: false, message: "Full Name and Email are required" });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }

    const passwordValue = String(password || "").trim();
    const normalizedStatus = normalizeAdminStatus(status);

    const result = await withTransaction(async (client) => {
      const current = await client.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'admin' FOR UPDATE",
        [adminId]
      );

      if (!current.rows[0]) {
        const error = new Error("Admin not found");
        error.statusCode = 404;
        throw error;
      }

      await assertUniqueAdminEmail(cleanEmail, adminId, client);

      const hashedPassword = passwordValue ? await bcrypt.hash(passwordValue, 10) : null;
      const shouldInvalidateTokens = Boolean(hashedPassword) || normalizedStatus === "inactive";
      const updated = await client.query(
        `UPDATE users
         SET
           name = $1,
           email = $2,
           password = COALESCE($3, password),
           status = $4,
           token_version = token_version + CASE WHEN $5 THEN 1 ELSE 0 END,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 AND role = 'admin'
         RETURNING id, name, employee_id, email, role, status, created_at, updated_at`,
        [cleanName, cleanEmail, hashedPassword, normalizedStatus, shouldInvalidateTokens, adminId]
      );

      await logAuditEvent(
        {
          req,
          action: "admin_edit",
          target: `${updated.rows[0].name} (${updated.rows[0].employee_id})`,
          targetType: "admin",
          targetId: adminId,
          metadata: {
            passwordChanged: Boolean(hashedPassword),
            status: normalizedStatus,
          },
        },
        client
      );

      return updated;
    });

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      data: sanitizeAdmin(result.rows[0]),
    });
  } catch (error) {
    next(error);
  }
};

const deleteAdmin = async (req, res, next) => {
  try {
    const adminId = Number.parseInt(req.params.id, 10);

    if (!Number.isFinite(adminId)) {
      return res.status(400).json({ success: false, message: "Valid admin id is required" });
    }

    if (adminId === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account" });
    }

    const result = await query(
      `DELETE FROM users
       WHERE id = $1 AND role = 'admin'
       RETURNING id, name, employee_id, email, role, status, created_at, updated_at`,
      [adminId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    await logAuditEvent({
      req,
      action: "admin_delete",
      target: `${result.rows[0].name} (${result.rows[0].employee_id})`,
      targetType: "admin",
      targetId: adminId,
    });

    res.status(200).json({
      success: true,
      message: "Admin deleted successfully",
      data: sanitizeAdmin(result.rows[0]),
    });
  } catch (error) {
    next(error);
  }
};

const forceLogoutAdmin = async (req, res, next) => {
  try {
    const adminId = Number.parseInt(req.params.id, 10);

    if (!Number.isFinite(adminId)) {
      return res.status(400).json({ success: false, message: "Valid admin id is required" });
    }

    if (adminId === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot force logout yourself" });
    }

    const result = await withTransaction(async (client) => {
      const adminResult = await client.query(
        `SELECT id, name, employee_id, email, role, status, created_at, updated_at
         FROM users
         WHERE id = $1 AND role = 'admin'
         FOR UPDATE`,
        [adminId]
      );
      const admin = adminResult.rows[0];

      if (!admin) {
        const error = new Error("Admin not found");
        error.statusCode = 404;
        throw error;
      }

      const updated = await client.query(
        `UPDATE users
         SET status = 'active',
             token_version = token_version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND role = 'admin'
         RETURNING id, name, employee_id, email, role, status, created_at, updated_at`,
        [adminId]
      );

      return updated.rows[0];
    });

    res.status(200).json({
      success: true,
      message: "Admin logged out successfully",
      data: sanitizeAdmin(result),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAdmin,
  createAuditLog,
  deleteAdmin,
  forceLogoutAdmin,
  getAuditLogs,
  getAdmins,
  updateAdmin,
};
