-- Execute este SQL no Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS assinaturas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano                   TEXT NOT NULL DEFAULT 'pro',          -- 'pro' | 'enterprise'
  status                  TEXT NOT NULL DEFAULT 'pendente',     -- 'pendente' | 'ativa' | 'cancelada' | 'expirada'
  abacatepay_charge_id    TEXT,                                 -- ID da cobrança na AbacatePay
  pix_qr_code_base64      TEXT,                                 -- QR Code em base64
  pix_copia_cola          TEXT,                                 -- Código Pix copia e cola
  valor_centavos          INTEGER NOT NULL DEFAULT 0,           -- Valor em centavos (ex: 4990 = R$ 49,90)
  data_pagamento          TIMESTAMPTZ,
  data_expiracao          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_assinaturas_user_id ON assinaturas(user_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_assinaturas_charge_id ON assinaturas(abacatepay_charge_id);

-- RLS: usuário só vê as próprias assinaturas
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_proprias_assinaturas"
  ON assinaturas FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assinaturas_updated_at
  BEFORE UPDATE ON assinaturas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
