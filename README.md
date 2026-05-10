# BeautyProcure

> Hub de homologação e procuradoria para compradores de cosméticos

BeautyProcure é um SaaS B2B que permite buscar e homologar fornecedores de cosméticos, cruzando dados oficiais de compliance (Anvisa), saúde fiscal (Receita Federal) e estimativa de frete.

![Next.js](https://img.shields.io/badge/Next.js-14.1-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3-38bdf8?style=flat-square&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square&logo=supabase)

## 🚀 Funcionalidades

- **Compliance Anvisa**: Verificação automática do status de regularização junto à Anvisa
- **Saúde Fiscal**: Dados da Receita Federal em tempo real
- **Inteligência Logística**: Estimativas de frete e prazo de entrega
- **Dashboard Interativo**: Busca e filtros avançados de fornecedores
- **Dossiê Completo**: Informações detalhadas e catálogo de produtos
- **Score de Qualidade**: Sistema de pontuação automática

## 🛠️ Stack Tecnológica

- **Front-end**: Next.js 14 (App Router), React 18, TypeScript
- **Estilização**: Tailwind CSS
- **Ícones**: Lucide React
- **Back-end**: Next.js API Routes (Serverless Functions)
- **Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth (preparado para implementação)

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta no [Supabase](https://supabase.com) (gratuita)
- npm ou yarn

## ⚙️ Configuração do Projeto

### 1. Clone o repositório

```bash
cd BeautyProcure
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Aguarde a criação do banco de dados (leva alguns minutos)
3. No painel do Supabase, vá em **Settings** > **API**
4. Copie a **URL** e a **anon/public key**

### 4. Configure as variáveis de ambiente

Renomeie o arquivo `.env.local.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
```

### 5. Configure o banco de dados

No Supabase, vá em **SQL Editor** e execute os scripts na seguinte ordem:

1. Execute `supabase/schema.sql` para criar as tabelas
2. Execute `supabase/seed.sql` para popular com dados de exemplo

### 6. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no navegador.

## 📂 Estrutura de Pastas

```
BeautyProcure/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   └── fornecedores/         # Endpoints de fornecedores
│   ├── dashboard/                # Páginas do dashboard
│   │   ├── fornecedor/[cnpj]/    # Dossiê do fornecedor
│   │   ├── materiais/            # Meus materiais
│   │   └── alertas/              # Alertas
│   ├── layout.tsx                # Layout raiz
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Estilos globais
├── components/                   # Componentes React
│   ├── Navbar.tsx
│   ├── Sidebar.tsx
│   ├── Badge.tsx
│   └── LoadingSpinner.tsx
├── lib/                          # Bibliotecas e configurações
│   └── supabase.ts               # Cliente Supabase
├── utils/                        # Utilitários
│   ├── frete.ts                  # Simulador de API de frete
│   └── formatters.ts             # Funções de formatação
├── supabase/                     # Scripts SQL
│   ├── schema.sql                # Esquema do banco
│   └── seed.sql                  # Dados iniciais
└── public/                       # Arquivos estáticos
```

## 🗃️ Estrutura do Banco de Dados

### Tabela: `fornecedores`

| Campo              | Tipo        | Descrição                          |
|--------------------|-------------|------------------------------------|
| id                 | UUID        | Identificador único                |
| cnpj               | VARCHAR(18) | CNPJ (chave única)                 |
| razao_social       | VARCHAR     | Razão social                       |
| nome_fantasia      | VARCHAR     | Nome fantasia                      |
| estado             | VARCHAR(2)  | UF                                 |
| cidade             | VARCHAR     | Cidade                             |
| data_abertura      | DATE        | Data de abertura da empresa        |
| situacao_receita   | VARCHAR     | Status Receita Federal             |
| status_anvisa      | VARCHAR     | Status Anvisa                      |
| score_qualidade    | NUMERIC     | Score de 0 a 10                    |

### Tabela: `produtos_catalogo`

| Campo              | Tipo        | Descrição                          |
|--------------------|-------------|------------------------------------|
| id                 | UUID        | Identificador único                |
| cnpj_fornecedor    | VARCHAR(18) | FK para fornecedores               |
| nome_produto       | VARCHAR     | Nome do produto                    |
| registro_anvisa    | VARCHAR     | Número de registro Anvisa          |
| categoria          | VARCHAR     | Categoria do produto               |
| preco_referencia   | NUMERIC     | Preço de referência                |

## 🎨 Paleta de Cores

- **Slate**: Textos e fundos neutros
  - `slate-50` a `slate-900`
- **Blue**: Ações primárias e destaques
  - `blue-600` (principal)
  - `blue-700` (hover)

## 🔑 API Routes

### GET `/api/fornecedores`

Retorna lista de fornecedores com filtros opcionais.

**Query Params:**
- `estado` (opcional): Filtra por estado (UF)
- `busca` (opcional): Busca por nome ou CNPJ
- `status_anvisa` (opcional): Filtra por status Anvisa

**Resposta:**
```json
{
  "fornecedores": [...],
  "total": 8
}
```

### GET `/api/fornecedores/[cnpj]`

Retorna dossiê completo de um fornecedor específico.

**Resposta:**
```json
{
  "fornecedor": {...},
  "produtos": [...],
  "produtosPorCategoria": {...},
  "totalProdutos": 15
}
```

## 🧪 Dados de Teste

O projeto vem com 8 fornecedores fictícios e mais de 25 produtos cadastrados para testes:

- **Vloss Cosméticos** (SP) - Score 9.2
- **Beleza Pura** (RJ) - Score 8.7
- **Naturalis Orgânicos** (MG) - Score 9.5
- **Glamour Beauty** (PR) - Score 8.3
- **CosmeTech** (SC) - Score 9.0
- E mais...

## 🚧 Funcionalidades Futuras

- [ ] Autenticação de usuários (Supabase Auth)
- [ ] Sistema de favoritos
- [ ] Exportação de dossiês em PDF
- [ ] Alertas automáticos de mudança de status
- [ ] Integração real com API Melhor Envio
- [ ] Integração com API da Receita Federal
- [ ] Integração com dados da Anvisa
- [ ] Dashboard de analytics
- [ ] Sistema de cotações

## 📦 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Iniciar em produção
npm start

# Lint
npm run lint
```

## 🐛 Troubleshooting

### Erro: "Missing Supabase environment variables"

Verifique se você criou o arquivo `.env.local` e preencheu as variáveis corretamente.

### Tabela vazia no dashboard

Certifique-se de que executou o script `supabase/seed.sql` no SQL Editor do Supabase.

### Erro de conexão com Supabase

1. Verifique se as credenciais em `.env.local` estão corretas
2. Confirme que o projeto Supabase está ativo
3. Verifique se as tabelas foram criadas corretamente

## 📄 Licença

Este é um projeto de demonstração/MVP. Use livremente para fins educacionais.

## 🤝 Contribuindo

Este é um MVP/demonstração. Sinta-se livre para fazer fork e adaptar para suas necessidades.

## 👨‍💻 Autor

Desenvolvido como MVP para demonstração de habilidades Full-Stack.

---

**BeautyProcure** - Homologação de Fornecedores de Cosméticos em Segundos 🚀
