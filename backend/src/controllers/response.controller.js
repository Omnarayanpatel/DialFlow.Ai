const { query } = require("../config/db");

const CALLBACK_DISPOSITIONS = [
  "Concern Person Not Available",
  "Want Callback by Evening",
  "Want Callback by Tomorrow",
  "Want Callback after 1 hour",
  "Link Not Working",
];

const NOT_INTERESTED_DISPOSITIONS = [
  "Already Taken Loan",
  "Amount Not Needed",
  "High Processing Fees",
  "High ROI",
  "Reason Not Shared",
  "Require High Amount",
  "Not Applied",
];

const DEFAULT_SUB_DISPOSITION = "NA";

const RESPONSE_SELECT = `
  id,
  created_at,
  employee_id,
  employee_name,
  zoho_id,
  dialer_id,
  reference_id,
  call_status,
  disposition,
  sub_disposition,
  language,
  language_other,
  remark
`;

const escapeCsv = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const normalizePageSize = (value) => {
  const requested = Number.parseInt(value, 10);
  return [10, 25, 50].includes(requested) ? requested : 10;
};

const normalizePage = (value) => {
  const requested = Number.parseInt(value, 10);
  return Number.isFinite(requested) && requested > 0 ? requested : 1;
};

const buildAdminResponseFilters = (queryParams = {}) => {
  const clauses = [];
  const params = [];

  const addFilter = (sql, value) => {
    params.push(value);
    clauses.push(sql.replace("?", `$${params.length}`));
  };

  if (queryParams.date) {
    addFilter("created_at::date = ?::date", queryParams.date);
  }

  if (queryParams.employeeId) {
    addFilter("employee_id = ?", queryParams.employeeId.trim());
  }

  if (queryParams.employeeName) {
    addFilter("employee_name ILIKE ?", `%${queryParams.employeeName.trim()}%`);
  }

  if (queryParams.referenceId) {
    addFilter("reference_id ILIKE ?", `%${queryParams.referenceId.trim()}%`);
  }

  if (queryParams.callStatus && queryParams.callStatus !== "all") {
    addFilter("call_status = ?", queryParams.callStatus);
  }

  if (queryParams.disposition && queryParams.disposition !== "all") {
    addFilter("disposition = ?", queryParams.disposition);
  }

  if (queryParams.search) {
    const term = `%${queryParams.search.trim()}%`;
    params.push(term);
    clauses.push(`(employee_name ILIKE $${params.length} OR reference_id ILIKE $${params.length})`);
  }

  return {
    params,
    whereSql: clauses.length ? clauses.join(" AND ") : "TRUE",
  };
};

