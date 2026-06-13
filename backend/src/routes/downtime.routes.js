const express = require("express");

const {
  approveDowntimeRequest,
  createDowntimeRequest,
  getDowntimeHistory,
  getDowntimeReport,
  getDowntimeRequests,
  getMyCurrentDowntimeRequest,
  getMyDowntimeHistory,
  rejectDowntimeRequest,
  resolveDowntimeRequest,
} = require("../controllers/downtime.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", authMiddleware, createDowntimeRequest);
router.get("/me/current", authMiddleware, getMyCurrentDowntimeRequest);
router.get("/me/history", authMiddleware, getMyDowntimeHistory);
router.get("/", authMiddleware, requireAdmin, getDowntimeRequests);
router.get("/report", authMiddleware, requireAdmin, getDowntimeReport);
router.get("/history", authMiddleware, requireAdmin, getDowntimeHistory);
router.post("/:id/approve", authMiddleware, requireAdmin, approveDowntimeRequest);
router.post("/:id/reject", authMiddleware, requireAdmin, rejectDowntimeRequest);
router.post("/:id/resolve", authMiddleware, resolveDowntimeRequest);

module.exports = router;
