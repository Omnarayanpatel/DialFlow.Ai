const express = require("express");

const {
  approveDowntimeRequest,
  createDowntimeRequest,
  getDowntimeReport,
  getDowntimeRequests,
  getMyCurrentDowntimeRequest,
  rejectDowntimeRequest,
  resolveDowntimeRequest,
} = require("../controllers/downtime.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", authMiddleware, createDowntimeRequest);
router.get("/me/current", authMiddleware, getMyCurrentDowntimeRequest);
router.get("/", authMiddleware, requireAdmin, getDowntimeRequests);
router.get("/report", authMiddleware, requireAdmin, getDowntimeReport);
router.post("/:id/approve", authMiddleware, requireAdmin, approveDowntimeRequest);
router.post("/:id/reject", authMiddleware, requireAdmin, rejectDowntimeRequest);
router.post("/:id/resolve", authMiddleware, requireAdmin, resolveDowntimeRequest);

module.exports = router;
