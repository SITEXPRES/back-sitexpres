import express from "express";
import { 
  create_domain_reseller,
  check_domain_availability,
  create_customer_reseller,
  get_domain_details,
  renew_domain_reseller,
  modify_nameservers,
  create_contact_reseller_controller
} from "../controllers/resellerController.js";

const router = express.Router();

// Rota de teste
router.get("/teste", (req, res) => res.send("rota RESELLER ok"));

// ============== ROTAS DE DOMÍNIOS ==============

// Verifica disponibilidade de domínios
router.post('/domains/check-availability',  check_domain_availability);

// Registra/cria um novo domínio
router.post('/domains/register',  create_domain_reseller);

// Obtém detalhes de um domínio específico
router.get('/domains/:domainName', get_domain_details);

// Renova um domínio
router.post('/domains/renew' , renew_domain_reseller);

// Modifica nameservers de um domínio
router.put('/domains/nameservers',  modify_nameservers);
// ============== ROTAS DE CLIENTES ==============

// Cria um novo cliente na ResellerClub
router.post('/customers/register',  create_customer_reseller);

router.post('/create-contact', create_contact_reseller_controller);

export default router;