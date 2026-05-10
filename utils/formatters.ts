/**
 * Funções utilitárias para formatação de dados
 */

/**
 * Formata CNPJ para exibição (XX.XXX.XXX/XXXX-XX)
 */
export function formatarCNPJ(cnpj: string): string {
  const cnpjLimpo = cnpj.replace(/\D/g, '');

  if (cnpjLimpo.length !== 14) return cnpj;

  return cnpjLimpo.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

/**
 * Formata data para exibição em português (DD/MM/YYYY)
 */
export function formatarData(data: string | null): string {
  if (!data) return '-';

  // Se já for DD/MM/YYYY (comum no CSV da Anvisa), apenas limpa e retorna
  if (/^\d{2}\/\d{2}\/\d{4}/.test(data)) {
    return data.split(' ')[0];
  }

  // Se for YYYY-MM-DD (formato ISO), extrai sem shift de timezone
  if (/^\d{4}-\d{2}-\d{2}/.test(data)) {
    const [year, month, day] = data.split('T')[0].split('-').map(Number);
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
  }

  const dataObj = new Date(data);
  if (isNaN(dataObj.getTime())) return data;
  
  return dataObj.toLocaleDateString('pt-BR');
}

/**
 * Verifica se uma data (DD/MM/YYYY ou ISO) já passou.
 */
export function isVencida(data: string | null): boolean {
  if (!data) return false;
  
  let dataObj: Date;
  
  if (/^\d{2}\/\d{2}\/\d{4}/.test(data)) {
    const [d, m, y] = data.split(' ')[0].split('/').map(Number);
    dataObj = new Date(y, m - 1, d);
  } else {
    dataObj = new Date(data);
  }

  if (isNaN(dataObj.getTime())) return false;
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return dataObj < hoje;
}

/**
 * Formata valor monetário para exibição (R$ X.XXX,XX)
 */
export function formatarMoeda(valor: number | null): string {
  if (valor === null || valor === undefined) return '-';

  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Calcula tempo de mercado em anos a partir da data de abertura
 */
export function calcularTempoMercado(dataAbertura: string | null): string {
  if (!dataAbertura) return '-';

  const abertura = new Date(dataAbertura);
  const hoje = new Date();
  const anos = Math.floor((hoje.getTime() - abertura.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

  if (anos === 0) return 'Menos de 1 ano';
  if (anos === 1) return '1 ano';
  return `${anos} anos`;
}

/**
 * Formata telefone para exibição
 */
export function formatarTelefone(telefone: string | null): string {
  if (!telefone) return '-';

  const telefoneLimpo = telefone.replace(/\D/g, '');

  if (telefoneLimpo.length === 10) {
    return telefoneLimpo.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }

  if (telefoneLimpo.length === 11) {
    return telefoneLimpo.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }

  return telefone;
}

/**
 * Retorna cor do badge baseado no status
 */
export function getStatusColor(status: string): {
  bg: string;
  text: string;
} {
  const statusUpper = status.toUpperCase();

  if (statusUpper === 'REGULAR' || statusUpper === 'ATIVA') {
    return { 
      bg: 'bg-green-100 dark:bg-green-900/30', 
      text: 'text-green-800 dark:text-green-400' 
    };
  }

  if (statusUpper === 'PENDENTE') {
    return { 
      bg: 'bg-yellow-100 dark:bg-yellow-900/30', 
      text: 'text-yellow-800 dark:text-yellow-400' 
    };
  }

  if (statusUpper === 'SUSPENSA' || statusUpper === 'IRREGULAR') {
    return { 
      bg: 'bg-red-100 dark:bg-red-900/30', 
      text: 'text-red-800 dark:text-red-400' 
    };
  }

  return { 
    bg: 'bg-gray-100 dark:bg-gray-800', 
    text: 'text-gray-800 dark:text-gray-300' 
  };
}

/**
 * Retorna cor do score de qualidade
 */
export function getScoreColor(score: number | null): string {
  if (score === null) return 'text-gray-500';

  if (score >= 9) return 'text-green-600 dark:text-green-400';
  if (score >= 7.5) return 'text-blue-600 dark:text-blue-400';
  if (score >= 6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Calcula o score de qualidade do fornecedor (0 a 10)
 */
export function calcularScore(
  statusAnvisa: string,
  situacaoReceita: string,
  dataAbertura: string | null
): number {
  let score = 0;

  // 1. Status ANVISA (Peso 5)
  const sA = statusAnvisa.toUpperCase();
  if (sA === 'REGULAR') score += 5;
  else if (sA === 'PENDENTE') score += 2;
  else if (sA === 'NAO_ENCONTRADA') score += 1;

  // 2. Situação Receita Federal (Peso 3)
  const sR = situacaoReceita.toUpperCase();
  if (sR === 'ATIVA') score += 3;
  else if (sR === 'PENDENTE') score += 1;

  // 3. Tempo de Mercado (Peso 2)
  if (dataAbertura) {
    const abertura = new Date(dataAbertura);
    const hoje = new Date();
    const anos = (hoje.getTime() - abertura.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    
    if (anos >= 10) score += 2;
    else if (anos >= 5) score += 1.5;
    else if (anos >= 2) score += 1;
    else if (anos >= 1) score += 0.5;
  }

  return Number(Math.min(score, 10).toFixed(1));
}

