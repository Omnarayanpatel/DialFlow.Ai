const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { query } = require("../config/db");

const buildToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      employeeId: user.employee_id,
      zohoId: user.zoho_id,
      name: user.name,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  employeeId: user.employee_id,
  zohoId: user.zoho_id,
  role: user.role,
  status: user.status,
  createdAt: user.created_at,
});

const login = async (req, res, next) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and password are required",
      });
    }

    const result = await query(
      "SELECT id, name, password, employee_id, zoho_id, role, created_at FROM users WHERE employee_id = $1 LIMIT 1",
      [employeeId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid Employee ID or password",
      });
    }

    const passwordMatched = await bcrypt.compare(password, user.password);

    if (!passwordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid Employee ID or password",
      });
    }

    // Set user status to Online upon login
    await query(
      "UPDATE users SET status = 'Online' WHERE id = $1",
      [user.id]
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: sanitizeUser(user),
        token: buildToken(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const { name, employeeId, password, role, adminCode } = req.body;

    if (!name || !employeeId || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, Employee ID, and password are required", 
      });
    }

    if (role === "admin") {
      const adminSecret = process.env.ADMIN_SECRET || "D_AI_AVY_2026";

      if (adminCode !== adminSecret) {
        return res.status(403).json({
          success: false,
          message: "Invalid Admin passcode.",
        });
      }
    }

    const existingUser = await query(
      "SELECT id FROM users WHERE employee_id = $1 LIMIT 1",
      [employeeId]
    );

    if (existingUser.rows[0]) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this employee ID",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const finalRole = role === "admin" ? "admin" : "agent";

    const createdUser = await query(
      `INSERT INTO users (name, password, employee_id, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, employee_id, zoho_id, role, created_at`,
      [
        name,
        hashedPassword,
        employeeId,
        finalRole,
      ]
    );

    const user = createdUser.rows[0];

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: sanitizeUser(user),
        token: buildToken(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, name, employee_id, zoho_id, role, created_at FROM users WHERE id = $1 LIMIT 1",
      [req.user.id]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    await query(
      "UPDATE users SET status = $1 WHERE id = $2",
      [status, req.user.id]
    );

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
};

const getAllAgents = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const result = await query(
      "SELECT id, name, employee_id, zoho_id, role, status, created_at FROM users WHERE role = 'agent' ORDER BY name ASC"
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  register,
  getProfile,
  updateStatus,
  getAllAgents,
};
