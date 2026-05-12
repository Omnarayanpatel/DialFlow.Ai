const express = require("express");

const {
  login,
  register,
  getProfile,
  updateStatus,
  getAllAgents,
  getAgentMonitoring,
} = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.get("/me", authMiddleware, getProfile);
router.put("/status", authMiddleware, updateStatus);
router.get("/agents", authMiddleware, getAllAgents);
router.get("/agents/monitoring", authMiddleware, getAgentMonitoring);

module.exports = router;
