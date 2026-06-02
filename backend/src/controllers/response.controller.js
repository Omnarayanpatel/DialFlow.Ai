const { query } = require("../config/db");
const {
  getTimeReportRows,
  timeReportRowsToCsv,
} = require("../services/timeReport.service");
const { logAuditEvent } = require("../services/audit.service");

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
const EDITABLE_RESPONSE_FIELDS = new Set([
  "callStatus",
  "disposition",
  "subDisposition",
  "language",
  "languageOther",
]);

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
  language_other
`;

const escapeCsv = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const formatExportDateTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
  const formattedTime = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(date);

  return `${formattedDate} ${formattedTime}`;
};

const normalizePageSize = (value) => {
  const requested = Number.parseInt(value, 10);
  return [10, 25, 50, 1000, 5000].includes(requested) ? requested : 10;
};

const normalizePage = (value) => {
  const requested = Number.parseInt(value, 10);
  return Number.isFinite(requested) && requested > 0 ? requested : 1;
};

const shouldExportAllRows = (value) => {
  return ["1", "true", "yes"].includes(String(value || "").trim().toLowerCase());
};

const cleanText = (value, maxLength = 500) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return String(value).trim().slice(0, maxLength);
};

const normalizeEditableResponsePayload = (body = {}) => {
  const unexpectedFields = Object.keys(body).filter((key) => !EDITABLE_RESPONSE_FIELDS.has(key));

  if (unexpectedFields.length) {
    return {
      error: `Fields not allowed for edit: ${unexpectedFields.join(", ")}`,
    };
  }

  const callStatus = cleanText(body.callStatus, 50);
  const disposition = cleanText(body.disposition, 100);
  const subDisposition = cleanText(body.subDisposition, 150);
  const language = cleanText(body.language, 50);
  const languageOther = cleanText(body.languageOther, 100);

  if (!callStatus || !disposition) {
    return {
      error: "callStatus and disposition are required",
    };
  }

  let safeSubDisposition = DEFAULT_SUB_DISPOSITION;

  if (disposition === "Call Back") {
    safeSubDisposition = CALLBACK_DISPOSITIONS.includes(subDisposition)
      ? subDisposition
      : DEFAULT_SUB_DISPOSITION;
  } else if (disposition === "Not Interested") {
    safeSubDisposition = NOT_INTERESTED_DISPOSITIONS.includes(subDisposition)
      ? subDisposition
      : DEFAULT_SUB_DISPOSITION;
  }

  return {
    data: {
      callStatus,
      disposition,
      subDisposition: safeSubDisposition,
      language: language || "NA",
      languageOther: languageOther || null,
    },
  };
};

const buildAdminResponseFilters = (queryParams = {}) => {
  const clauses = [];
  const params = [];

  const addFilter = (sql, value) => {
    params.push(value);
    clauses.push(sql.replace("?", `$${params.length}`));
  };

  if (queryParams.date) {
    addFilter("created_at >= ?::date", queryParams.date);
    addFilter("created_at < (?::date + INTERVAL '1 day')", queryParams.date);
  }

  if (queryParams.dateFrom) {
    addFilter("created_at >= ?::date", queryParams.dateFrom);
  }

  if (queryParams.dateTo) {
    addFilter("created_at < (?::date + INTERVAL '1 day')", queryParams.dateTo);
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

  if (queryParams.language && queryParams.language !== "all") {
    addFilter("COALESCE(NULLIF(language_other, ''), language) = ?", queryParams.language);
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
         language_other
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

const updateAgentResponse = async (req, res, next) => {
  try {
    if (req.user.role !== "agent") {
      return res.status(403).json({
        success: false,
        message: "Only agents can edit their own call history",
      });
    }

    const responseId = Number.parseInt(req.params.id, 10);

    if (!Number.isFinite(responseId)) {
      return res.status(400).json({
        success: false,
        message: "Valid response id is required",
      });
    }

    const { data, error } = normalizeEditableResponsePayload(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const result = await query(
      `UPDATE responses
       SET
         call_status = $1,
         disposition = $2,
         sub_disposition = $3,
         language = $4,
         language_other = $5
       WHERE id = $6
         AND employee_id = $7
         AND created_at::date = CURRENT_DATE
       RETURNING ${RESPONSE_SELECT}`,
      [
        data.callStatus,
        data.disposition,
        data.subDisposition,
        data.language,
        data.languageOther,
        responseId,
        req.user.employeeId || "",
      ]
    );

    if (!result.rows.length) {
      return res.status(403).json({
        success: false,
        message: "You can edit only your own same-day call entries",
      });
    }

    res.status(200).json({
      success: true,
      message: "Call history updated successfully",
      data: {
        ...result.rows[0],
        history_group: "today",
        is_editable: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getResponses = async (req, res, next) => {
  try {
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const exportAll = shouldExportAllRows(req.query.exportAll);
    const page = normalizePage(req.query.page);
    const pageSize = exportAll ? null : normalizePageSize(req.query.pageSize);
    const offset = exportAll ? null : (page - 1) * pageSize;
    const { params, whereSql } = buildAdminResponseFilters(req.query);
    const paginationSql = exportAll ? "" : `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const queryParams = exportAll ? params : [...params, pageSize, offset];

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
         ${paginationSql}
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
         WITH current_agent_status AS (
           SELECT
             u.id,
             CASE
               WHEN BOOL_OR(s.logout_time IS NULL AND LOWER(s.status) = 'online') THEN 'online'
               WHEN BOOL_OR(s.logout_time IS NULL AND LOWER(s.status) IN ('break', 'on break')) THEN 'break'
               ELSE 'offline'
             END AS current_status
           FROM users u
           LEFT JOIN agent_sessions s ON s.user_id = u.id AND s.logout_time IS NULL
           WHERE u.role = 'agent'
           GROUP BY u.id
         )
         SELECT
           COUNT(*) FILTER (WHERE current_status = 'online')::int AS active_agents,
           COUNT(*) FILTER (WHERE current_status = 'break')::int AS agents_on_break
         FROM current_agent_status
       )
       SELECT
         COALESCE((SELECT json_agg(paged ORDER BY paged.created_at DESC) FROM paged), '[]'::json) AS records,
         COALESCE((SELECT total_filtered FROM filtered_count), 0)::int AS total_filtered,
         (SELECT row_to_json(today_summary) FROM today_summary) AS summary,
         (SELECT row_to_json(agent_summary) FROM agent_summary) AS agent_summary`,
      queryParams
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
          pageSize: exportAll ? total : pageSize,
          total,
          totalPages: exportAll ? 1 : Math.max(Math.ceil(total / pageSize), 1),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const exportResponses = async (req, res, next) => {
  try {
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { params, whereSql } = buildAdminResponseFilters(req.query);
    const result = await query(
      `SELECT ${RESPONSE_SELECT}
       FROM responses
       WHERE ${whereSql}
       ORDER BY created_at DESC`
      ,
      params
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
      "connected_status",
      "disposition",
      "sub_disposition",
      "language",
      "language_other",
    ];

    const rows = result.rows.map((row) =>
      headers
        .map((header) => {
          if (header === "created_at") {
            return escapeCsv(formatExportDateTime(row[header]));
          }

          if (header === "connected_status") {
            return escapeCsv(row.call_status === "Connected" ? "Connected" : "Not Connected");
          }

          return escapeCsv(row[header]);
        })
        .join(",")
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="call-responses-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    await logAuditEvent({
      req,
      action: "report_download",
      target: "All Responses CSV",
      targetType: "report",
      metadata: { report: "responses", rows: rows.length },
    });
    res.status(200).send([headers.join(","), ...rows].join("\n"));
  } catch (error) {
    next(error);
  }
};

const getTimeReport = async (req, res, next) => {
  try {
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const rows = await getTimeReportRows(req.query);
    const sessionSummaryRows = Array.from(
      rows
        .reduce((sessions, row) => {
          if (!sessions.has(row.session_id)) {
            sessions.set(row.session_id, row);
          }

          return sessions;
        }, new Map())
        .values()
    );

    const summary = sessionSummaryRows.reduce(
      (totals, row) => ({
        totalLoginDuration: totals.totalLoginDuration + (row.total_login_duration || 0),
        totalBreakDuration: totals.totalBreakDuration + (row.total_break_duration || 0),
        staffTimeDuration: totals.staffTimeDuration + (row.staff_time_duration || 0),
        totalBreakCount: totals.totalBreakCount + rows.filter((breakRow) => breakRow.session_id === row.session_id && breakRow.break_id).length,
      }),
      {
        totalLoginDuration: 0,
        totalBreakDuration: 0,
        staffTimeDuration: 0,
        totalBreakCount: 0,
      }
    );

    res.status(200).json({
      success: true,
      message: "Session and break report fetched successfully",
      data: {
        records: rows,
        summary,
      },
    });
  } catch (error) {
    next(error);
  }
};

const exportTimeReport = async (req, res, next) => {
  try {
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const rows = await getTimeReportRows(req.query);
    const csv = timeReportRowsToCsv(rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="session-break-report-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    await logAuditEvent({
      req,
      action: "report_download",
      target: "Session and Break Report CSV",
      targetType: "report",
      metadata: { report: "time_report", rows: rows.length },
    });
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createResponse,
  updateAgentResponse,
  getResponses,
  exportResponses,
  getTimeReport,
  exportTimeReport,
};
