const { query } = require("../config/db");

const normalizePeriod = (period) => {
  if (period === "weekly" || period === "monthly") {
    return period;
  }

  return "today";
};

const buildPeriodWhere = (period) => {
  if (period === "weekly") {
    return "r.created_at >= date_trunc('week', CURRENT_DATE)::timestamp AND r.created_at < (date_trunc('week', CURRENT_DATE) + INTERVAL '1 week')::timestamp";
  }

  if (period === "monthly") {
    return "r.created_at >= date_trunc('month', CURRENT_DATE)::timestamp AND r.created_at < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::timestamp";
  }

  return "r.created_at::date = CURRENT_DATE";
};

const buildDateWhere = ({ period, startDate, endDate }, params) => {
  const conditions = [];

  if (startDate) {
    params.push(startDate);
    conditions.push(`r.created_at >= $${params.length}::date`);
  }

  if (endDate) {
    params.push(endDate);
    conditions.push(`r.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  return conditions.length ? conditions.join(" AND ") : buildPeriodWhere(period);
};

const leaderboardSql = ({ period, startDate, endDate }, params) => `
  WITH response_metrics AS (
    SELECT
      r.employee_id,
      COUNT(*)::int AS total_calls,
      COUNT(*) FILTER (WHERE LOWER(r.call_status) = 'connected')::int AS connected_calls,
      COUNT(*) FILTER (WHERE LOWER(r.disposition) IN ('positive', 'already positive'))::int AS positive_calls
    FROM responses r
    WHERE ${buildDateWhere({ period, startDate, endDate }, params)}
    GROUP BY r.employee_id
  ),
  session_status AS (
    SELECT
      user_id,
      BOOL_OR(logout_time IS NULL AND LOWER(status) = 'online') AS has_online_session,
      BOOL_OR(logout_time IS NULL AND LOWER(status) IN ('break', 'on break')) AS has_break_session
    FROM agent_sessions
    GROUP BY user_id
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          ((COALESCE(rm.positive_calls, 0) * 5) + (COALESCE(rm.connected_calls, 0) * 3) + (COALESCE(rm.total_calls, 0) * 2)) DESC,
          COALESCE(rm.positive_calls, 0) DESC,
          COALESCE(rm.connected_calls, 0) DESC,
          COALESCE(rm.total_calls, 0) DESC,
          u.name ASC
      )::int AS rank,
      u.id AS agent_id,
      u.name AS agent_name,
      u.employee_id,
      COALESCE(rm.total_calls, 0)::int AS total_calls,
      COALESCE(rm.connected_calls, 0)::int AS connected_calls,
      COALESCE(rm.positive_calls, 0)::int AS positive_calls,
      CASE
        WHEN COALESCE(rm.connected_calls, 0) = 0 THEN 0
        ELSE ROUND((COALESCE(rm.positive_calls, 0)::numeric / rm.connected_calls::numeric) * 100, 2)
      END AS conversion_rate,
      ((COALESCE(rm.positive_calls, 0) * 5) + (COALESCE(rm.connected_calls, 0) * 3) + (COALESCE(rm.total_calls, 0) * 2))::int AS ranking_score,
      CASE
        WHEN COALESCE(ss.has_online_session, false) THEN 'online'
        WHEN COALESCE(ss.has_break_session, false) THEN 'break'
        ELSE 'offline'
      END AS current_status
    FROM users u
    LEFT JOIN response_metrics rm ON rm.employee_id = u.employee_id
    LEFT JOIN session_status ss ON ss.user_id = u.id
    WHERE u.role = 'agent'
  )
  SELECT *
  FROM ranked
`;

const mapLeaderboardRows = (rows) =>
  rows.map((row) => ({
    rank: row.rank,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    employee_id: row.employee_id,
    total_calls: row.total_calls,
    connected_calls: row.connected_calls,
    positive_calls: row.positive_calls,
    conversion_rate: Number(row.conversion_rate || 0),
    ranking_score: row.ranking_score,
    current_status: row.current_status,
  }));

const getAdminLeaderboard = async (req, res, next) => {
  try {
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const period = normalizePeriod(req.query.period);
    const startDate = String(req.query.startDate || "").trim();
    const endDate = String(req.query.endDate || "").trim();
    const agentId = String(req.query.agentId || "").trim();
    const search = String(req.query.search || "").trim();
    const params = [];
    const filters = [];

    if (search) {
      params.push(`%${search}%`);
      filters.push(`(agent_name ILIKE $${params.length} OR employee_id ILIKE $${params.length})`);
    }

    if (agentId && agentId !== "all") {
      params.push(agentId);
      filters.push(`(agent_id::text = $${params.length} OR employee_id = $${params.length})`);
    }

    const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await query(
      `${leaderboardSql({ period, startDate, endDate }, params)}
       ${whereSql}
       ORDER BY
         ranking_score DESC,
         positive_calls DESC,
         connected_calls DESC,
         total_calls DESC,
         agent_name ASC`,
      params
    );

    res.status(200).json({
      success: true,
      message: "Admin leaderboard fetched",
      data: {
        period,
        leaderboard: mapLeaderboardRows(result.rows),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAgentRanking = async (req, res, next) => {
  try {
    const period = normalizePeriod(req.query.period);
    const params = [];
    const result = await query(
      `${leaderboardSql({ period }, params)}
       ORDER BY
         ranking_score DESC,
         positive_calls DESC,
         connected_calls DESC,
         total_calls DESC,
         agent_name ASC`
    );

    const leaderboard = mapLeaderboardRows(result.rows);
    const currentAgent = leaderboard.find((agent) => agent.employee_id === req.user.employeeId);
    const nextAgent = currentAgent ? leaderboard.find((agent) => agent.rank === currentAgent.rank - 1) : null;
    const nextRankScoreGap = nextAgent
      ? Math.max(nextAgent.ranking_score - currentAgent.ranking_score, 0)
      : 0;

    res.status(200).json({
      success: true,
      message: "Agent ranking fetched",
      data: {
        period,
        current_rank: currentAgent?.rank || null,
        ranking_score: currentAgent?.ranking_score || 0,
        next_rank_score_gap: nextRankScoreGap,
        top_3_agents: leaderboard.slice(0, 3),
        top_10_agents: leaderboard.slice(0, 10),
        current_agent: currentAgent || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminLeaderboard,
  getAgentRanking,
};
