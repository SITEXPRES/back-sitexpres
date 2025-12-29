import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";
import {
    criarCobranca,
    criarCobrancaUnica,
    criarTokenAvuso,
    ReceberRetorno,
    cadastrarWebhookInter,
    listarWebhookInter,
    consultarPix,
    pagamentoDominio,
    consultarPix_dominio
} from '../controllers/InterControllers.js';

const router = express.Router();

router.get("/teste", (req, res) => res.send("rota ok"));

router.post('/pagamento/criar', criarCobranca);

router.post("/pagamento/unico", criarCobrancaUnica);

router.post("/pagamento/dominio", pagamentoDominio);

router.get("/pagamento/tokenAvuso", criarTokenAvuso);

router.post("/pagamento/retorno", ReceberRetorno);

router.post("/pagamento/webhook", cadastrarWebhookInter);

router.get("/pagamento/webhook", listarWebhookInter);

router.post("/pagamento/consultar", consultarPix);

router.post("/pagamento/consultar_dominio", consultarPix_dominio);


export default router;