const createResponse = async (req, res, next) => {
  try {
    const {
      zohoId,
      dialerId,
      referenceId,
      callStatus,
      disposition,
      subDisposition,
      language,
      languageOther,
      remark,
    } = req.body;

    if (!referenceId || !callStatus || !disposition) {
      return res.status(400).json({
        success: false,
        message: "referenceId, callStatus, and disposition are required",
      });
    }

    let safeDisposition = disposition || DEFAULT_SUB_DISPOSITION;
    let safeSubDisposition = DEFAULT_SUB_DISPOSITION;

    if (safeDisposition === "Call Back") {
      safeSubDisposition = CALLBACK_DISPOSITIONS.includes(subDisposition)
        ? subDisposition
        : DEFAULT_SUB_DISPOSITION;
    } else if (safeDisposition === "Not Interested") {
      safeSubDisposition = NOT_INTERESTED_DISPOSITIONS.includes(subDisposition)
        ? subDisposition
        : DEFAULT_SUB_DISPOSITION;
    }

    const safeLanguage = language || "NA";

    const userResult = await query(
      "SELECT employee_id, name, zoho_id FROM users WHERE id = $1 LIMIT 1",
      [req.user.id]
    );

    const agent = userResult.rows[0];

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Authenticated user not found",
      });
    }

    const result = await query(
      `INSERT INTO responses (
         employee_id,
         employee_name,
         zoho_id,
         dialer_id,
         reference_id,
         call_status,
         disposition,
         sub_disposition,
         language,
         language_other,
         remark
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${RESPONSE_SELECT}`,
      [
        agent.employee_id || req.user.employeeId || "NA",
        agent.name,
        zohoId || agent.zoho_id || req.user.zohoId || null,
        dialerId || null,
        referenceId,
        callStatus,
        safeDisposition,
        safeSubDisposition,
        safeLanguage,
        languageOther || null,
        remark || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Response saved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

const getResponses = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const page = normalizePage(req.query.page);
    const pageSize = normalizePageSize(req.query.pageSize);
    const offset = (page - 1) * pageSize;
    const { params, whereSql } = buildAdminResponseFilters(req.query);
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    const result = await query(
      `WITH filtered AS (
         SELECT ${RESPONSE_SELECT}
         FROM responses
         WHERE ${whereSql}
       ),
       filtered_count AS (
         SELECT COUNT(*)::int AS total_filtered
         FROM filtered
       ),
       paged AS (
         SELECT
           filtered.*,
           CASE
             WHEN created_at::date = CURRENT_DATE THEN 'today'
             WHEN created_at::date = CURRENT_DATE - 1 THEN 'yesterday'
             ELSE 'older'
           END AS report_group
         FROM filtered
         ORDER BY created_at DESC
         LIMIT $${limitParam} OFFSET $${offsetParam}
       ),
       today_summary AS (
         SELECT
           COUNT(*)::int AS total_calls,
           COUNT(*) FILTER (WHERE LOWER(call_status) = 'connected')::int AS connected_calls,
           COUNT(*) FILTER (WHERE LOWER(call_status) = 'not connected')::int AS not_connected_calls,
           COUNT(*) FILTER (WHERE LOWER(disposition) IN ('positive', 'already positive'))::int AS positive_calls
         FROM responses
         WHERE created_at::date = CURRENT_DATE
       ),
       agent_summary AS (
         SELECT
           COUNT(DISTINCT user_id) FILTER (WHERE LOWER(status) = 'online' AND logout_time IS NULL)::int AS active_agents,
           COUNT(DISTINCT user_id) FILTER (WHERE LOWER(status) IN ('break', 'on break') AND logout_time IS NULL)::int AS agents_on_break
         FROM agent_sessions
       )
       SELECT
         COALESCE((SELECT json_agg(paged ORDER BY paged.created_at DESC) FROM paged), '[]'::json) AS records,
         COALESCE((SELECT total_filtered FROM filtered_count), 0)::int AS total_filtered,
         (SELECT row_to_json(today_summary) FROM today_summary) AS summary,
         (SELECT row_to_json(agent_summary) FROM agent_summary) AS agent_summary`,
      [...params, pageSize, offset]
    );

    const payload = result.rows[0] || {};
    const summary = payload.summary || {};
    const agentSummary = payload.agent_summary || {};
    const total = payload.total_filtered || 0;

    res.status(200).json({
      success: true,
      message: "Responses fetched successfully",
      data: {
        records: payload.records || [],
        summary: {
          totalCalls: summary.total_calls || 0,
          connectedCalls: summary.connected_calls || 0,
          notConnectedCalls: summary.not_connected_calls || 0,
          positiveCalls: summary.positive_calls || 0,
          activeAgents: agentSummary.active_agents || 0,
          agentsOnBreak: agentSummary.agents_on_break || 0,
        },
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(Math.ceil(total / pageSize), 1),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const exportResponses = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const result = await query(
      `SELECT ${RESPONSE_SELECT}
       FROM responses
       ORDER BY created_at DESC`
    );

    const headers = [
      "id",
      "created_at",
      "employee_id",
      "employee_name",
      "zoho_id",
      "dialer_id",
      "reference_id",
      "call_status",
      "disposition",
      "sub_disposition",
      "language",
      "language_other",
      "remark",
    ];

    const rows = result.rows.map((row) =>
      headers.map((header) => escapeCsv(row[header])).join(",")
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="call-responses-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.status(200).send([headers.join(","), ...rows].join("\n"));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createResponse,
  getResponses,
  exportResponses,
};
