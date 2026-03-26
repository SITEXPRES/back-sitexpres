import express from "express";
import { 
    registerAffiliate, 
    getAffiliateStats, 
    requestWithdrawal, 
    trackClick, 
    getReferrals,
    getMyWithdrawals
} from "../controllers/affiliateController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// 🔓 Rota pública para rastrear cliques
router.post("/track/:code", trackClick);

// 🔒 Rotas protegidas (exigem login)
router.post("/register", authMiddleware, registerAffiliate); // Credenciamento
router.get("/stats", authMiddleware, getAffiliateStats);     // Dashboard
router.get("/referrals", authMiddleware, getReferrals);      // Lista de indicados
router.get("/my-withdrawals", authMiddleware, getMyWithdrawals); // Lista próprios saques
router.post("/withdraw", authMiddleware, requestWithdrawal); // Pedir saque

export default router;
