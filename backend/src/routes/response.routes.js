const express = require("express");

const {
  createResponse,
  exportResponses,
  exportTimeReport,
  getResponses,
  getTimeReport,
} = require("../controllers/response.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", authMiddleware, requireAdmin, getResponses);
router.get("/export", authMiddleware, requireAdmin, exportResponses);
router.get("/time-report", authMiddleware, requireAdmin, getTimeReport);
router.get("/time-report/export", authMiddleware, requireAdmin, exportTimeReport);
router.post("/", authMiddleware, createResponse);

module.exports = router;
