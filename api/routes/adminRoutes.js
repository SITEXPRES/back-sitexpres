import express from "express";
import { getApiCheck } from "../controllers/adminController.js";

const router = express.Router();


router.get("/teste", (req, res) => res.send("rota admin ok"));

router.get('/check/api', getApiCheck);

export default router;
