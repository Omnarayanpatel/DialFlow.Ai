const express = require("express");

const {
  getAdminLeaderboard,
  getAgentRanking,
} = require("../controllers/ranking.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/admin", authMiddleware, getAdminLeaderboard);
router.get("/agent", authMiddleware, getAgentRanking);

module.exports = router;
