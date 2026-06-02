const jwt = require("jsonwebtoken");

const { query } = require("../config/db");

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await query(
      "SELECT id, role, token_version FROM users WHERE id = $1 LIMIT 1",
      [decoded.id]
    );
    const user = userResult.rows[0];

    const tokenVersion = decoded.token_version ?? decoded.tokenVersion ?? 0;

    if (!user || Number(tokenVersion) !== Number(user.token_version || 0)) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    req.user = decoded;

    next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Super admin access required",
    });
  }

  next();
};

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.requireSuperAdmin = requireSuperAdmin;
