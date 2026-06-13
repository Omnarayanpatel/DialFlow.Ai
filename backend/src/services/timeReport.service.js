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
    `WITH session_rows AS (
       SELECT
         s.id,
         u.name AS agent_name,
         u.employee_id,
         s.login_time,
         s.logout_time,
         GREATEST(EXTRACT(EPOCH FROM (COALESCE(s.logout_time, CURRENT_TIMESTAMP) - s.login_time))::int, 0) AS staff_time_duration,
         GREATEST(
           s.total_break_duration + CASE
             WHEN s.logout_time IS NULL AND s.break_start_time IS NOT NULL
               THEN GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.break_start_time))::int, 0)
             ELSE 0
           END,
           0
         )::int AS session_total_break_duration
       FROM agent_sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE ${whereSql}
     ),
     break_rows AS (
       SELECT
         b.id AS break_id,
         b.session_id,
         ROW_NUMBER() OVER (
           PARTITION BY b.session_id
           ORDER BY b.break_start_time ASC, b.id ASC
         )::int AS break_number,
         b.break_reason,
         b.break_remark,
         b.break_start_time,
         b.break_end_time,
         GREATEST(
           EXTRACT(EPOCH FROM (COALESCE(b.break_end_time, CURRENT_TIMESTAMP) - b.break_start_time))::int,
           0
         ) AS break_duration
       FROM agent_breaks b
       WHERE LOWER(TRIM(COALESCE(b.break_reason, ''))) NOT IN ('session', 'session break')
     ),
     session_break_totals AS (
       SELECT
         b.session_id,
         COALESCE(SUM(
           GREATEST(
             EXTRACT(EPOCH FROM (COALESCE(b.break_end_time, CURRENT_TIMESTAMP) - b.break_start_time))::int,
             0
           )
         ), 0)::int AS total_break_duration,
         COUNT(*)::int AS break_count
       FROM agent_breaks b
       WHERE LOWER(TRIM(COALESCE(b.break_reason, ''))) NOT IN ('session', 'session break')
       GROUP BY b.session_id
     )
     SELECT
       sr.id,
       sr.id AS session_id,
       br.break_id,
       sr.agent_name,
       sr.employee_id,
       sr.login_time,
       sr.logout_time,
       br.break_number,
       COALESCE(NULLIF(TRIM(br.break_reason), ''), NULLIF(TRIM(br.break_remark), '')) AS break_reason,
       br.break_start_time,
       br.break_end_time,
       COALESCE(br.break_duration, 0)::int AS break_duration,
       GREATEST(sr.staff_time_duration - COALESCE(sbt.total_break_duration, 0), 0)::int AS total_login_duration,
       COALESCE(sbt.total_break_duration, 0)::int AS total_break_duration,
       sr.staff_time_duration,
       COALESCE(sbt.break_count, 0)::int AS break_count
     FROM session_rows sr
     LEFT JOIN break_rows br ON br.session_id = sr.id
     LEFT JOIN session_break_totals sbt ON sbt.session_id = sr.id
     ORDER BY sr.agent_name ASC, sr.employee_id ASC, sr.login_time DESC, br.break_number ASC NULLS LAST`,
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
    "Break #",
    "Break Reason",
    "Break Start",
    "Break End",
    "Break Duration",
    "Total Login",
    "Total Staff",
    "Total Break Time",
  ];

  const csvRows = rows.map((row) =>
    [
      row.agent_name,
      row.employee_id,
      formatExportDate(row.login_time),
      formatExportTime(row.login_time),
      formatExportTime(row.logout_time),
      row.break_number || "",
      row.break_reason,
      formatExportTime(row.break_start_time),
      formatExportTime(row.break_end_time),
      formatDurationText(row.break_duration),
      formatDurationText(row.total_login_duration),
      formatDurationText(row.staff_time_duration),
      formatDurationText(row.total_break_duration),
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
