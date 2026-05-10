-- Rodar no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/agcdyfnxwxlwwakvusov/sql/new

CREATE TABLE IF NOT EXISTS public.anvisa_parecer_aval_medicamentos (
  id           bigserial    PRIMARY KEY,
  col_01       text, col_02 text, col_03 text, col_04 text,
  col_05       text, col_06 text, col_07 text, col_08 text,
  col_09       text, col_10 text, col_11 text, col_12 text,
  col_13       text, col_14 text, col_15 text, col_16 text,
  col_17       text, col_18 text, col_19 text, col_20 text,
  col_21       text, col_22 text,
  created_at   timestamptz  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anvisa_funcionamento_internacional (
  id                           bigserial    PRIMARY KEY,
  co_seq_empresa_internacional text         UNIQUE,
  no_razao_social              text,
  ds_codigo_gginp              text,
  st_registro_ativo            text,
  dt_carga_etl                 text,
  created_at                   timestamptz  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anvisa_produtos_irregulares (
  id                                bigserial    PRIMARY KEY,
  co_seq_dossie_investig_med        text         UNIQUE,
  nu_processo                       text,
  nu_cnpj                           text,
  no_razao_social                   text,
  co_tipo_produto                   text,
  ds_tipo_produto                   text,
  co_risco                          text,
  ds_risco_produto                  text,
  total_medida_cautelar             text,
  no_empresa_investigada            text,
  nu_cnpj_empresa_investigada       text,
  co_assunto                        text,
  dt_publicacao_medida              text,
  co_acao_fiscalizacao              text,
  co_atividade_fiscalizacao         text,
  dt_publicacao                     text,
  produtos_concatenados             text,
  ds_acao_fiscalizacao              text,
  ds_atividade_fiscalizacao         text,
  acao_atividade                    text,
  produto                           text,
  registro                          text,
  dt_carga_etl                      text,
  created_at                        timestamptz  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anvisa_funcionamento_nacional (
  id                           bigserial    PRIMARY KEY,
  nu_cnpj                      text,
  no_razao_social              text,
  nu_autorizacao               text,
  nu_autorizacao_novo          text         UNIQUE,
  nu_processo                  text,
  dt_autorizacao               text,
  ativo                        text,
  tipo_produto                 text,
  co_tipo_atividades           text,
  st_autorizacao_especial      text,
  dt_cancelamento              text,
  no_fantasia                  text,
  ds_homepage                  text,
  nu_sac                       text,
  dt_publicacao                text,
  cidade                       text,
  uf                           text,
  nu_cep                       text,
  ds_endereco                  text,
  bairro                       text,
  representante_tecnico        text,
  representante_legal          text,
  co_municipio_ibge            text,
  atividades                   text,
  dt_carga_etl                 text,
  created_at                   timestamptz  DEFAULT now()
);



-- Index recommendations
CREATE INDEX IF NOT EXISTS idx_anvisa_nacional_cnpj ON public.anvisa_funcionamento_nacional (nu_cnpj);
CREATE INDEX IF NOT EXISTS idx_anvisa_irreg_cnpj ON public.anvisa_produtos_irregulares (nu_cnpj);
