
import express from 'express';
import { 
  creat_hospedagem,
  listar_hospedagens,
  suspender_hospedagem,
  deletar_hospedagem
} from '../controllers/hospedagemController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Rota de teste
router.get("/teste", (req, res) => res.send("rota hospedagem ok"));

// Criar nova hospedagem
router.post('/creat_hospedage', authMiddleware, creat_hospedagem);

// Listar todas as hospedagens
router.get('/listar', authMiddleware, listar_hospedagens);

// Suspender hospedagem
router.post('/suspender', authMiddleware, suspender_hospedagem);

// Deletar hospedagem
router.delete('/deletar', authMiddleware, deletar_hospedagem);

export default router;