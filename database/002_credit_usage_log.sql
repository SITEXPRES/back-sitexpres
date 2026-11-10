-- Registro de consumo de créditos por chamada de IA.
-- Cada prompt do usuário (site_prompts) pode gerar várias chamadas; elas são agrupadas por site_prompt_id.
CREATE TABLE IF NOT EXISTS public.credit_usage_log (
    id             BIGSERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL,
    id_projeto     TEXT,
    site_prompt_id INTEGER,
    tokens         INTEGER NOT NULL DEFAULT 0,
    credits        NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_projeto ON public.credit_usage_log (id_projeto);
CREATE INDEX IF NOT EXISTS idx_credit_usage_prompt  ON public.credit_usage_log (site_prompt_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_user    ON public.credit_usage_log (user_id);

