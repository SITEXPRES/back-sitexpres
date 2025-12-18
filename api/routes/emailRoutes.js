import express from 'express';
import { 
  createEmail, 
  changePassword, 
  deleteEmail, 
  listEmails, 
  getEmailInfo,
  list_db  
} from '../controllers/emailController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
const router = express.Router();
import pool from "../config/db.js";

// Rota de teste
router.get("/teste", (req, res) => res.send("rota email ok"));

/**
 * @route   POST /api/email/create
 * @desc    Criar nova conta de e-mail
 * @access  Private
 * @body    { email, password, quota }
 */
router.post('/create', authMiddleware, createEmail);

/**
 * @route   PUT /api/email/change-password
 * @desc    Alterar senha de conta de e-mail
 * @access  Private
 * @body    { email, newPassword }
 */
router.put('/change-password', authMiddleware, changePassword);

/**
 * @route   DELETE /api/email/delete
 * @desc    Remover conta de e-mail
 * @access  Private
 * @body    { email }
 */
router.delete('/delete', authMiddleware, deleteEmail);

/**
 * @route   GET /api/email/list
 * @desc    Listar todas contas de e-mail de um domínio
 * @access  Private
 * @query   domain
 */
router.get('/list', authMiddleware, listEmails);
router.get('/list_db', list_db);

/**
 * @route   GET /api/email/info
 * @desc    Obter informações de uma conta
 * @access  Private
 * @query   email
 */
router.get('/info', authMiddleware, getEmailInfo);

export default router;