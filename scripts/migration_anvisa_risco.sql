-- Migration: cria tabela anvisa_risco no Supabase
-- Rodar no SQL Editor: https://supabase.com/dashboard/project/agcdyfnxwxlwwakvusov/sql/new

CREATE TABLE IF NOT EXISTS public.anvisa_risco (
  id              bigserial    PRIMARY KEY,
  expediente      text         NOT NULL,
  cnpj            text         NOT NULL,
  razao_social    text,
  cod_processo    text,
  tipo_processo   text,
  num_registro    text,
  data_protocolo  text,
  situacao        text,
  nivel_risco     text,
  data_situacao   text,
  data_vencimento text,
  created_at      timestamptz  DEFAULT now(),
  CONSTRAINT anvisa_risco_expediente_key UNIQUE (expediente)
);

CREATE INDEX IF NOT EXISTS idx_anvisa_risco_cnpj ON public.anvisa_risco (cnpj);
