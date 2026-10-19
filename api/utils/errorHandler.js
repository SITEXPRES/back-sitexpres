/**
 * Utilitário para detecção e tratamento de erros financeiros de API (Anthropic / IA)
 * e formatação de mensagens amigáveis para o cliente com código #1-fin.
 */

export const CODIGO_ERRO_FINANCEIRO = "#1-fin";
export const MENSAGEM_CLIENTE_FINANCEIRO =
  "Serviço temporariamente indisponível no momento. Por favor, tente novamente em alguns instantes. (#1-fin)";

export function isFinancialError(err) {
  if (!err) return false;
  const msg = (typeof err === "string" ? err : (err.message || "")).toLowerCase();
  const status = err.status || err.statusCode;
  return (
    status === 402 ||
    err.isFinancial === true ||
    msg.includes("credit balance") ||
    msg.includes("balance is too low") ||
    msg.includes("plans & billing") ||
    msg.includes("purchase credits") ||
    msg.includes("insufficient_quota") ||
    msg.includes("insufficient credit") ||
    msg.includes("#1-fin")
  );
}

export function gerarHtmlErroCliente(codigo = CODIGO_ERRO_FINANCEIRO) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Serviço Temporariamente Indisponível</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#090d16] text-white flex items-center justify-center min-h-screen p-6 font-sans">
  <div class="max-w-md w-full bg-white/[0.04] border border-white/10 rounded-2xl p-8 text-center backdrop-blur-xl shadow-2xl">
    <div class="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl">
      ⚡
    </div>
    <h1 class="text-lg font-bold mb-2 text-white">Serviço Temporariamente Indisponível</h1>
    <p class="text-sm text-white/60 mb-6 leading-relaxed">
      Nosso motor de geração está passando por uma rápida sincronização. Por favor, tente novamente em alguns instantes.
    </p>
    <div class="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs text-white/40 font-mono">
      Código: ${codigo}
    </div>
  </div>
</body>
</html>`;
}
