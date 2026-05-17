/**
 * lib/zapi.ts
 * Utilitário para envio de mensagens WhatsApp via Z-API.
 */

const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID!;
const TOKEN       = process.env.ZAPI_TOKEN!;
const BASE_URL    = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}`;

/**
 * Normaliza número para formato internacional sem +
 * Ex: "(11) 99999-9999" → "5511999999999"
 */
export function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '');
  // Se já tem DDI 55 (13 dígitos com 9 ou 12 sem) → mantém
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  // Adiciona DDI Brasil
  return '55' + digits;
}

/**
 * Envia mensagem de texto via WhatsApp.
 */
export async function enviarWhatsApp(telefone: string, mensagem: string): Promise<boolean> {
  try {
    const phone = normalizarTelefone(telefone);
    const res = await fetch(`${BASE_URL}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message: mensagem }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error('[Z-API] Erro ao enviar:', json);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Z-API] Exceção ao enviar:', err);
    return false;
  }
}

/**
 * Formata uma lista de alertas em mensagem WhatsApp.
 */
export function formatarMensagemAlertas(
  nomeEmpresa: string,
  alertas: Array<{ tipo: string; titulo: string; descricao: string; severidade: 'error' | 'warning' | 'info' }>
): string {
  const emoji = (sev: string) => sev === 'error' ? '🔴' : sev === 'warning' ? '🟡' : 'ℹ️';

  const linhas = alertas.map(a => `${emoji(a.severidade)} *${a.titulo}*\n${a.descricao}`).join('\n\n');

  return (
    `🔔 *Data Control — Alertas ANVISA*\n` +
    `Empresa: ${nomeEmpresa}\n` +
    `Data: ${new Date().toLocaleDateString('pt-BR')}\n\n` +
    linhas +
    `\n\n_Acesse o dashboard para mais detalhes._`
  );
}
