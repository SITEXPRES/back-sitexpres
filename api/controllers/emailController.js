import axios from 'axios';
import pool from '../config/db.js';
/**
 * Configuração do DirectAdmin (servidor padrão)
 */
const directAdminUrl = `https://${process.env.host_directadmin || 'srv3br.com.br'}:2222`;

/**
 * Configuração base para requisições ao DirectAdmin
 * Agora aceita credenciais dinâmicas do cliente
 */
const getAuthConfig = (username, password) => {
  return {
    auth: {
      username: username,
      password: password
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
};

/**
 * Criar nova conta de e-mail
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
export const createEmail = async (req, res) => {
  try {
    const { email, password, quota = 100, userhospedagem, passhospedagem, sendLimit = 200, id_user } = req.body;

    // Validações
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'E-mail e senha são obrigatórios'
      });
    }

    if (!userhospedagem || !passhospedagem) {
      return res.status(400).json({
        success: false,
        message: 'Credenciais da hospedagem (userhospedagem e passhospedagem) são obrigatórias'
      });
    }

    // Separar usuário e domínio
    const [user, domain] = email.split('@');

    if (!user || !domain) {
      return res.status(400).json({
        success: false,
        message: 'Formato de e-mail inválido'
      });
    }

    // Preparar dados para envio
    const params = new URLSearchParams({
      action: 'create',
      domain: domain,
      user: user,
      passwd: password,
      passwd2: password,
      quota: quota, // Quota em MB
      limit: sendLimit // Limite de envios por hora
    });

    // Fazer requisição ao DirectAdmin usando as credenciais do cliente
    const response = await axios.post(
      `${directAdminUrl}/CMD_API_POP`,
      params.toString(),
      getAuthConfig(userhospedagem, passhospedagem)
    );

    // Verificar resposta
    if (response.data.includes('error=1')) {
      const errorMatch = response.data.match(/details=([^&]+)/);
      const errorMsg = errorMatch ? decodeURIComponent(errorMatch[1]) : 'Erro ao criar e-mail';

      return res.status(400).json({
        success: false,
        message: errorMsg
      });
    }

    // Salvando no banco de dados após criar no DirectAdmin
    try {
      const sql = `
        INSERT INTO emails (email, "user", domain, password, quota, send_limit, userhospedagem, status,id_user) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'active',$8)
        RETURNING id
      `;

      const result = await pool.query(sql, [
        email,
        user,
        domain,
        password,
        quota,
        sendLimit,
        userhospedagem,
        id_user
      ]);

      console.log('✅ E-mail salvo no banco de dados, ID:', result.rows[0].id);

    } catch (dbError) {
      console.error('⚠️ Erro ao salvar no banco de dados:', dbError.message);
      // Email foi criado no DirectAdmin mas não foi salvo no DB
      // Você pode decidir se quer reverter a criação ou apenas logar o erro
    }

    return res.status(201).json({
      success: true,
      message: 'E-mail criado com sucesso',
      data: {
        email: email,
        quota: quota,
        sendLimit: sendLimit
      }
    });

  } catch (error) {
    console.error('Erro ao criar e-mail:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao criar e-mail',
      error: error.message
    });
  }
};

/**
 * Alterar senha de uma conta de e-mail
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
export const changePassword = async (req, res) => {
  try {
    const { email, newPassword, userhospedagem, passhospedagem } = req.body;

    // Validações
    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'E-mail e nova senha são obrigatórios'
      });
    }

    if (!userhospedagem || !passhospedagem) {
      return res.status(400).json({
        success: false,
        message: 'Credenciais da hospedagem (userhospedagem e passhospedagem) são obrigatórias'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A senha deve ter no mínimo 6 caracteres'
      });
    }

    // Separar usuário e domínio
    const [user, domain] = email.split('@');

    if (!user || !domain) {
      return res.status(400).json({
        success: false,
        message: 'Formato de e-mail inválido'
      });
    }

    // Preparar dados para envio
    const params = new URLSearchParams({
      action: 'modify',
      domain: domain,
      user: user,
      passwd: newPassword,
      passwd2: newPassword
    });

    // Fazer requisição ao DirectAdmin usando as credenciais do cliente
    const response = await axios.post(
      `${directAdminUrl}/CMD_API_POP`,
      params.toString(),
      getAuthConfig(userhospedagem, passhospedagem)
    );

    // Verificar resposta
    if (response.data.includes('error=1')) {
      const errorMatch = response.data.match(/details=([^&]+)/);
      const errorMsg = errorMatch ? decodeURIComponent(errorMatch[1]) : 'Erro ao alterar senha';

      return res.status(400).json({
        success: false,
        message: errorMsg
      });
    }

    // Atualizar senha no banco de dados
    try {
      const sql = `UPDATE emails SET password = $1, updated_at = NOW() WHERE email = $2`;
      await pool.query(sql, [newPassword, email]);
      console.log('✅ Senha atualizada no banco de dados');
    } catch (dbError) {
      console.error('⚠️ Erro ao atualizar senha no banco:', dbError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Senha alterada com sucesso',
      data: {
        email: email
      }
    });

  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao alterar senha',
      error: error.message
    });
  }
};

/**
 * Remover conta de e-mail
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
export const deleteEmail = async (req, res) => {
  try {
    const { email, userhospedagem, passhospedagem, id_user } = req.body;

    // Validação
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'E-mail é obrigatório'
      });
    }

    if (!userhospedagem || !passhospedagem) {
      return res.status(400).json({
        success: false,
        message: 'Credenciais da hospedagem (userhospedagem e passhospedagem) são obrigatórias'
      });
    }

    // Separar usuário e domínio
    const [user, domain] = email.split('@');

    if (!user || !domain) {
      return res.status(400).json({
        success: false,
        message: 'Formato de e-mail inválido'
      });
    }

    // Preparar dados para envio
    const params = new URLSearchParams({
      action: 'delete',
      domain: domain,
      user: user
    });

    // Fazer requisição ao DirectAdmin usando as credenciais do cliente
    const response = await axios.post(
      `${directAdminUrl}/CMD_API_POP`,
      params.toString(),
      getAuthConfig(userhospedagem, passhospedagem)
    );

    // Verificar resposta
    if (response.data.includes('error=1')) {
      const errorMatch = response.data.match(/details=([^&]+)/);
      const errorMsg = errorMatch ? decodeURIComponent(errorMatch[1]) : 'Erro ao remover e-mail';

      return res.status(400).json({
        success: false,
        message: errorMsg
      });
    }

    //Apagando do banco de dados
    try {
      const sql = `DELETE FROM emails WHERE email = $1 AND id_user = $2`;
      await pool.query(sql, [email, id_user]);
      console.log('✅ E-mail apagado do banco de dados');
    } catch (dbError) {
      console.error('⚠️ Erro ao apagar e-mail do banco:', dbError.message);
    }



    return res.status(200).json({
      success: true,
      message: 'E-mail removido com sucesso',
      data: {
        email: email
      }
    });

  } catch (error) {
    console.error('Erro ao remover e-mail:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao remover e-mail',
      error: error.message
    });
  }
};

/**
 * Listar todas as contas de e-mail de um domínio
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
export const listEmails = async (req, res) => {
  try {
    const { domain, userhospedagem, passhospedagem } = req.query;

    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domínio é obrigatório'
      });
    }

    if (!userhospedagem || !passhospedagem) {
      return res.status(400).json({
        success: false,
        message: 'Credenciais da hospedagem (userhospedagem e passhospedagem) são obrigatórias'
      });
    }

    const params = new URLSearchParams({
      action: 'list',
      domain: domain
    });

    // Fazer requisição ao DirectAdmin usando as credenciais do cliente
    const response = await axios.post(
      `${directAdminUrl}/CMD_API_POP`,
      params.toString(),
      getAuthConfig(userhospedagem, passhospedagem)
    );

    // Parse da resposta
    const emails = [];
    const lines = response.data.split('\n');

    for (const line of lines) {
      if (line.includes('=')) {
        const [user, details] = line.split('=');
        if (user && details) {
          emails.push({
            email: `${user}@${domain}`,
            user: user
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        domain: domain,
        emails: emails,
        total: emails.length
      }
    });

  } catch (error) {
    console.error('Erro ao listar e-mails:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao listar e-mails',
      error: error.message
    });
  }
};

/**
 * Obter informações de uma conta de e-mail
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
export const getEmailInfo = async (req, res) => {
  try {
    const { email, userhospedagem, passhospedagem } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'E-mail é obrigatório'
      });
    }

    if (!userhospedagem || !passhospedagem) {
      return res.status(400).json({
        success: false,
        message: 'Credenciais da hospedagem (userhospedagem e passhospedagem) são obrigatórias'
      });
    }

    const [user, domain] = email.split('@');

    if (!user || !domain) {
      return res.status(400).json({
        success: false,
        message: 'Formato de e-mail inválido'
      });
    }

    const params = new URLSearchParams({
      action: 'list',
      domain: domain
    });

    // Fazer requisição ao DirectAdmin usando as credenciais do cliente
    const response = await axios.post(
      `${directAdminUrl}/CMD_API_POP`,
      params.toString(),
      getAuthConfig(userhospedagem, passhospedagem)
    );

    // Procurar informações do e-mail específico
    const lines = response.data.split('\n');
    let emailInfo = null;

    for (const line of lines) {
      if (line.startsWith(user + '=')) {
        const details = line.split('=')[1];
        emailInfo = {
          email: email,
          user: user,
          domain: domain,
          exists: true
        };
        break;
      }
    }

    if (!emailInfo) {
      return res.status(404).json({
        success: false,
        message: 'E-mail não encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      data: emailInfo
    });

  } catch (error) {
    console.error('Erro ao obter informações do e-mail:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao obter informações',
      error: error.message
    });
  }
};


export const list_db = async (req, res) => {
  try {
    const { id_user } = req.query;

    if (!id_user) {
      return res.status(400).json({
        success: false,
        message: 'id_user é obrigatório'
      });
    }

    const sql = `SELECT * FROM emails WHERE id_user = $1`;
    const result = await pool.query(sql, [id_user]);

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum e-mail encontrado para o usuário'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Erro ao obter informações do e-mail:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao obter informações',
      error: error.message
    });
  }
};
