const express = require("express");

const {
  createResponse,
  exportResponses,
  exportTimeReport,
  getResponses,
  getTimeReport,
} = require("../controllers/response.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", authMiddleware, getResponses);
router.get("/export", authMiddleware, exportResponses);
router.get("/time-report", authMiddleware, getTimeReport);
router.get("/time-report/export", authMiddleware, exportTimeReport);
router.post("/", authMiddleware, createResponse);

module.exports = router;
