const { query } = require("../config/db");

const normalizeAction = (action) => String(action || "").trim().toLowerCase().replace(/\s+/g, "_");

const logAuditEvent = async (
  {
    req,
    action,
    target = "",
    targetType = "",
    targetId = null,
    metadata = {},
  },
  client = null
) => {
  const actor = req?.user || {};
  const runner = client || { query };

  try {
    await runner.query(
      `INSERT INTO audit_logs (
         admin_id,
         admin_name,
         admin_employee_id,
         action,
         target,
         target_type,
         target_id,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        actor.id || null,
        actor.name || "Unknown Admin",
        actor.employeeId || actor.employee_id || "",
        normalizeAction(action),
        String(target || "").slice(0, 255),
        String(targetType || "").slice(0, 80),
        targetId,
        metadata,
      ]
    );
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
};

module.exports = {
  logAuditEvent,
  normalizeAction,
};
