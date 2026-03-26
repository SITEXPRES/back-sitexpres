import express from "express";
import { getApiCheck, getInfo_dom } from "../controllers/adminController.js";
import { 
    getAllWithdrawals, 
    getPendingCount, 
    updateWithdrawalStatus 
} from "../controllers/affiliateAdminController.js";

const router = express.Router();

router.get("/teste", (req, res) => res.send("rota admin ok"));

router.get('/check/api', getApiCheck);
router.get('/info_dominio', getInfo_dom);

// 💰 Rotas de Gestão de Afiliados (Saques)
router.get('/affiliate/withdrawals', getAllWithdrawals);
router.get('/affiliate/withdrawals/pending-count', getPendingCount);
router.put('/affiliate/withdrawals/:id', updateWithdrawalStatus);

export default router;
