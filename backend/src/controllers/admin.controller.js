const { withTransaction } = require("../config/db");

const closeActiveAgentSessionsSql = `
  UPDATE agent_sessions
  SET
    status = 'offline',
    logout_time = CURRENT_TIMESTAMP,
    total_break_duration = total_break_duration + CASE
      WHEN break_start_time IS NULL THEN 0
      ELSE GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0)
    END,
    break_end_time = CASE WHEN break_start_time IS NULL THEN break_end_time ELSE CURRENT_TIMESTAMP END,
    break_start_time = NULL,
    updated_at = CURRENT_TIMESTAMP
`;

const requireAdmin = (req, res) => {
  if (req.user.role !== "admin") {
    res.status(403).json({ success: false, message: "Admin access required" });
    return false;
  }

  return true;
};

const forceLogoutAgent = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const agentId = Number.parseInt(req.params.agentId, 10);

    if (!Number.isFinite(agentId)) {
      return res.status(400).json({ success: false, message: "Valid agent id is required" });
    }

    if (agentId === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot force logout yourself" });
    }

    const result = await withTransaction(async (client) => {
      const agentResult = await client.query(
        "SELECT id, name, role FROM users WHERE id = $1 LIMIT 1",
        [agentId]
      );
      const agent = agentResult.rows[0];

      if (!agent) {
        const error = new Error("Agent not found");
        error.statusCode = 404;
        throw error;
      }

      if (agent.role !== "agent") {
        const error = new Error("Only agent accounts can be force logged out");
        error.statusCode = 400;
        throw error;
      }

      const sessionResult = await client.query(
        `${closeActiveAgentSessionsSql}
         WHERE user_id = $1 AND logout_time IS NULL
         RETURNING id`,
        [agentId]
      );

      await client.query(
        `UPDATE agent_breaks
         SET
           break_end_time = CURRENT_TIMESTAMP,
           total_break_duration = GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0),
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND break_end_time IS NULL`,
        [agentId]
      );

      await client.query(
        "UPDATE users SET status = 'offline', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND role = 'agent'",
        [agentId]
      );

      return {
        agent,
        closedSessions: sessionResult.rowCount,
      };
    });

    res.status(200).json({
      success: true,
      message: `${result.agent.name} logged out successfully`,
      data: {
        agentId,
        closedSessions: result.closedSessions,
      },
    });
  } catch (error) {
    next(error);
  }
};

const forceLogoutAllAgents = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const result = await withTransaction(async (client) => {
      const sessionResult = await client.query(
        `${closeActiveAgentSessionsSql}
         WHERE user_id IN (SELECT id FROM users WHERE role = 'agent')
           AND logout_time IS NULL
         RETURNING id, user_id`
      );

      await client.query(
        `UPDATE agent_breaks
         SET
           break_end_time = CURRENT_TIMESTAMP,
           total_break_duration = GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start_time))::int, 0),
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id IN (SELECT id FROM users WHERE role = 'agent')
           AND break_end_time IS NULL`
      );

      await client.query(
        "UPDATE users SET status = 'offline', updated_at = CURRENT_TIMESTAMP WHERE role = 'agent'"
      );

      return {
        closedSessions: sessionResult.rowCount,
        affectedAgents: new Set(sessionResult.rows.map((row) => row.user_id)).size,
      };
    });

    res.status(200).json({
      success: true,
      message: "All active agents logged out successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  forceLogoutAgent,
  forceLogoutAllAgents,
};
