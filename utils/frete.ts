/**
 * Simulador de API do Melhor Envio
 * Esta função simula uma chamada à API de cálculo de frete
 * Em produção, você deve integrar com a API real do Melhor Envio
 */

export interface FreteEstimativa {
  cepOrigem: string;
  cepDestino: string;
  prazoMinimo: number;
  prazoMaximo: number;
  valorEstimado: number;
  transportadora: string;
}

/**
 * Calcula o frete estimado entre dois CEPs
 * @param cepDestino - CEP do cliente/comprador
 * @param cepOrigem - CEP do fornecedor
 * @returns Estimativa de frete com prazo e valor
 */
export async function calcularFreteEstimado(
  cepDestino: string,
  cepOrigem: string
): Promise<FreteEstimativa> {
  // Simula delay de API (100-300ms)
  await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

  // Remove caracteres não numéricos dos CEPs
  const cepOrigemLimpo = cepOrigem.replace(/\D/g, '');
  const cepDestinoLimpo = cepDestino.replace(/\D/g, '');

  // Calcula "distância" baseada na diferença entre CEPs
  // Isso é apenas uma simulação - não reflete distância real
  const distanciaSimulada = Math.abs(
    parseInt(cepOrigemLimpo.substring(0, 2)) -
    parseInt(cepDestinoLimpo.substring(0, 2))
  );

  // Determina prazo baseado na "distância"
  let prazoMinimo: number;
  let prazoMaximo: number;
  let valorBase: number;

  if (distanciaSimulada === 0) {
    // Mesma região (mesmo estado)
    prazoMinimo = 2;
    prazoMaximo = 4;
    valorBase = 15;
  } else if (distanciaSimulada <= 5) {
    // Estados próximos
    prazoMinimo = 3;
    prazoMaximo = 6;
    valorBase = 25;
  } else if (distanciaSimulada <= 10) {
    // Região próxima
    prazoMinimo = 5;
    prazoMaximo = 8;
    valorBase = 35;
  } else if (distanciaSimulada <= 20) {
    // Região distante
    prazoMinimo = 7;
    prazoMaximo = 12;
    valorBase = 50;
  } else {
    // Muito distante
    prazoMinimo = 10;
    prazoMaximo = 15;
    valorBase = 70;
  }

  // Adiciona variação aleatória ao valor (±15%)
  const variacao = valorBase * 0.15;
  const valorEstimado = parseFloat(
    (valorBase + (Math.random() * variacao * 2 - variacao)).toFixed(2)
  );

  // Seleciona transportadora aleatoriamente
  const transportadoras = ['Correios PAC', 'Correios SEDEX', 'Jadlog', 'Total Express'];
  const transportadora = transportadoras[Math.floor(Math.random() * transportadoras.length)];

  return {
    cepOrigem,
    cepDestino,
    prazoMinimo,
    prazoMaximo,
    valorEstimado,
    transportadora,
  };
}

/**
 * Formata CEP para exibição (XXXXX-XXX)
 */
export function formatarCEP(cep: string): string {
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) return cep;
  return `${cepLimpo.substring(0, 5)}-${cepLimpo.substring(5)}`;
}

/**
 * Valida se o CEP tem formato válido
 */
export function validarCEP(cep: string): boolean {
  const cepLimpo = cep.replace(/\D/g, '');
  return cepLimpo.length === 8 && /^\d+$/.test(cepLimpo);
}
