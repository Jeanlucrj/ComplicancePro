# CompliancePro

> Hub de compliance, procuradoria e inteligência regulatória para compradores do setor de saúde e beleza.

![Next.js](https://img.shields.io/badge/Next.js-14.1-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3-38bdf8?style=flat-square&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square&logo=supabase)

## Funcionalidades

- **Autenticação completa** — Login, cadastro, recuperação de senha via Supabase Auth
- **Compliance ANVISA** — Verificação automática de cosméticos e medicamentos (regularizados, registrados, irregulares, AFE/AE)
- **Saúde Fiscal** — Dados da Receita Federal em tempo real via BrasilAPI
- **Dossiê de Fornecedores** — Busca por CNPJ com enriquecimento automático de dados
- **Catálogo ANVISA** — Base completa de produtos com filtros avançados
- **Inteligência DOU** — Monitoramento do Diário Oficial da União com IA (Gemini)
- **Produtos Irregulares** — Cruzamento automático com a lista negra da ANVISA
- **Alertas automáticos** — Notificações de compliance para fornecedores do dossiê do usuário
- **Sistema de cotações** — Solicitação e gestão de cotações com fornecedores via WhatsApp (Z-API)
- **Score IA** — Pontuação automática de risco regulatório por CNPJ
- **Estimativas de frete** — Cálculo logístico por estado

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Back-end | Next.js API Routes (Serverless) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| IA | Google Gemini (DOU), Anthropic Claude (Score) |
| WhatsApp | Z-API |
| Scraping ANVISA | Playwright / @sparticuz/chromium (Vercel) |

## Configuração

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure as variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Cron
CRON_SECRET=your_cron_secret

# Z-API WhatsApp (opcional)
ZAPI_INSTANCE_ID=your_instance_id
ZAPI_TOKEN=your_token
```

### 3. Inicie o servidor

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Estrutura Principal

```
app/
├── (auth)/           # Login, signup, logout, reset senha
├── dashboard/
│   ├── page.tsx              # Busca de fornecedores
│   ├── fornecedor/[cnpj]/    # Dossiê completo do fornecedor
│   ├── catalogo/             # Catálogo ANVISA
│   ├── inteligencia/         # Inteligência DOU
│   ├── irregulares/          # Produtos irregulares
│   ├── alertas/              # Alertas de compliance
│   ├── materiais/            # Fornecedores analisados
│   └── perfil/               # Perfil do usuário
├── api/
│   ├── anvisa/               # APIs ANVISA (catálogo, irregulares, risco, AFE, sync)
│   ├── dou/                  # APIs DOU (sync, cron, inteligência)
│   ├── fornecedores/         # CRUD fornecedores + score IA
│   ├── cotacoes/             # Sistema de cotações
│   └── whatsapp/             # Envio via Z-API
lib/
├── enrichment.ts     # Enriquecimento de dados CNPJ (Receita + ANVISA)
├── supabase.ts       # Cliente Supabase (browser)
└── supabase-server.ts # Cliente Supabase (servidor)
```

## Scripts de Dados ANVISA

```bash
# Importar CSVs de dados abertos ANVISA
npm run import:anvisa

# Importar medicamentos
npm run import:medicamentos

# Sincronizar dados ANVISA (cosméticos, medicamentos, irregulares, AFE)
npm run sync:cosmeticos
npm run sync:medicamentos
npm run sync:irregulares
npm run sync:afe
```

## Deploy (Vercel)

1. Conecte o repositório no painel da Vercel
2. Adicione todas as variáveis do `.env.local` em **Settings → Environment Variables**
3. No Supabase → **Authentication → URL Configuration**: adicione a URL da Vercel como redirect permitido
4. Deploy automático a cada push na branch `main`
