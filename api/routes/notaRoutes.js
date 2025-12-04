import express from "express";
import { gerarNF } from "../controllers/notafiscalController.js";

const routes = express.Router();

// ROTA POST
routes.post("/nfse/gerar", gerarNF);

// Teste GET
routes.get("/teste", (req, res) => res.send("rota ok"));

export default routes;
