const express = require("express");

const {
  createAdmin,
  createAuditLog,
  deleteAdmin,
  forceLogoutAdmin,
  getAuditLogs,
  getAdmins,
  updateAdmin,
} = require("../controllers/superAdmin.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireSuperAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/status", authMiddleware, requireSuperAdmin, (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Super admin access granted",
  });
});
router.get("/admins", authMiddleware, requireSuperAdmin, getAdmins);
router.post("/admins", authMiddleware, requireSuperAdmin, createAdmin);
router.put("/admins/:id", authMiddleware, requireSuperAdmin, updateAdmin);
router.delete("/admins/:id", authMiddleware, requireSuperAdmin, deleteAdmin);
router.post("/admins/:id/logout", authMiddleware, requireSuperAdmin, forceLogoutAdmin);
router.get("/audit-logs", authMiddleware, requireSuperAdmin, getAuditLogs);
router.post("/audit-logs", authMiddleware, requireSuperAdmin, createAuditLog);

module.exports = router;
