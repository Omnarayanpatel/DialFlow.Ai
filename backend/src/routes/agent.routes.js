const express = require("express");

const {
  getAgentDashboard,
  getAgentHistory,
} = require("../controllers/agent.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/dashboard", authMiddleware, getAgentDashboard);
router.get("/history", authMiddleware, getAgentHistory);

module.exports = router;
