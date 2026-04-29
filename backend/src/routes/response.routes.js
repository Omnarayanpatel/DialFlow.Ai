const express = require("express");

const {
  createResponse,
  exportResponses,
  getResponses,
} = require("../controllers/response.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", authMiddleware, getResponses);
router.get("/export", authMiddleware, exportResponses);
router.post("/", authMiddleware, createResponse);

module.exports = router;
