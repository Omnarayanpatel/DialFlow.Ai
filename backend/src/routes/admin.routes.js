const express = require("express");

const {
  forceLogoutAgent,
  forceLogoutAllAgents,
} = require("../controllers/admin.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/force-logout/:agentId", authMiddleware, requireAdmin, forceLogoutAgent);
router.post("/force-logout-all", authMiddleware, requireAdmin, forceLogoutAllAgents);

module.exports = router;
