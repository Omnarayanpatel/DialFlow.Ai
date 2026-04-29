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

    const result = await query(
      `SELECT ${RESPONSE_SELECT}
       FROM responses
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      message: "Responses fetched successfully",
      data: result.rows,
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
