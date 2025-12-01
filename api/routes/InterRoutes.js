import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";
import {
    criarCobranca,
    criarCobrancaUnica
} from '../controllers/InterControllers.js';

const router = express.Router();

router.get("/teste", (req, res) => res.send("rota ok"));

router.post('/pagamento/criar', criarCobranca);

router.post("/pagamento/unico", criarCobrancaUnica);


export default router;