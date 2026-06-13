const { query, withTransaction } = require("../config/db");
const { emitToDowntimeAdmins, emitToUser } = require("../services/socket.service");

const ISSUE_TYPES = new Set([
  "System Issue",
  "Internet Issue",
  "Portal Issue",
  "Dialer Issue",
  "Session",
]);

const sanitizeDowntime = (row) => ({
  id: row.id,
  agentId: row.agent_id,
  agentName: row.agent_name || "",
  employeeId: row.employee_id,
  issueType: row.issue_type,
  comment: row.comment,
  status: row.status,
  requestedAt: row.requested_at,
  approvedAt: row.approved_at,
  approvedBy: row.approved_by,
  approvedByName: row.approved_by_name || "",
  resolvedAt: row.resolved_at,
  durationSeconds: Number(row.duration_seconds || row.running_duration_seconds || 0),
  runningDurationSeconds: Number(row.running_duration_seconds || row.duration_seconds || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const baseDowntimeSelect = `
  dr.id,
  dr.agent_id,
  agent.name AS agent_name,
  dr.employee_id,
  dr.issue_type,
  dr.comment,
  dr.status,
  dr.requested_at,
  dr.approved_at,
  dr.approved_by,
  approver.name AS approved_by_name,
  dr.resolved_at,
  dr.duration_seconds,
  CASE
    WHEN dr.status = 'approved' AND dr.resolved_at IS NULL AND dr.approved_at IS NOT NULL
      THEN GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - dr.approved_at))::int, 0)
    ELSE COALESCE(dr.duration_seconds, 0)
  END AS running_duration_seconds,
  dr.created_at,
  dr.updated_at
`;

const buildDowntimeFilters = (queryParams = {}) => {
  const clauses = [];
  const params = [];

  const addFilter = (sql, value) => {
    params.push(value);
    clauses.push(sql.replace("?", `$${params.length}`));
  };

  if (queryParams.status && queryParams.status !== "all") {
    addFilter("dr.status = ?", String(queryParams.status).trim().toLowerCase());
  }

  if (queryParams.employeeId && queryParams.employeeId !== "all") {
    addFilter("dr.employee_id = ?", String(queryParams.employeeId).trim());
  }

  if (queryParams.agentId && queryParams.agentId !== "all") {
    addFilter("dr.agent_id = ?", queryParams.agentId);
  }

  if (queryParams.issueType && queryParams.issueType !== "all") {
    addFilter("dr.issue_type = ?", String(queryParams.issueType).trim());
  }

  if (queryParams.dateFrom) {
    addFilter("dr.requested_at >= ?::date", queryParams.dateFrom);
  }

  if (queryParams.dateTo) {
    addFilter("dr.requested_at < (?::date + INTERVAL '1 day')", queryParams.dateTo);
  }

  return {
    params,
    whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
  };
};

const getDowntimeById = async (id, db = { query }) => {
  const result = await db.query(
    `SELECT ${baseDowntimeSelect}
     FROM downtime_requests dr
     LEFT JOIN users agent ON agent.id = dr.agent_id
     LEFT JOIN users approver ON approver.id = dr.approved_by
     WHERE dr.id = $1
     LIMIT 1`,
    [id]
  );

  return result.rows[0] ? sanitizeDowntime(result.rows[0]) : null;
};

const emitDowntimeEvent = (eventName, downtimeRequest) => {
  emitToDowntimeAdmins(eventName, downtimeRequest);
  emitToUser(downtimeRequest?.agentId, eventName, downtimeRequest);
};

const getDowntimeRequests = async (req, res, next) => {
  try {
    const { params, whereSql } = buildDowntimeFilters(req.query);
    const result = await query(
      `SELECT ${baseDowntimeSelect}
       FROM downtime_requests dr
       LEFT JOIN users agent ON agent.id = dr.agent_id
       LEFT JOIN users approver ON approver.id = dr.approved_by
       ${whereSql}
       ORDER BY
         CASE dr.status
           WHEN 'pending' THEN 1
           WHEN 'approved' THEN 2
           WHEN 'rejected' THEN 3
           ELSE 4
         END,
         dr.requested_at DESC`,
      params
    );

    res.status(200).json({
      success: true,
      message: "Downtime requests fetched",
      data: {
        requests: result.rows.map(sanitizeDowntime),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMyCurrentDowntimeRequest = async (req, res, next) => {
  try {
    if (req.user.role !== "agent") {
      return res.status(403).json({ success: false, message: "Only agents can view their downtime status" });
    }

    const result = await query(
      `SELECT ${baseDowntimeSelect}
       FROM downtime_requests dr
       LEFT JOIN users agent ON agent.id = dr.agent_id
       LEFT JOIN users approver ON approver.id = dr.approved_by
       WHERE dr.agent_id = $1
         AND dr.status IN ('pending', 'approved')
         AND dr.requested_at::date = CURRENT_DATE
       ORDER BY
         CASE WHEN dr.status = 'approved' THEN 0 ELSE 1 END,
         dr.requested_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      message: "Current downtime status fetched",
      data: {
        request: result.rows[0] ? sanitizeDowntime(result.rows[0]) : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

const createDowntimeRequest = async (req, res, next) => {
  try {
    if (req.user.role !== "agent") {
      return res.status(403).json({ success: false, message: "Only agents can create downtime requests" });
    }

    const issueType = String(req.body.issueType || req.body.issue_type || "").trim();
    const comment = String(req.body.comment || "").trim();

    if (!ISSUE_TYPES.has(issueType)) {
      return res.status(400).json({ success: false, message: "Valid issue type is required" });
    }

    if (!comment) {
      return res.status(400).json({ success: false, message: "Comment is required" });
    }

    const downtimeRequest = await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [req.user.id]);

      const activeRequest = await client.query(
        `SELECT id, status
         FROM downtime_requests
         WHERE agent_id = $1
           AND status IN ('pending', 'approved')
           AND requested_at::date = CURRENT_DATE
         LIMIT 1`,
        [req.user.id]
      );

      if (activeRequest.rows[0]) {
        const error = new Error("You already have an active downtime request");
        error.statusCode = 409;
        throw error;
      }

      const result = await client.query(
        `INSERT INTO downtime_requests (agent_id, employee_id, issue_type, comment, status, requested_at)
         VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)
         RETURNING *`,
        [req.user.id, req.user.employeeId || req.user.employee_id || "", issueType, comment]
      );

      return getDowntimeById(result.rows[0].id, client);
    });

    emitDowntimeEvent("new_downtime_request", downtimeRequest);

    res.status(201).json({
      success: true,
      message: "Downtime request submitted for approval",
      data: downtimeRequest,
    });
  } catch (error) {
    next(error);
  }
};

const approveDowntimeRequest = async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "Valid downtime request id is required" });
    }

    const downtimeRequest = await withTransaction(async (client) => {
      const current = await client.query(
        "SELECT id, status FROM downtime_requests WHERE id = $1 FOR UPDATE",
        [id]
      );

      if (!current.rows[0]) {
        const error = new Error("Downtime request not found");
        error.statusCode = 404;
        throw error;
      }

      if (current.rows[0].status !== "pending") {
        const error = new Error("Only pending downtime requests can be approved");
        error.statusCode = 400;
        throw error;
      }

      await client.query(
        `UPDATE downtime_requests
         SET status = 'approved',
             approved_at = CURRENT_TIMESTAMP,
             approved_by = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, req.user.id]
      );

      return getDowntimeById(id, client);
    });

    emitDowntimeEvent("downtime_approved", downtimeRequest);

    res.status(200).json({
      success: true,
      message: "Downtime request approved",
      data: downtimeRequest,
    });
  } catch (error) {
    next(error);
  }
};

const rejectDowntimeRequest = async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "Valid downtime request id is required" });
    }

    const result = await query(
      `UPDATE downtime_requests
       SET status = 'rejected',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Pending downtime request not found" });
    }

    const downtimeRequest = await getDowntimeById(result.rows[0].id);

    emitDowntimeEvent("downtime_rejected", downtimeRequest);

    res.status(200).json({
      success: true,
      message: "Downtime request rejected",
      data: downtimeRequest,
    });
  } catch (error) {
    next(error);
  }
};

const resolveDowntimeRequest = async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "Valid downtime request id is required" });
    }

    const downtimeRequest = await withTransaction(async (client) => {
      const current = await client.query(
        "SELECT id, agent_id, status, approved_at, requested_at FROM downtime_requests WHERE id = $1 FOR UPDATE",
        [id]
      );

      if (!current.rows[0]) {
        const error = new Error("Downtime request not found");
        error.statusCode = 404;
        throw error;
      }

      if (current.rows[0].status !== "approved" || !current.rows[0].approved_at) {
        const error = new Error("Only active approved downtime can be resolved");
        error.statusCode = 400;
        throw error;
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "super_admin";
      const isOwningAgent = req.user.role === "agent" && Number(current.rows[0].agent_id) === Number(req.user.id);

      if (!isAdmin && !isOwningAgent) {
        const error = new Error("You can resolve only your own approved downtime");
        error.statusCode = 403;
        throw error;
      }

      if (isOwningAgent) {
        const sameDay = await client.query(
          "SELECT ($1::timestamp)::date = CURRENT_DATE AS is_today",
          [current.rows[0].requested_at]
        );

        if (!sameDay.rows[0]?.is_today) {
          const error = new Error("Only today's approved downtime can be resolved from the agent dashboard");
          error.statusCode = 400;
          throw error;
        }
      }

      await client.query(
        `UPDATE downtime_requests
         SET status = 'resolved',
             resolved_at = CURRENT_TIMESTAMP,
             duration_seconds = GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - approved_at))::int, 0),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      return getDowntimeById(id, client);
    });

    emitDowntimeEvent("downtime_resolved", downtimeRequest);

    res.status(200).json({
      success: true,
      message: "Downtime resolved",
      data: downtimeRequest,
    });
  } catch (error) {
    next(error);
  }
};

