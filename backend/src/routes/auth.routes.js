const express = require("express");

const {
  login,
  register,
  getProfile,
} = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.get("/me", authMiddleware, getProfile);

module.exports = router;
