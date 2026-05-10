-- Rodar no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/agcdyfnxwxlwwakvusov/sql/new

CREATE TABLE IF NOT EXISTS public.anvisa_medicamentos (
  id                         bigserial    PRIMARY KEY,
  tipo_produto               text,
  nome_produto               text,
  data_finalizacao_processo  text,
  categoria_regulatoria      text,
  numero_registro_produto    text         UNIQUE,
  data_vencimento_registro   text,
  numero_processo            text,
  classe_terapeutica         text,
  empresa_detentora_registro text,
  cnpj_empresa               text,
  situacao_registro          text,
  principio_ativo            text,
  created_at                 timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anvisa_med_cnpj     ON public.anvisa_medicamentos (cnpj_empresa);
CREATE INDEX IF NOT EXISTS idx_anvisa_med_situacao  ON public.anvisa_medicamentos (situacao_registro);
CREATE INDEX IF NOT EXISTS idx_anvisa_med_nome      ON public.anvisa_medicamentos USING gin (to_tsvector('portuguese', nome_produto));
