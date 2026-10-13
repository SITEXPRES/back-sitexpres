import { executarFluxoPromax } from "../services/promaxOrchestratorService.js";

/**
 * Controller para geração e deploy automático de aplicações Promax (CRM, SaaS, Fullstack)
 */
export async function gerarPromaxController(req, res) {
  try {
    const { prompt, id_projeto, mockCode } = req.body;
    const userId = req.user?.id || 1;

    if (!prompt && !mockCode) {
      return res.status(400).json({
        success: false,
        message: "O prompt do projeto é obrigatório."
      });
    }

    console.log(`[PROMAX_CONTROLLER] 🚀 Nova solicitação Promax recebida | User: ${userId} | Projeto: ${id_projeto || 'novo'}`);

    const resultado = await executarFluxoPromax({
      prompt,
      id_projeto: id_projeto || `proj_${Date.now()}`,
      userId,
      mockCode: mockCode || null
    });

    return res.json({
      success: true,
      message: "Aplicação e Banco de Dados provisionados com sucesso na VPS!",
      data: resultado
    });
  } catch (error) {
    console.error("[PROMAX_CONTROLLER] ❌ Erro ao orquestrar aplicação Promax:", error);
    return res.status(500).json({
      success: false,
      message: `Erro na orquestração Promax: ${error.message}`
    });
  }
}