const getDowntimeReport = async (req, res, next) => {
  try {
    const { params, whereSql } = buildDowntimeFilters({
      ...req.query,
      status: req.query.status || "all",
    });

    const result = await query(
      `SELECT ${baseDowntimeSelect}
       FROM downtime_requests dr
       LEFT JOIN users agent ON agent.id = dr.agent_id
       LEFT JOIN users approver ON approver.id = dr.approved_by
       ${whereSql}
       ORDER BY dr.requested_at DESC`,
      params
    );

    const records = result.rows.map((row) => ({
      ...sanitizeDowntime(row),
      date: row.requested_at,
      startTime: row.approved_at,
      endTime: row.resolved_at,
    }));

    res.status(200).json({
      success: true,
      message: "Downtime report fetched",
      data: {
        records,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getDowntimeHistory = async (req, res, next) => {
  try {
    const { params, whereSql } = buildDowntimeFilters({
      ...req.query,
      status: req.query.status || "all",
      issueType: req.query.issueType || "all",
    });

    const result = await query(
      `SELECT ${baseDowntimeSelect}
       FROM downtime_requests dr
       LEFT JOIN users agent ON agent.id = dr.agent_id
       LEFT JOIN users approver ON approver.id = dr.approved_by
       ${whereSql}
       ORDER BY dr.requested_at DESC`,
      params
    );

    const records = result.rows.map((row) => ({
      ...sanitizeDowntime(row),
      date: row.requested_at,
      requestedTime: row.requested_at,
      approvedTime: row.approved_at,
      resolvedTime: row.resolved_at,
      startTime: row.approved_at,
      endTime: row.resolved_at,
    }));

    res.status(200).json({
      success: true,
      message: "Downtime history fetched",
      data: {
        records,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMyDowntimeHistory = async (req, res, next) => {
  try {
    if (req.user.role !== "agent") {
      return res.status(403).json({ success: false, message: "Only agents can view their downtime history" });
    }

    const { params, whereSql } = buildDowntimeFilters({
      ...req.query,
      agentId: req.user.id,
      employeeId: "all",
      status: req.query.status || "all",
      issueType: req.query.issueType || "all",
    });

    const result = await query(
      `SELECT ${baseDowntimeSelect}
       FROM downtime_requests dr
       LEFT JOIN users agent ON agent.id = dr.agent_id
       LEFT JOIN users approver ON approver.id = dr.approved_by
       ${whereSql}
       ORDER BY dr.requested_at DESC`,
      params
    );

    const records = result.rows.map((row) => ({
      ...sanitizeDowntime(row),
      date: row.requested_at,
      requestedTime: row.requested_at,
      approvedTime: row.approved_at,
      resolvedTime: row.resolved_at,
      startTime: row.approved_at,
      endTime: row.resolved_at,
    }));

    res.status(200).json({
      success: true,
      message: "Agent downtime history fetched",
      data: {
        records,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  approveDowntimeRequest,
  createDowntimeRequest,
  getDowntimeHistory,
  getMyDowntimeHistory,
  getDowntimeReport,
  getDowntimeRequests,
  getMyCurrentDowntimeRequest,
  rejectDowntimeRequest,
  resolveDowntimeRequest,
};
