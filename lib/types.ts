export interface AnvisaNorm {
  id?: string;
  $id?: string;
  numero_norma: string;
  tipo: string;
  tema_principal: string;
  status: string;
  data_publicacao: string;
  link_datalegis?: string;
  resumo_ia_impacto?: string;
  texto_integral?: string;
  ativos_afetados?: string[];
  created_at?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface DouProductIntelligence {
  id?: string;
  $id?: string;
  status_acao: string;
  tipo_produto: string;
  nivel_alerta: string;
  produto_nome: string;
  lotes_afetados?: string;
  empresa_nome?: string;
  cnpj?: string;
  texto_alerta?: string;
  created_at?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface DOUEntry {
  id?: string;
  $id?: string;
  tipo_evento: string;
  priority: 'alta' | 'media';
  categoria: string;
  empresa: string;
  produto: string;
  ativos: string[];
  technical_info: string;
  impacto_negocios: string;
  numero_registro: string;
  dossie_id: string;
  timestamp: string;
  edicao?: string;
  secao?: string;
  pagina?: string;
  categoria_orgao?: string;
  created_at?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface Fornecedor {
  id?: string;
  $id?: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  estado: string;
  cidade: string;
  cep: string | null;
  endereco: string | null;
  data_abertura: string | null;
  situacao_receita: string;
  status_anvisa: string;
  score_qualidade: number | null;
  email: string | null;
  telefone: string | null;
  tipo_anvisa: 'cosmetico' | 'medicamento' | 'ambos' | null;
  user_id: string;
  created_at?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface Produto {
  id?: string;
  $id?: string;
  cnpj_fornecedor: string;
  nome_produto: string;
  registro_anvisa: string | null;
  categoria: string | null;
  descricao: string | null;
  preco_referencia: number | null;
  data_inicial_registro: string | null;
  data_vencimento_registro: string | null;
  vencimento_limpo?: string | null;
  seguro_compra?: boolean;
  user_id: string;
  created_at?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface Cotacao {
  id?: string;
  $id?: string;
  cnpj_fornecedor: string;
  user_id: string;
  produtos_json: string;
  status: string;
  observacoes: string | null;
  created_at?: string;
  $createdAt?: string;
  $updatedAt?: string;
}
