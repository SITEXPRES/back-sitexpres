import express from "express";
import { register, login, resetpasswd, confirmResetPassword, verifyToken } from "../controllers/authController.js";
import pool from "../config/db.js";
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/reset-password", resetpasswd)
router.post("/confirm_pass", confirmResetPassword);
router.get('/verify', verifyToken);
router.get("/health", async (_, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});


export default router;
