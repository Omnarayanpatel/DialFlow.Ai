const { query } = require("../config/db");

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

const normalizePageSize = (value) => {
  const requested = Number.parseInt(value, 10);
  return [10, 25, 50].includes(requested) ? requested : 10;
};

const normalizePage = (value) => {
  const requested = Number.parseInt(value, 10);
  return Number.isFinite(requested) && requested > 0 ? requested : 1;
};

const buildHistoryFilters = (req) => {
  const clauses = ["employee_id = $1"];
  const params = [req.user.employeeId || ""];

  const addFilter = (sql, value) => {
    params.push(value);
    clauses.push(sql.replace("?", `$${params.length}`));
  };

  if (req.query.date) {
    addFilter("created_at::date = ?::date", req.query.date);
  }

  if (req.query.referenceId) {
    addFilter("reference_id ILIKE ?", `%${req.query.referenceId.trim()}%`);
  }

  if (req.query.callStatus && req.query.callStatus !== "all") {
    addFilter("call_status = ?", req.query.callStatus);
  }

  if (req.query.disposition && req.query.disposition !== "all") {
    addFilter("disposition = ?", req.query.disposition);
  }

  return {
    params,
    whereSql: clauses.join(" AND "),
  };
};

const getAgentDashboard = async (req, res, next) => {
  try {
    const [statsResult, sessionResult, recentResult] = await Promise.all([
      query(
      `SELECT
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE LOWER(call_status) = 'connected')::int AS connected_calls,
        COUNT(*) FILTER (WHERE LOWER(call_status) = 'not connected')::int AS not_connected_calls,
        COUNT(*) FILTER (WHERE LOWER(disposition) IN ('positive', 'already positive'))::int AS positive_calls
       FROM responses
       WHERE employee_id = $1
         AND created_at::date = CURRENT_DATE`,
      [req.user.employeeId || ""]
      ),
      query(
        `WITH active_sessions AS (
           SELECT *
           FROM agent_sessions
           WHERE user_id = $1 AND logout_time IS NULL
         ),
         active_metrics AS (
           SELECT
             MIN(login_time) AS login_time,
             COALESCE(SUM(
               GREATEST(
                 EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - login_time))::int,
                 0
             )
           ), 0)::int AS total_login_duration,
             COALESCE(SUM(
               CASE
                 WHEN break_start_time IS NOT NULL
                   AND LOWER(TRIM(COALESCE(break_reason, ''))) NOT IN ('session', 'session break')
                   THEN GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0)
                 ELSE 0
               END
             ), 0)::int AS current_break_duration,
             BOOL_OR(LOWER(status) = 'online') AS has_online_session,
             BOOL_OR(LOWER(status) IN ('break', 'on break')) AS has_break_session,
             COUNT(*)::int AS active_session_count,
             (ARRAY_AGG(break_reason ORDER BY break_start_time DESC NULLS LAST)
               FILTER (WHERE LOWER(status) IN ('break', 'on break')))[1] AS break_reason,
             (ARRAY_AGG(break_remark ORDER BY break_start_time DESC NULLS LAST)
               FILTER (WHERE LOWER(status) IN ('break', 'on break')))[1] AS break_remark,
             MAX(break_start_time) FILTER (WHERE LOWER(status) IN ('break', 'on break')) AS break_start_time,
             MAX(break_end_time) AS break_end_time
           FROM active_sessions
         ),
         active_break_totals AS (
           SELECT
             COALESCE(SUM(
               GREATEST(
                 EXTRACT(EPOCH FROM (COALESCE(b.break_end_time, CURRENT_TIMESTAMP) - b.break_start_time))::int,
                 0
               )
             ), 0)::int AS active_break_duration
           FROM agent_breaks b
           INNER JOIN active_sessions s ON s.id = b.session_id
           WHERE LOWER(TRIM(COALESCE(b.break_reason, ''))) NOT IN ('session', 'session break')
         ),
         today_metrics AS (
           SELECT
             COALESCE(SUM(
               GREATEST(
                 EXTRACT(EPOCH FROM (COALESCE(logout_time, CURRENT_TIMESTAMP) - login_time))::int,
                 0
               )
             ), 0)::int AS staff_time_today,
             COALESCE((
               SELECT COUNT(*)::int
               FROM agent_breaks b
               WHERE b.user_id = $1
                 AND b.break_start_time::date = CURRENT_DATE
                 AND LOWER(TRIM(COALESCE(b.break_reason, ''))) NOT IN ('session', 'session break')
             ), 0)::int AS break_count_today,
             COALESCE((
               SELECT SUM(
                 GREATEST(
                   EXTRACT(EPOCH FROM (COALESCE(b.break_end_time, CURRENT_TIMESTAMP) - b.break_start_time))::int,
                   0
                 )
               )::int
               FROM agent_breaks b
               WHERE b.user_id = $1
                 AND b.break_start_time::date = CURRENT_DATE
                 AND LOWER(TRIM(COALESCE(b.break_reason, ''))) NOT IN ('session', 'session break')
             ), 0)::int AS total_break_duration_today
           FROM agent_sessions
           WHERE user_id = $1
             AND login_time::date = CURRENT_DATE
         ),
         downtime_metrics AS (
           SELECT
             COALESCE(SUM(
               GREATEST(
                 EXTRACT(EPOCH FROM (
                   LEAST(COALESCE(resolved_at, CURRENT_TIMESTAMP), CURRENT_DATE + INTERVAL '1 day')
                     - GREATEST(approved_at, CURRENT_DATE)
                 ))::int,
                 0
               )
             ), 0)::int AS downtime_duration_today
           FROM downtime_requests
           WHERE employee_id = $2
             AND status IN ('approved', 'resolved')
             AND approved_at IS NOT NULL
             AND approved_at < CURRENT_DATE + INTERVAL '1 day'
             AND COALESCE(resolved_at, CURRENT_TIMESTAMP) >= CURRENT_DATE
         )
         SELECT
           am.login_time,
           GREATEST(
           COALESCE(tm.staff_time_today, 0) - COALESCE(tm.total_break_duration_today, 0),
             0
           )::int AS total_login_duration_today,
           GREATEST(COALESCE(am.total_login_duration, 0) - COALESCE(abt.active_break_duration, 0), 0)::int AS total_login_duration,
           COALESCE(am.total_login_duration, 0) AS active_session_duration,
           COALESCE(tm.break_count_today, 0) AS break_count_today,
           COALESCE(tm.total_break_duration_today, 0) AS total_break_duration_today,
           COALESCE(tm.staff_time_today, 0) AS staff_time_today,
           COALESCE(dm.downtime_duration_today, 0) AS downtime_duration_today,
           COALESCE(am.current_break_duration, 0) AS current_break_duration,
           COALESCE(am.active_session_count, 0) AS active_session_count,
           am.break_reason,
           am.break_remark,
           am.break_start_time,
           am.break_end_time,
           CASE
             WHEN COALESCE(am.has_break_session, false) THEN 'break'
             WHEN COALESCE(am.has_online_session, false) THEN 'online'
             ELSE 'offline'
           END AS status,
           CURRENT_TIMESTAMP AS server_time,
           (
             SELECT COUNT(*)::int
             FROM responses
             WHERE employee_id = $2
               AND am.login_time IS NOT NULL
               AND created_at >= am.login_time
           ) AS calls_this_session
         FROM active_metrics am
         CROSS JOIN active_break_totals abt
         CROSS JOIN today_metrics tm
         CROSS JOIN downtime_metrics dm`,
        [req.user.id, req.user.employeeId || ""]
      ),
      query(
        `SELECT ${RESPONSE_SELECT}
         FROM responses
         WHERE employee_id = $1
           AND created_at::date = CURRENT_DATE
         ORDER BY created_at DESC
         LIMIT 5`,
        [req.user.employeeId || ""]
      ),
    ]);

    const summary = statsResult.rows[0] || {
      total_calls: 0,
      connected_calls: 0,
      not_connected_calls: 0,
      positive_calls: 0,
    };
    const session = sessionResult.rows[0] || { calls_this_session: 0 };

    res.status(200).json({
      success: true,
      message: "Agent dashboard data fetched",
      data: {
        summary: {
          totalCalls: summary.total_calls,
          connectedCalls: summary.connected_calls,
          notConnectedCalls: summary.not_connected_calls,
          positiveCalls: summary.positive_calls,
        },
        session: {
          callsThisSession: session.calls_this_session || 0,
          loginTime: session.login_time,
          totalLoginDuration: session.total_login_duration || 0,
          totalLoginDurationToday: session.total_login_duration_today || 0,
          total_login_time: session.total_login_duration_today || 0,
          activeSessionDuration: session.active_session_duration || 0,
          breakCountToday: session.break_count_today || 0,
          totalBreakDurationToday: session.total_break_duration_today || 0,
          total_break_time: session.total_break_duration_today || 0,
          downtimeDurationToday: session.downtime_duration_today || 0,
          downtime_duration_today: session.downtime_duration_today || 0,
          staffTimeToday: session.staff_time_today || 0,
          staff_time: session.staff_time_today || 0,
          currentBreakDuration: session.current_break_duration || 0,
          current_break_status: session.status === "break" ? "break" : "none",
          activeSessionCount: session.active_session_count || 0,
          breakReason: session.break_reason || "",
          breakRemark: session.break_remark || "",
          breakStartTime: session.break_start_time,
          breakEndTime: session.break_end_time,
          status: session.status || "offline",
          serverTime: session.server_time,
        },
        recentToday: recentResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAgentHistory = async (req, res, next) => {
  try {
    const page = normalizePage(req.query.page);
    const pageSize = normalizePageSize(req.query.pageSize);
    const offset = (page - 1) * pageSize;
    const { params, whereSql } = buildHistoryFilters(req);
    const pageParams = [...params, pageSize, offset];
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    const [result, countResult] = await Promise.all([
      query(
      `SELECT
         ${RESPONSE_SELECT},
         CASE
           WHEN created_at::date = CURRENT_DATE THEN 'today'
           WHEN created_at::date = CURRENT_DATE - 1 THEN 'yesterday'
           ELSE 'older'
         END AS history_group,
         (created_at::date = CURRENT_DATE) AS is_editable
       FROM responses
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      pageParams
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM responses
         WHERE ${whereSql}`,
        params
      ),
    ]);

    const total = countResult.rows[0]?.total || 0;

    res.status(200).json({
      success: true,
      message: "Agent history fetched",
      data: {
        records: result.rows,
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

module.exports = {
  getAgentDashboard,
  getAgentHistory,
};
