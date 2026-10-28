import { useState, useEffect, useRef } from "react";
import { formatCredits } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Download, LogOut, User, Send, Bot, UserCircle, Zap, Plus, FolderOpen, Paperclip, X, ExternalLink, History as HistoryIcon, Crown, AlertTriangle, Wifi, WifiOff, Server, Rocket, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { ProfileModal } from "@/components/ProfileModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";
import logoMobileDark from "@/assets/logo-mobile-dark.png";
import logoMobileLight from "@/assets/logo-mobile-light.png";
import { Badge } from "@/components/ui/badge";
import { VersionHistoryModal } from "@/components/VersionHistoryModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AffiliateModal } from "@/components/AffiliateModal";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sitePreview?: string;
}

const Dashboard = () => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [userData, setUserData] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [siteUrl, setSiteUrl] = useState<string>("");
  const [subdominio, setSubdominio] = useState<string>("");
  const [dnsStatus, setDnsStatus] = useState<'checking' | 'active' | 'inactive'>('inactive');
  const [hasPremiumPlan, setHasPremiumPlan] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [versions, setVersions] = useState<Array<any>>([]);
  const [apiStatus, setApiStatus] = useState<'online' | 'maintenance' | 'checking'>('checking');
  const [hostingDomain, setHostingDomain] = useState<string | null>(null);
  const [hasPendingPrompt, setHasPendingPrompt] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showPromoTicket, setShowPromoTicket] = useState(false);
  const [isAffiliateModalOpen, setIsAffiliateModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme } = useTheme();

  const getProgressText = (percent: number) => {
    if (percent === 0) return "Iniciando processo...";
    if (percent < 15) return "Analisando requisitos...";
    if (percent < 35) return "Processando dados...";
    if (percent < 55) return "Gerando estrutura...";
    if (percent < 75) return "Criando componentes...";
    if (percent < 95) return "Validando código...";
    return "Finalizando ajustes...";
  };

  // Recebe dados do state ao vir do MySites
  const routerLocation = useLocation();
  const navigationState = routerLocation.state as any;

  // Função para carregar histórico de prompts
  const fetchPromptHistory = async (id_projeto: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/sites/list_prompt/${id_projeto}`, {
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.prompts && data.prompts.length > 0) {
          // Ordena por created_at ASC para mostrar do mais antigo ao mais recente
          const sortedPrompts = [...data.prompts].reverse();

          // Armazena versões para o modal
          setVersions(sortedPrompts);

          // Converte prompts para mensagens
          const promptMessages: Message[] = [];
          sortedPrompts.forEach((p: any, index: number) => {
            // Mensagem do usuário (prompt)
            promptMessages.push({
              id: `${p.created_at}-user`,
              role: "user",
              content: p.prompt,
              timestamp: new Date(p.created_at),
            });

            // Mensagem do assistente (resposta)
                      let assistantContent = "";
          if (p.status === 'error' || p.status === 'erro') {
            assistantContent = "❌ Ops! Ocorreu um erro ao processar esta alteração.";
          } else {
            const msgs = [
              "✨ Alteração aplicada com sucesso no seu site!",
              "🚀 Feito! Site atualizado e publicado.",
              "🎨 Design aprimorado conforme o seu pedido!",
              "⚡ Tudo certo! Suas mudanças já estão no ar.",
              "🛠️ Atualização concluída com sucesso!",
              "✅ Modificações geradas e aplicadas perfeitamente."
            ];
            const hashStr = p.created_at ? String(p.created_at) : String(index);
            const hash = hashStr.charCodeAt(hashStr.length - 1) || 0;
            const randomMsg = msgs[hash % msgs.length];
            assistantContent = index === 0 ? "🎉 Uau! Seu site foi gerado e publicado com sucesso!" : randomMsg;
          }
            promptMessages.push({
              id: `${p.created_at}-assistant`,
              role: "assistant",
              content: assistantContent,
              timestamp: new Date(p.created_at),
            });
          });

          setMessages(promptMessages);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar histórico de prompts:", error);
    }
  };

  // Função para buscar subscription do usuário
  const fetchSubscription = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/subscription`, {
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Acessar através de data.subscription
        setHasPremiumPlan(
          data.subscription.plan !== 'free' && data.subscription.is_active
        );

      }
    } catch (error) {
      console.error("Erro ao buscar subscription:", error);
    }
  };

  // Função para gerar ID hexadecimal único
  const generateProjectId = () => {
    return Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  };

  // Função para validar ID com a API
  const generateUniqueProjectId = async (): Promise<string> => {
    const MAX_ATTEMPTS = 20;
    let attempts = 0;

    while (attempts < MAX_ATTEMPTS) {
      const newId = generateProjectId();

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/sites/check_id_projeto/${newId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const isAvailable = await response.json();
          if (isAvailable === true) {
            return newId;
          }
        }
      } catch (error) {
        console.error('Erro ao verificar ID do projeto:', error);
      }

      attempts++;
    }

    // Fallback: retorna um ID gerado mesmo que não tenha conseguido verificar
    return generateProjectId();
  };

  // Estado para modal de usuário bloqueado
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);

  useEffect(() => {
    const loadUser = () => {
      const user = authService.getUser();
      if (user) {
        setUserData(user);
        fetchSubscription();
        if (user.blocked === true) {
          setIsBlockedModalOpen(true);
        }
      }
    };

    loadUser();

    const retryTimeout = setTimeout(() => {
      loadUser();
    }, 1000);

    return () => clearTimeout(retryTimeout);
  }, []);

  useEffect(() => {
    // Se veio do MySites com dados iniciais, carrega eles
    if (navigationState?.initialHtml) {
      setPreviewHtml(navigationState.initialHtml);
      if (navigationState.projectId) {
        setProjectId(navigationState.projectId);
        localStorage.setItem('current_project_id', navigationState.projectId);

        // Carrega o histórico de prompts do projeto
        fetchPromptHistory(navigationState.projectId);
      }
      if (navigationState.subdominio) {
        setSubdominio(navigationState.subdominio);
        setSiteUrl(`https://${navigationState.subdominio}.sitexpres.com.br`);
      }
    } else {
      // Tenta restaurar projeto do localStorage (ex: F5/refresh)
      const savedProjectId = localStorage.getItem('current_project_id');
      const savedPreview = localStorage.getItem('current_project_preview');
      const savedMessages = localStorage.getItem('current_project_messages');

      if (savedProjectId) {
        setProjectId(savedProjectId);
        if (savedPreview) {
          setPreviewHtml(savedPreview);
        }
        if (savedMessages) {
          try {
            const parsedMessages = JSON.parse(savedMessages);
            const hydratedMessages = parsedMessages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp)
            }));
            setMessages(hydratedMessages);
          } catch (e) {
            console.error('Erro ao restaurar mensagens:', e);
          }
        }
        // Recarrega histórico de prompts do projeto restaurado
        fetchPromptHistory(savedProjectId);
      }
      // Se não há nada salvo, mantém estado vazio (novo projeto)
    }
  }, []);

  // Detecta pending_prompt do localStorage e preenche o campo
  useEffect(() => {
    const pendingPrompt = localStorage.getItem("pending_prompt");
    if (pendingPrompt && !projectId) {
      setPrompt(pendingPrompt);
      setHasPendingPrompt(true);
      // Remove do localStorage após usar
      localStorage.removeItem("pending_prompt");
    }
  }, [projectId]);

  // Salva as mensagens sempre que mudarem
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('current_project_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Salva o preview HTML sempre que mudar
  useEffect(() => {
    if (previewHtml) {
      localStorage.setItem('current_project_preview', previewHtml);
    }
  }, [previewHtml]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Polling para verificar status da API a cada 10 segundos
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/check/api`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setApiStatus(data.maintenance_mode === true ? 'maintenance' : 'online');
        } else {
          setApiStatus('online'); // Assume online se não conseguir verificar
        }
      } catch (error) {
        console.error('Erro ao verificar status da API:', error);
        setApiStatus('online'); // Assume online em caso de erro
      }
    };

    // Verifica imediatamente
    checkApiStatus();

    // Continua verificando a cada 5 segundos
    const interval = setInterval(checkApiStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  // Consulta o domínio quando o site é gerado pela primeira vez
  useEffect(() => {
    const fetchDomain = async () => {
      if (previewHtml && projectId && !siteUrl) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/sites/get_dominio/${projectId}`, {
            headers: {
              ...authService.getAuthHeader(),
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.url && data.subdominio) {
              setSiteUrl(data.url);
              setSubdominio(data.subdominio);
              setDnsStatus('checking');
            }
          }
        } catch (error) {
          console.error("Erro ao buscar domínio:", error);
        }
      }
    };

    fetchDomain();
  }, [previewHtml, projectId, siteUrl]);

  // Busca hospedagem existente quando o projeto é carregado
  useEffect(() => {
    const fetchHostingDomain = async () => {
      const user = authService.getUser();
      if (!projectId || !user) return;

      try {
        const params = new URLSearchParams({
          id_user: user.id,
          id_projeto: projectId
        });
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/hospedagem/listar_unica?${params}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              ...authService.getAuthHeader(),
            },
          }
        );

        const data = await response.json();
        if (data.qtd === true && data.url) {
          setHostingDomain(data.url);
        } else {
          setHostingDomain(null);
        }
      } catch (error) {
        console.error("Erro ao buscar hospedagem:", error);
        setHostingDomain(null);
      }
    };

    fetchHostingDomain();
  }, [projectId]);

  // Polling para verificar se o DNS propagou
  useEffect(() => {
    if (!siteUrl || dnsStatus === 'active') return;

    const checkDNS = async () => {
      try {
        const response = await fetch(siteUrl, {
          method: 'HEAD',
          mode: 'no-cors', // Para evitar erros CORS
        });

        // Se chegou aqui sem erro, considera que o DNS propagou
        setDnsStatus('active');
        toast({
          title: "Site publicado!",
          description: "Seu site já está acessível no domínio.",
        });
      } catch (error) {
        // DNS ainda não propagou
        setDnsStatus('checking');
      }
    };

    // Verifica imediatamente
    checkDNS();

    // Continua verificando a cada 30 segundos
    const interval = setInterval(checkDNS, 30000);

    return () => clearInterval(interval);
  }, [siteUrl, dnsStatus]);

  const handleGenerate = async () => {
    // Verifica se o usuário está bloqueado
    if (userData?.blocked === true) {
      setIsBlockedModalOpen(true);
      return;
    }

    // Verifica se a API está em manutenção
    if (apiStatus === 'maintenance') {
      toast({
        title: "Sistema em Manutenção",
        description: "O sistema está temporariamente em manutenção. Tente novamente em alguns minutos.",
        variant: "destructive",
      });
      return;
    }

    // Verifica status da API antes de prosseguir
    try {
      const maintenanceCheck = await fetch(`${import.meta.env.VITE_API_URL}/admin/check/api`);
      const maintenanceData = await maintenanceCheck.json();
      if (maintenanceData.maintenance_mode === true) {
        setApiStatus('maintenance');
        toast({
          title: "Sistema em Manutenção",
          description: "O sistema está temporariamente em manutenção. Tente novamente em alguns minutos.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar manutenção:', error);
    }

    if (!prompt.trim()) {
      toast({
        title: t("Erro"),
        description: t("Por favor, descreva o site que deseja criar"),
        variant: "destructive",
      });
      return;
    }

    // Verifica se o usuário tem créditos suficientes
    if (!userData?.credits || userData.credits < 1) {
      toast({
        title: "Créditos insuficientes",
        description: "Você precisa de pelo menos 1 crédito para criar um site",
        variant: "destructive",
      });
      navigate("/credits");
      return;
    }

    // Detecta se é primeira interação ou edição
    const isFirstInteraction = messages.filter(m => m.role === 'user').length === 0;

    // Adiciona mensagem do usuário
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const currentPrompt = prompt;
    setPrompt("");

    // Gera ou usa o ID do projeto existente
    let currentProjectId = projectId;
    if (!currentProjectId) {
      currentProjectId = await generateUniqueProjectId();
      setProjectId(currentProjectId);
      localStorage.setItem('current_project_id', currentProjectId);
    }

    try {
      setIsGenerating(true);
      setProgress(0);
      toast({ title: t("Iniciando processo...") });

      // 1️⃣ Cria o job
      let response;

      if (selectedFiles.length > 0) {
        // Envia com FormData se houver arquivo(s)
        const formData = new FormData();
        formData.append("prompt", currentPrompt);
        formData.append("id_projeto", currentProjectId);
        formData.append("userId", userData?.id || "");
        // Envia todos os arquivos com o campo "logos" (múltiplos)
        selectedFiles.forEach((file) => formData.append("logos", file));

        response = await fetch(`${import.meta.env.VITE_API_URL}/sites/gerar_new_site`, {
          method: "POST",
          headers: {
            ...authService.getAuthHeader(),
          },
          body: formData,
        });
      } else {
        // Envia JSON normal se não houver arquivo
        response = await fetch(`${import.meta.env.VITE_API_URL}/sites/gerar_new_site`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify({
            prompt: currentPrompt,
            id_projeto: currentProjectId,
            userId: userData?.id || ""
          }),
        });
      }

      const data = await response.json();

      // Verifica se a API retornou erro (success: false ou !response.ok)
      if (!response.ok || data.success === false) {
        const errorMsg = data.message || data.error || "Erro ao criar site";
        throw new Error(errorMsg);
      }

      if (!data.jobId) throw new Error("Requisição não retornou jobId!");

      const { jobId } = data;
      // setProgress(10); // indica que o job foi criado

      // 2️⃣ Polling para verificar status do job
      let jobStatus = "processing";
      let jobResult = null;
      let attempts = 0;

      const MAX_ATTEMPTS = 300; // até ~10 minutos (300 * 2s)
      const POLL_INTERVAL = 2000; // 2s — responsivo o suficiente para mostrar % real

      while (jobStatus === "processing" && attempts < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));

        const statusResp = await fetch(
          `${import.meta.env.VITE_API_URL}/sites/job-status/${jobId}`,
          {
            headers: {
              "Content-Type": "application/json",
              ...authService.getAuthHeader(),
            },
          }
        );

        const jobData = await statusResp.json();

        if (jobData.job?.status) {
          jobStatus = jobData.job.status;
          jobResult = jobData.job.result;

          // Usa o progresso REAL retornado pelo back-end (0–100)
          if (typeof jobData.job.progress === "number" && jobData.job.progress > 0) {
            setProgress(jobData.job.progress);
          }

          // Se o job falhou, pega a mensagem de erro
          if (jobStatus === "failed" || jobStatus === "error") {
            const errorMsg = jobData.job.error || jobData.job.message || "Erro desconhecido no processamento";
            throw new Error(errorMsg);
          }
        }

        attempts++;
      }


      // 3️⃣ Finaliza com sucesso
      if (jobStatus === "done" && jobResult) {
        const fullHTML = `<!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Site Gerado por IA</title>
            ${jobResult.css_content ? `<style>${jobResult.css_content}</style>` : ""}
          </head>
          <body>
            ${jobResult.html_content || ""}
            ${jobResult.js_content ? `<script>${jobResult.js_content}</script>` : ""}
          </body>
          </html>`;

        setPreviewHtml(fullHTML);
        setProgress(100);

        // Adiciona mensagem do assistente
        const msgs = [
          "✨ Alteração aplicada com sucesso no seu site!",
          "🚀 Feito! Site atualizado e publicado.",
          "🎨 Design aprimorado conforme o seu pedido!",
          "⚡ Tudo certo! Suas mudanças já estão no ar.",
          "🛠️ Atualização concluída com sucesso!",
          "✅ Modificações geradas e aplicadas perfeitamente."
        ];
        const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
        const successMessage = isFirstInteraction
          ? "🎉 Uau! Seu site foi gerado e publicado com sucesso!"
          : randomMsg;

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: successMessage,
          timestamp: new Date(),
          sitePreview: fullHTML,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        toast({
          title: t("Sucesso!"),
          description: t("Site gerado com sucesso"),
        });

        // Modal/ticket promocional Upeex
        const promoAlreadyShown = localStorage.getItem("upeex_promo_shown");
        if (!promoAlreadyShown) {
          setShowPromoModal(true);
          localStorage.setItem("upeex_promo_shown", "true");
        } else {
          setShowPromoTicket(true);
        }

        // Recarrega o histórico de prompts após geração bem-sucedida
        fetchPromptHistory(currentProjectId);

        // Atualiza os créditos do usuário após geração
        await authService.refreshUserData();
        const updatedUser = authService.getUser();
        if (updatedUser) {
          setUserData(updatedUser);
        }

        // Limpa o arquivo após sucesso
        setSelectedFiles([]);
      } else {
        throw new Error("A requisição não foi concluído ou não retornou resultado");
      }

    } catch (err) {
      console.error("❌ Erro na geração:", err);
      setProgress(0);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: (err instanceof Error && err.message.includes("Limite")) 
            ? "❌ Ops! " + err.message 
            : "❌ Ops! Erro na geração. Por favor, fale com o suporte.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: t("Erro"),
        description: err instanceof Error ? err.message : t("Falha ao gerar o site. Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenInNewTab = () => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleLogout = () => {
    authService.logout();
    toast({
      title: t("Logout realizado"),
      description: t("Até logo!"),
    });
    navigate("/");
  };

  const handleRestoreVersion = async (version: any) => {
    const payload = {
      id: version.id,
      id_projeto: version.id_projeto,
      id_site_gererate: version.id_site_gererate
    };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/sites/restauracao`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success && data.html_new) {
        setPreviewHtml(data.html_new);

        toast({
          title: "Versão restaurada!",
          description: "A restauração foi realizada com sucesso.",
        });

        // Atualizar histórico de prompts
        await fetchPromptHistory(version.id_projeto);
      } else {
        throw new Error(data.message || "Erro ao restaurar versão");
      }

    } catch (err) {
      console.error("Erro ao restaurar versão:", err);

      toast({
        title: "Erro ao restaurar",
        description: "Não foi possível restaurar esta versão.",
        variant: "destructive",
      });
    }
  };

  const handleOpenHistory = () => {
    if (!hasPremiumPlan) {
      toast({
        variant: "destructive",
        title: "Recurso Premium",
        description: "Atualize para o plano premium para acessar o histórico de versões.",
      });
      return;
    }

    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Nenhum projeto",
        description: "Crie ou edite um site primeiro para ver o histórico.",
      });
      return;
    }

    setIsHistoryModalOpen(true);
  };

  if (!userData) {
    return null;
  }

  const userName = userData.name || "Usuário";
  const userEmail = userData.email || "";

  return (
    <div className="min-h-screen bg-gradient-bg">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <div className="flex items-center">
              {/* Logo Mobile */}
              <img
                src={theme === "dark" ? logoMobileDark : logoMobileLight}
                alt="Sitexpres"
                className="h-8 w-auto object-contain cursor-pointer transition-opacity hover:opacity-80 shrink-0 sm:hidden"
                onClick={() => navigate("/dashboard")}
              />
              {/* Logo Desktop */}
              <img
                src={theme === "dark" ? logoDark : logoLight}
                alt="Sitexpres"
                className="hidden sm:block h-12 w-auto object-contain cursor-pointer transition-opacity hover:opacity-80 shrink-0"
                onClick={() => navigate("/dashboard")}
              />
            </div>

            {/* API Status Indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${apiStatus === 'online'
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                      : apiStatus === 'maintenance'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse'
                        : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20'
                    }`}>
                    {apiStatus === 'online' ? (
                      <>
                        <Server className="w-3 h-3" />
                        <span className="hidden sm:inline">Online</span>
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      </>
                    ) : apiStatus === 'maintenance' ? (
                      <>
                        <WifiOff className="w-3 h-3" />
                        <span className="hidden sm:inline">Manutenção</span>
                        <span className="w-2 h-2 bg-red-500 rounded-full" />
                      </>
                    ) : (
                      <>
                        <Wifi className="w-3 h-3 animate-pulse" />
                        <span className="hidden sm:inline">Verificando...</span>
                      </>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {apiStatus === 'online'
                      ? 'API de geração de sites operando normalmente'
                      : apiStatus === 'maintenance'
                        ? 'Sistema em manutenção - Geração de sites temporariamente indisponível'
                        : 'Verificando status da API...'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Actions - Desktop and Mobile */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-8 px-2 sm:px-3"
                onClick={() => navigate("/credits")}
              >
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
                <span className="font-semibold text-xs sm:text-sm">{formatCredits(userData?.credits)}</span>
                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </Button>

              <Button variant="outline" size="sm" className="gap-1 h-8 px-2 sm:px-3" onClick={() => navigate("/my-sites")}>
                <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline text-xs sm:text-sm">{t('dashboard.viewMySites')}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-8 px-2 sm:px-3 bg-gradient-to-r from-primary/20 to-accent/20 border-primary/30 hover:from-primary/30 hover:to-accent/30"
                onClick={() => setIsAffiliateModalOpen(true)}
              >
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                <span className="hidden sm:inline text-xs sm:text-sm font-semibold">{t('affiliate.navButton')}</span>
                <span className="sm:hidden text-xs">💰</span>
              </Button>

              <Button variant="outline" size="sm" className="gap-1 h-8 px-2 sm:px-3" onClick={() => navigate("/transactions")}>
                <HistoryIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline text-xs sm:text-sm">Transações</span>
              </Button>

              <div className="flex items-center gap-1">
                <LanguageToggle />
                <ThemeToggle />
              </div>

              {/* Avatar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-full p-0">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-primary/20 hover:border-primary transition-colors">
                      <AvatarFallback className="bg-gradient-primary text-white font-bold text-xs sm:text-sm">
                        {userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card" align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>{t('dashboard.profile')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('dashboard.logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Chat Layout */}
      <main className="h-[calc(100vh-120px)] sm:h-[calc(100vh-80px)]">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Left Panel - Chat */}
          <div className="w-full lg:w-[35%] border-b lg:border-r lg:border-b-0 border-border/50 flex flex-col bg-card/80 backdrop-blur shadow-elegant max-h-[50vh] lg:max-h-full">
            {/* Input de Prompt Principal */}
            <div className="border-b border-border/50 p-2 sm:p-4 space-y-2 sm:space-y-3">
              <Textarea
                placeholder={t("dashboard.inputPlaceholder")}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  const novasImagens: File[] = [];
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith("image/")) {
                      const file = items[i].getAsFile();
                      if (file) novasImagens.push(file);
                    }
                  }
                  if (novasImagens.length > 0) {
                    setSelectedFiles(prev => [...prev, ...novasImagens].slice(0, 10));
                    toast({
                      title: t("Imagem colada"),
                      description: `${novasImagens.length} imagem(ns) adicionada(s)`,
                    });
                    e.preventDefault();
                  }
                }}
                className="min-h-[60px] sm:min-h-[80px] resize-none text-sm"
                disabled={isGenerating}
              />

              {/* Preview dos arquivos selecionados (múltiplos) */}
              {selectedFiles.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-border/50 relative group">
                      {file.type.startsWith('image/') ? (
                        <div className="relative h-10 w-10 sm:h-12 sm:w-12 rounded-md overflow-hidden shrink-0 border border-border shadow-sm">
                          <img src={URL.createObjectURL(file)} alt="preview" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-md bg-background border flex items-center justify-center shrink-0">
                          <Paperclip className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <span className="text-sm font-medium truncate text-foreground">{file.name}</span>
                        <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-background/50 hover:bg-destructive/10 hover:text-destructive text-muted-foreground absolute right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-1.5 sm:gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const validas = files.filter(f => f.type.startsWith('image/'));
                    const invalidas = files.length - validas.length;
                    if (invalidas > 0) {
                      toast({
                        title: t("Arquivo inválido"),
                        description: t("Apenas imagens são permitidas (JPG, PNG, GIF, etc.)"),
                        variant: "destructive",
                      });
                    }
                    if (validas.length > 0) {
                      setSelectedFiles(prev => [...prev, ...validas].slice(0, 10));
                      toast({
                        title: t("Arquivo(s) anexado(s)"),
                        description: `${validas.length} imagem(ns) adicionada(s)`,
                      });
                    }
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8 sm:h-10 px-2 sm:px-3"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating}
                >
                  <Paperclip className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
                <Button
                  onClick={() => {
                    setHasPendingPrompt(false);
                    handleGenerate();
                  }}
                  disabled={isGenerating || !prompt.trim()}
                  className={`flex-1 gap-1.5 sm:gap-2 bg-gradient-primary hover:opacity-90 shadow-elegant h-8 sm:h-10 text-xs sm:text-sm ${hasPendingPrompt && prompt.trim() ? 'animate-pulse-glow' : ''}`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                      <span className="hidden sm:inline">{t("generating")}</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">{t("dashboard.generate")}</span>
                      <span className="sm:hidden">{t("dashboard.generate")}</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 sm:gap-2 h-8 sm:h-10 px-2 sm:px-3"
                  onClick={() => {
                    setMessages([]);
                    setPreviewHtml("");
                    setProjectId("");
                    setSelectedFiles([]);
                    localStorage.removeItem('current_project_id');
                    localStorage.removeItem('current_project_messages');
                    localStorage.removeItem('current_project_preview');
                    toast({
                      title: t("Novo projeto criado"),
                      description: t("O histórico foi limpo. Um novo ID será gerado no próximo site."),
                    });
                  }}
                >
                  <Plus className="w-3 h-3" />
                  <span className="hidden sm:inline">{t("dashboard.new")}</span>
                </Button>

                {/* Botão de Histórico */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`gap-1 sm:gap-2 h-8 sm:h-10 px-2 sm:px-3 ${!hasPremiumPlan || !projectId ? "opacity-50" : ""
                            }`}
                          onClick={handleOpenHistory}
                          disabled={!projectId || isGenerating}
                        >
                          <HistoryIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                          {!hasPremiumPlan && <Crown className="w-3 h-3 text-accent" />}
                          <span className="hidden sm:inline text-xs sm:text-sm">Histórico</span>
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {!hasPremiumPlan && (
                      <TooltipContent>
                        <p className="text-xs">Recurso Premium - Restaure versões anteriores</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-2 sm:p-4 lg:p-6">
              <div className="space-y-2 sm:space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                    <div className="space-y-3">
                      <Bot className="h-16 w-16 mx-auto opacity-20" />
                      <p className="text-lg font-medium">{t("dashboard.greeting")}</p>
                      <p className="text-sm">{t("dashboard.greetingDesc")}</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 animate-fade-in ${message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                    >
                      {message.role === "assistant" && (
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                      )}
                      <div
                        className={`rounded-lg px-4 py-3 max-w-[80%] ${message.role === "user"
                          ? "bg-gradient-primary text-primary-foreground"
                          : "bg-muted"
                          }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {message.timestamp.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {message.role === "user" && (
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <UserCircle className="h-5 w-5 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {isGenerating && (
                  <div className="flex gap-3 justify-start animate-fade-in">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="rounded-lg px-4 py-3 bg-muted">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="text-sm">{t("Gerando seu site...")} {progress}%</p>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

          </div>

          {/* Right Panel - Preview */}
          <div className="flex-1 flex flex-col bg-card/80 backdrop-blur shadow-elegant min-h-[50vh] lg:min-h-0">
            <div className="border-b border-border/50 p-2 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <h2 className="text-sm sm:text-base font-semibold">{t("dashboard.previewTitle")}</h2>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                {/* Domínio personalizado da hospedagem */}
                {hostingDomain && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-2 text-xs bg-green-500/10 border-green-500/30">
                      <span className="relative flex h-2 w-2">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      <span className="hidden sm:inline">{t("Domínio")}</span>
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`https://${hostingDomain}`, '_blank')}
                      className="gap-1.5 text-xs border-green-500/30 hover:bg-green-500/10"
                    >
                      <ExternalLink className="h-3 w-3 text-green-500" />
                      <span className="hidden sm:inline">{hostingDomain}</span>
                      <span className="sm:hidden">{t("dashboard.site")}</span>
                    </Button>
                  </div>
                )}

                {/* Link sitexpres */}
                {siteUrl && !hostingDomain && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-2 text-xs">
                      <span className="relative flex h-2 w-2">
                        {dnsStatus === 'checking' && (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                          </>
                        )}
                        {dnsStatus === 'active' && (
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        )}
                        {dnsStatus === 'inactive' && (
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        )}
                      </span>
                      <span className="hidden sm:inline">{t("dashboard.linkLabel")}</span>
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(siteUrl, '_blank')}
                      className="gap-1.5 text-xs"
                      disabled={dnsStatus !== 'active'}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {dnsStatus === 'active' ? (
                        <>
                          <span className="hidden sm:inline">{siteUrl}</span>
                          <span className="sm:hidden">{t("dashboard.site")}</span>
                        </>
                      ) : (
                        <>
                          <span className="hidden sm:inline">{t("dashboard.propagatingDNS")}</span>
                          <span className="sm:hidden">{t("dashboard.propagating")}</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {previewHtml && (
                  <Button
                    size="sm"
                    onClick={handleOpenInNewTab}
                    className="bg-gradient-primary hover:opacity-90 shadow-elegant hover:shadow-glow transition-all gap-1.5 sm:gap-2 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                  >
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline">{t("dashboard.viewInNewTab")}</span>
                    <span className="sm:hidden">{t("dashboard.openSite")}</span>
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 p-2 sm:p-4">
              {isGenerating ? (
                <div className="border border-border/50 rounded-lg h-full flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
                  <div className="text-center space-y-6 max-w-md">
                    <div className="relative">
                      <div className="w-24 h-24 mx-auto rounded-full bg-gradient-primary animate-pulse flex items-center justify-center shadow-glow">
                        <Loader2 className="h-12 w-12 text-white animate-spin" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-foreground">
                        {messages.filter(m => m.role === 'user').length <= 1
                          ? t("dashboard.generatingSite")
                          : t("dashboard.improvingSite")}
                      </h3>
                      <p className="text-muted-foreground">{t("dashboard.waitMoment")}</p>
                    </div>
                    <div className="space-y-3">
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-primary transition-all duration-500 rounded-full shadow-glow"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-lg font-semibold text-primary">{progress}%</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className={`p-3 rounded-lg border transition-all ${progress > 0 ? 'border-primary bg-primary/10' : 'border-border/50'}`}>
                        <div className="text-xs font-medium">{t("dashboard.analyzing")}</div>
                      </div>
                      <div className={`p-3 rounded-lg border transition-all ${progress > 40 ? 'border-primary bg-primary/10' : 'border-border/50'}`}>
                        <div className="text-xs font-medium">{t("dashboard.creating")}</div>
                      </div>
                      <div className={`p-3 rounded-lg border transition-all ${progress > 80 ? 'border-primary bg-primary/10' : 'border-border/50'}`}>
                        <div className="text-xs font-medium">{t("dashboard.finalizing")}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : previewHtml ? (
                <div className="border border-border/50 rounded-lg overflow-hidden bg-white h-full">
                  <iframe
                    ref={iframeRef}
                    srcDoc={previewHtml}
                    className="w-full h-full"
                    title="Site Preview"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-border/50 rounded-lg h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center space-y-2">
                    <Sparkles className="h-12 w-12 mx-auto opacity-20" />
                    <p>{t("dashboard.previewWaiting")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <ProfileModal
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
        userData={userData}
        onUpdate={(updatedUser) => setUserData(updatedUser)}
      />

      <VersionHistoryModal
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
        versions={versions}
        onRestore={handleRestoreVersion}
      />

      {/* Modal de Usuário Bloqueado */}
      <Dialog open={isBlockedModalOpen} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <DialogTitle className="text-center text-xl">Conta Bloqueada</DialogTitle>
            <DialogDescription className="text-center text-base">
              Sua conta está temporariamente bloqueada. Por favor, entre em contato com o suporte para mais informações.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => window.open('https://wa.me/5594991941049?text=Olá, minha conta está bloqueada e preciso de ajuda.', '_blank')}
              className="w-full"
            >
              Falar com Suporte
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                authService.logout();
                navigate("/");
              }}
              className="w-full"
            >
              Sair da Conta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Promocional Upeex (primeira vez) */}
      <Dialog open={showPromoModal} onOpenChange={setShowPromoModal}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader className="items-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
              <Rocket className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl">
              🎉 Que legal, seu site está no ar!
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Que tal levar visitantes para ele? A{" "}
              <span className="font-semibold text-primary">Upeex.com</span>{" "}
              tem um cupom de{" "}
              <span className="font-bold text-primary text-lg">R$ 70,00</span>{" "}
              para sua primeira campanha de publicidade!
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button
              className="gap-2 h-12 text-base"
              onClick={() => {
                window.open("https://upeex.com", "_blank");
                setShowPromoModal(false);
              }}
            >
              <ExternalLink className="w-5 h-5" />
              Aproveitar Cupom de R$ 70,00
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setShowPromoModal(false)}
            >
              Agora não, obrigado
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Promocional Upeex (próximas vezes) */}
      {showPromoTicket && (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in max-w-sm">
          <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/20 bg-card shadow-lg">
            <Rocket className="w-5 h-5 text-primary shrink-0" />
            <p className="text-sm flex-1">
              <span className="font-medium">Leve visitantes ao seu site!</span>{" "}
              <span className="text-muted-foreground">Cupom de </span>
              <span className="font-bold text-primary">R$ 70,00</span>
              <span className="text-muted-foreground"> na Upeex.com</span>
            </p>
            <Button
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => window.open("https://upeex.com", "_blank")}
            >
              Aproveitar
            </Button>
            <button
              onClick={() => setShowPromoTicket(false)}
              className="absolute top-1 right-1 text-muted-foreground hover:text-foreground text-xs p-1"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Modal de Preview removido — preview inline disponível em cada anexo */}

      <AffiliateModal
        isOpen={isAffiliateModalOpen}
        onClose={() => setIsAffiliateModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
