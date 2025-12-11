import axios from "axios";
import ftp from "basic-ftp";
import { Readable } from "stream";
import https from "https";
import dotenv from "dotenv";
import pool from "../config/db.js";
import { countTokens } from "@anthropic-ai/tokenizer";

export function contarTokens(texto) {
    try {
        if (!texto || typeof texto !== "string") return 0;

        const total = countTokens(texto);
        return total;
    } catch (error) {
        console.error("Erro ao contar tokens:", error);
        return 0;
    }
}



dotenv.config();

export async function uso_creditos(id_user, qtd_tokens, id_projeto) {
    try {
        console.log("==== Realizando Desconto de Créditos ====");


        // 1. Converte token em créditos
        let creditosParaDescontar = qtd_tokens / 10000; // Ex: 35000 => 3.5

        // Converte para número com até 2 casas decimais
        creditosParaDescontar = Number(creditosParaDescontar.toFixed(2));

        console.log("==== creditosParaDescontar ====", creditosParaDescontar);

        // 2. Busca créditos atuais
        const resultUser = await pool.query(
            `SELECT credits FROM public.users WHERE id = $1`,
            [id_user]
        );

        if (resultUser.rows.length === 0) {
            throw new Error("Usuário não encontrado");
        }

        let creditsAtuais = Number(resultUser.rows[0].credits);
        let novosCreditos = creditsAtuais - creditosParaDescontar;

        // 3. Evitar créditos negativos
        if (novosCreditos < 0) novosCreditos = 0;

        // 4. Atualiza no banco
        await pool.query(
            `UPDATE public.users SET credits = $1 WHERE id = $2`,
            [novosCreditos, id_user]
        );

        // 5. (Opcional) salvar tokens usados no projeto
        /* if (id_projeto) {
            await pool.query(
                `UPDATE public.projects
         SET tokens_usados = COALESCE(tokens_usados, 0) + $1
         WHERE id = $2`,
                [qtd_tokens, id_projeto]
            );
        } */

        return true;

    } catch (error) {
        console.error("Erro ao usar créditos:", error);
        return false;
    }
}

export async function verificar_creditos_prompt(id_user, prompt_cliente, basehtml = "") {
    try {
        // ========================
        // 1) BUSCA CRÉDITOS DO USER
        // ========================
        const resultUser = await pool.query(
            `SELECT credits FROM public.users WHERE id = $1`,
            [id_user]
        );

        if (resultUser.rows.length === 0) {
            return {
                erro: true,
                mensagem: "Usuário não encontrado",
                podeRodar: false
            };
        }

        // Créditos → cada 1 crédito = 10.000 tokens
        const creditsAtuais = Number(resultUser.rows[0].credits);
        const tokensDisponiveis = creditsAtuais * 10000;

        // ========================
        // 2) CONTAGEM DE TOKENS DE ENTRADA
        // ========================
        const tokensPrompt = contarTokens(prompt_cliente || "");
        const tokensHtml   = basehtml && basehtml.trim() !== "" ? contarTokens(basehtml) : 0;

        // ========================
        // 3) ESTIMATIVA REAL DE TOKENS NECESSÁRIOS
        // ========================
        const tokensEntrada = tokensPrompt + tokensHtml;

        // Quanto a IA deverá gerar? (fator de saída)
        const fatorSaida = 2;  // pode mudar para 2.5 ou 3 se quiser mais segurança

        let tokensPrevistos = 0;

        // 💡 PRIMEIRA EXECUÇÃO: sem HTML → gerar HTML completo
        if (!basehtml || basehtml.trim() === "") {

            const minimoGeracao = 5000; // IA vai gerar HTML grande mesmo com prompt pequeno
            tokensPrevistos = Math.max(tokensPrompt * fatorSaida, minimoGeracao);


        } else {
            // EXECUÇÃO SEGUINTE → usa tokens de entrada reais * fator
            tokensPrevistos = tokensEntrada * fatorSaida;
        }

        // ========================
        // 4) VERIFICAR SE PODE RODAR
        // ========================
        const podeRodar = tokensPrevistos <= tokensDisponiveis;

        // ========================
        // 5) RETORNO FINAL
        // ========================
        return {
            erro: false,
            id_user,
            creditsAtuais,
            tokensDisponiveis,
            prompt_cliente,
            basehtml,
            tokensPrompt,
            tokensHtml,
            tokensEntrada,
            tokensPrevistos,
            fatorSaida,
            podeRodar
        };

    } catch (error) {
        console.error("Erro ao verificar créditos:", error);
        return {
            erro: true,
            mensagem: error.message,
            podeRodar: false
        };
    }
}


