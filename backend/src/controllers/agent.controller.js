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
  language_other,
  remark
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
    const loginTime = req.query.loginTime ? new Date(req.query.loginTime) : null;
    const hasLoginTime = loginTime && !Number.isNaN(loginTime.getTime());

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
        `SELECT COUNT(*)::int AS calls_this_session
         FROM responses
         WHERE employee_id = $1
           AND ($2::timestamp IS NULL OR created_at >= $2::timestamp)`,
        [req.user.employeeId || "", hasLoginTime ? loginTime.toISOString() : null]
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
          callsThisSession: session.calls_this_session,
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
         END AS history_group
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
