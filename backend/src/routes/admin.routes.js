const express = require("express");

const {
  forceLogoutAgent,
  forceLogoutAllAgents,
} = require("../controllers/admin.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/force-logout/:agentId", authMiddleware, forceLogoutAgent);
router.post("/force-logout-all", authMiddleware, forceLogoutAllAgents);

module.exports = router;
