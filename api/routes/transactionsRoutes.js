import express from "express";
import { transactions_list } from "../controllers/transactionsController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";
const router = express.Router();

router.post("/listagem", authMiddleware, transactions_list);   
router.get("/teste", (req, res) => res.send("rota transactions ok"));
 
export default router;
