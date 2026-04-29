const { query } = require("../config/db");

const getAgentDashboard = async (req, res, next) => {
  try {
    const statsResult = await query(
      `SELECT
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE LOWER(call_status) = 'not connected')::int AS pending_forms,
        COUNT(*) FILTER (WHERE LOWER(call_status) <> 'not connected')::int AS completed_forms
       FROM responses
       WHERE employee_id = $1
         AND created_at::date = CURRENT_DATE`,
      [req.user.employeeId || ""]
    );

    const summary = statsResult.rows[0] || {
      total_calls: 0,
      pending_forms: 0,
      completed_forms: 0,
    };

    res.status(200).json({
      success: true,
      message: "Agent dashboard data fetched",
      data: {
        summary: {
          totalCalls: summary.total_calls,
          pendingForms: summary.pending_forms,
          completedForms: summary.completed_forms,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAgentHistory = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
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
       FROM responses
       WHERE employee_id = $1
       ORDER BY created_at DESC`,
      [req.user.employeeId || ""]
    );

    res.status(200).json({
      success: true,
      message: "Agent history fetched",
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAgentDashboard,
  getAgentHistory,
};
