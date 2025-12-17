import express from "express";
import { getApiCheck,getInfo_dom } from "../controllers/adminController.js";

const router = express.Router();


router.get("/teste", (req, res) => res.send("rota admin ok"));

router.get('/check/api', getApiCheck);
router.get('/info_dominio', getInfo_dom);

export default router;
