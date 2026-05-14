const express = require("express");

const {
  getAgentDashboard,
  getAgentHistory,
} = require("../controllers/agent.controller");
const {
  deleteAgent,
  updateAgent,
} = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/dashboard", authMiddleware, getAgentDashboard);
router.get("/history", authMiddleware, getAgentHistory);
router.put("/:id", authMiddleware, updateAgent);
router.delete("/:id", authMiddleware, deleteAgent);

module.exports = router;
