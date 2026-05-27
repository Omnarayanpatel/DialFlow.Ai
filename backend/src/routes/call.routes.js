const express = require("express");

const {
  updateAgentResponse,
} = require("../controllers/response.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.put("/:id/edit", authMiddleware, updateAgentResponse);

module.exports = router;
