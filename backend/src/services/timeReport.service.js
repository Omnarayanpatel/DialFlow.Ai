const { query } = require("../config/db");

const escapeCsv = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const formatExportTime = (value) => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
};

const formatExportDate = (value) => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
    .format(new Date(value))
    .replace(/\//g, "-");
};

const formatDurationText = (seconds) => {
  const safeSeconds = Math.max(Number.parseInt(seconds, 10) || 0, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
};

const buildTimeReportFilters = (queryParams = {}) => {
  const clauses = ["u.role = 'agent'"];
  const params = [];

  const addFilter = (sql, value) => {
    params.push(value);
    clauses.push(sql.replace("?", `$${params.length}`));
  };

  if (queryParams.dateFrom) {
    addFilter("s.login_time >= ?::date", queryParams.dateFrom);
  }

  if (queryParams.dateTo) {
    addFilter("s.login_time < (?::date + INTERVAL '1 day')", queryParams.dateTo);
  }

  if (queryParams.employeeId && queryParams.employeeId !== "all") {
    addFilter("u.employee_id = ?", String(queryParams.employeeId).trim());
  }

  return {
    params,
    whereSql: clauses.join(" AND "),
  };
};

const getTimeReportRows = async (queryParams = {}) => {
  const { params, whereSql } = buildTimeReportFilters(queryParams);

  const result = await query(
    `WITH break_summary AS (
       SELECT
         session_id,
         MIN(break_start_time) AS first_break_start_time,
         MAX(COALESCE(break_end_time, CURRENT_TIMESTAMP)) AS last_break_end_time,
         (ARRAY_AGG(break_reason ORDER BY break_start_time DESC)
           FILTER (WHERE break_reason IS NOT NULL AND break_reason <> ''))[1] AS break_reason,
         COUNT(*)::int AS event_break_count,
         COALESCE(SUM(
           CASE
             WHEN break_end_time IS NULL
               THEN GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0)
             ELSE GREATEST(total_break_duration, 0)
           END
         ), 0)::int AS event_break_duration
       FROM agent_breaks
       GROUP BY session_id
     ),
     session_rows AS (
       SELECT
         s.id,
         u.name AS agent_name,
         u.employee_id,
         s.login_time,
         s.logout_time,
         COALESCE(bs.first_break_start_time, s.break_start_time) AS break_start_time,
         COALESCE(bs.last_break_end_time, s.break_end_time) AS break_end_time,
         COALESCE(bs.break_reason, s.break_reason) AS break_reason,
         CASE WHEN COALESCE(bs.event_break_count, 0) > 0 THEN bs.event_break_count ELSE s.break_count END AS break_count,
         GREATEST(EXTRACT(EPOCH FROM (COALESCE(s.logout_time, CURRENT_TIMESTAMP) - s.login_time))::int, 0) AS staff_time_duration,
         CASE
           WHEN COALESCE(bs.event_break_count, 0) > 0 THEN GREATEST(bs.event_break_duration, 0)
           ELSE GREATEST(
             s.total_break_duration + CASE
               WHEN s.logout_time IS NULL AND s.break_start_time IS NOT NULL
                 THEN GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.break_start_time))::int, 0)
               ELSE 0
             END,
             0
           )::int
         END AS total_break_duration
       FROM agent_sessions s
       INNER JOIN users u ON u.id = s.user_id
       LEFT JOIN break_summary bs ON bs.session_id = s.id
       WHERE ${whereSql}
     )
     SELECT
       id,
       agent_name,
       employee_id,
       login_time,
       logout_time,
       break_start_time,
       break_end_time,
       break_reason,
       break_count,
       GREATEST(staff_time_duration - total_break_duration, 0)::int AS total_login_duration,
       total_break_duration,
       staff_time_duration
     FROM session_rows
     ORDER BY login_time DESC, agent_name ASC`,
    params
  );

  return result.rows;
};

const timeReportRowsToCsv = (rows) => {
  const headers = [
    "Agent Name",
    "Employee ID",
    "Login Date",
    "Login Time",
    "Logout Time",
    "Break Start Time",
    "Break End Time",
    "Break Reason",
    "Total Login Time",
    "Total Staff Time",
    "Break Time",
    "Break Count",
  ];

  const csvRows = rows.map((row) =>
    [
      row.agent_name,
      row.employee_id,
      formatExportDate(row.login_time),
      formatExportTime(row.login_time),
      formatExportTime(row.logout_time),
      formatExportTime(row.break_start_time),
      formatExportTime(row.break_end_time),
      row.break_reason,
      formatDurationText(row.total_login_duration),
      formatDurationText(row.staff_time_duration),
      formatDurationText(row.total_break_duration),
      row.break_count,
    ]
      .map(escapeCsv)
      .join(",")
  );

  return [headers.join(","), ...csvRows].join("\n");
};

module.exports = {
  getTimeReportRows,
  timeReportRowsToCsv,
};
