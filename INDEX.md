# 📑 BeautyProcure - Índice Geral

Navegação rápida por toda a documentação e arquivos do projeto.

---

## 📚 Documentação (Leia Primeiro)

| Arquivo | Descrição | Quando Ler |
|---------|-----------|------------|
| **[GET_STARTED.md](./GET_STARTED.md)** | 🎯 **COMECE AQUI** - Introdução visual | Primeiro contato |
| **[README.md](./README.md)** | Documentação completa do projeto | Após setup |
| **[QUICKSTART.md](./QUICKSTART.md)** | Setup em 5 minutos | Antes de rodar |
| **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** | Visão geral técnica | Para entender escopo |
| **[STRUCTURE.md](./STRUCTURE.md)** | Arquitetura de arquivos | Para desenvolver |
| **[DEPLOY.md](./DEPLOY.md)** | Guia de produção | Antes de deploy |

---

## 🗂️ Código Fonte

### 📱 Front-end (Páginas)

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `app/page.tsx` | `/` | Landing page com hero, features e pricing |
| `app/dashboard/page.tsx` | `/dashboard` | Lista de fornecedores com filtros |
| `app/dashboard/fornecedor/[cnpj]/page.tsx` | `/dashboard/fornecedor/:cnpj` | Dossiê completo do fornecedor |
| `app/dashboard/materiais/page.tsx` | `/dashboard/materiais` | Meus materiais (placeholder) |
| `app/dashboard/alertas/page.tsx` | `/dashboard/alertas` | Alertas (placeholder) |

### 🔌 Back-end (APIs)

| Arquivo | Endpoint | Descrição |
|---------|----------|-----------|
| `app/api/fornecedores/route.ts` | `GET /api/fornecedores` | Lista fornecedores com filtros |
| `app/api/fornecedores/[cnpj]/route.ts` | `GET /api/fornecedores/:cnpj` | Busca fornecedor específico |

### 🧩 Componentes

| Arquivo | Descrição | Usado Em |
|---------|-----------|----------|
| `components/Navbar.tsx` | Barra de navegação | Landing page |
| `components/Sidebar.tsx` | Menu lateral | Dashboard |
| `components/Badge.tsx` | Badge de status | Tabelas e cards |
| `components/LoadingSpinner.tsx` | Indicador de loading | Todas as páginas |

### 🛠️ Utilitários

| Arquivo | Funções Principais |
|---------|-------------------|
| `lib/supabase.ts` | Cliente Supabase + Types |
| `utils/frete.ts` | Cálculo de frete (mock) |
| `utils/formatters.ts` | Formatação (CNPJ, data, moeda, etc) |

### 🗃️ Banco de Dados

| Arquivo | Descrição |
|---------|-----------|
| `supabase/schema.sql` | Schema completo (tabelas, índices, triggers) |
| `supabase/seed.sql` | Dados de teste (8 fornecedores, 25+ produtos) |

### 🎨 Estilos

| Arquivo | Descrição |
|---------|-----------|
| `app/globals.css` | Estilos globais + Tailwind imports |
| `tailwind.config.ts` | Configuração do Tailwind CSS |

### ⚙️ Configuração

| Arquivo | Descrição |
|---------|-----------|
| `package.json` | Dependências e scripts |
| `tsconfig.json` | Configuração TypeScript |
| `next.config.mjs` | Configuração Next.js |
| `postcss.config.mjs` | Configuração PostCSS |
| `.env.local.example` | Template de variáveis de ambiente |
| `.gitignore` | Arquivos ignorados pelo Git |

---

## 📊 Estatísticas do Projeto

```
📁 Arquivos criados:      31
📝 Linhas de código:      1.663
📄 Páginas web:           6
🔌 API endpoints:         2
🧩 Componentes:           4
🗃️ Tabelas SQL:           2
📚 Docs:                  6
```

---

## 🎯 Fluxos de Trabalho

### Setup Inicial

```
1. QUICKSTART.md      → Instruções de instalação
2. .env.local         → Configurar credenciais
3. npm install        → Instalar dependências
4. schema.sql         → Criar tabelas no Supabase
5. seed.sql           → Popular dados de teste
6. npm run dev        → Rodar o projeto
```

### Desenvolvimento

```
1. STRUCTURE.md       → Entender arquitetura
2. app/               → Criar/editar páginas
3. components/        → Criar/editar componentes
4. utils/             → Adicionar funções utilitárias
5. npm run dev        → Testar localmente
```

### Deploy

```
1. DEPLOY.md          → Ler guia de deploy
2. Vercel/GitHub      → Conectar repositório
3. .env production    → Configurar variáveis
4. Deploy             → Publicar
5. Testar             → Validar produção
```

---

## 🔍 Busca Rápida

### "Onde está o código de..."

| Funcionalidade | Localização |
|----------------|-------------|
| Landing page | `app/page.tsx` |
| Tabela de fornecedores | `app/dashboard/page.tsx` |
| Página de dossiê | `app/dashboard/fornecedor/[cnpj]/page.tsx` |
| API de listagem | `app/api/fornecedores/route.ts` |
| API de detalhes | `app/api/fornecedores/[cnpj]/route.ts` |
| Cliente Supabase | `lib/supabase.ts` |
| Calculadora de frete | `utils/frete.ts` |
| Formatação de dados | `utils/formatters.ts` |
| Navbar | `components/Navbar.tsx` |
| Sidebar | `components/Sidebar.tsx` |
| Badges de status | `components/Badge.tsx` |
| Schema do banco | `supabase/schema.sql` |
| Dados de teste | `supabase/seed.sql` |

### "Como eu faço para..."

| Tarefa | Arquivo de Referência |
|--------|----------------------|
| Rodar o projeto | `QUICKSTART.md` |
| Fazer deploy | `DEPLOY.md` |
| Entender a estrutura | `STRUCTURE.md` |
| Ver resumo completo | `PROJECT_SUMMARY.md` |
| Adicionar nova página | `STRUCTURE.md` + `app/dashboard/page.tsx` |
| Adicionar nova API | `app/api/fornecedores/route.ts` |
| Modificar banco | `supabase/schema.sql` |
| Criar componente | `components/Badge.tsx` |

---

## 🎓 Roteiros de Estudo

### Iniciante em Next.js

1. Leia: `GET_STARTED.md`
2. Veja: `app/page.tsx` (componente simples)
3. Veja: `app/dashboard/page.tsx` (com hooks)
4. Veja: `app/api/fornecedores/route.ts` (API route)
5. Leia: `STRUCTURE.md`

### Intermediário

1. Leia: `PROJECT_SUMMARY.md`
2. Analise: Fluxo completo (página → API → banco)
3. Modifique: Adicione novo filtro no dashboard
4. Crie: Nova página no dashboard
5. Leia: `DEPLOY.md`

### Avançado

1. Implemente: Autenticação (Supabase Auth)
2. Adicione: Row Level Security (RLS)
3. Otimize: Performance com cache
4. Integre: API real (Melhor Envio)
5. Deploy: Produção na Vercel

---

## 📖 Glossário de Termos

| Termo | Significado |
|-------|-------------|
| **MVP** | Minimum Viable Product (Produto Mínimo Viável) |
| **SaaS** | Software as a Service |
| **B2B** | Business to Business |
| **RSC** | React Server Components |
| **API Route** | Função serverless do Next.js |
| **Supabase** | Backend as a Service (PostgreSQL) |
| **CNPJ** | Cadastro Nacional da Pessoa Jurídica |
| **Anvisa** | Agência Nacional de Vigilância Sanitária |
| **Dossiê** | Informações completas do fornecedor |

---

## 🔗 Links Úteis

### Documentação Oficial

- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Lucide Icons](https://lucide.dev)

### Deploy

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Supabase Dashboard](https://supabase.com/dashboard)

### Ferramentas

- [VSCode](https://code.visualstudio.com)
- [GitHub Desktop](https://desktop.github.com)
- [Postman](https://www.postman.com) (testar APIs)

---

## 🆘 Troubleshooting Rápido

| Problema | Solução | Onde Ler Mais |
|----------|---------|---------------|
| Erro ao instalar | `rm -rf node_modules && npm install` | `QUICKSTART.md` |
| Supabase error | Verificar `.env.local` | `QUICKSTART.md` |
| Tabela vazia | Executar `seed.sql` | `QUICKSTART.md` |
| Página em branco | Ver console (F12) | `README.md` |
| Erro de TypeScript | `npm run build` | `README.md` |
| Erro no deploy | Verificar env vars | `DEPLOY.md` |

---

## 📞 Próximos Passos

1. **Primeira vez?** → Comece em [`GET_STARTED.md`](./GET_STARTED.md)
2. **Quer rodar?** → Vá para [`QUICKSTART.md`](./QUICKSTART.md)
3. **Quer entender?** → Leia [`PROJECT_SUMMARY.md`](./PROJECT_SUMMARY.md)
4. **Quer desenvolver?** → Estude [`STRUCTURE.md`](./STRUCTURE.md)
5. **Quer publicar?** → Siga [`DEPLOY.md`](./DEPLOY.md)

---

## ✅ Checklist de Validação

Antes de considerar o projeto "dominado":

- [ ] Li `GET_STARTED.md`
- [ ] Rodei o projeto localmente (`npm run dev`)
- [ ] Vi a landing page funcionando
- [ ] Vi o dashboard com fornecedores
- [ ] Abri um dossiê de fornecedor
- [ ] Testei os filtros
- [ ] Testei a busca
- [ ] Li `STRUCTURE.md`
- [ ] Entendi o fluxo (página → API → banco)
- [ ] Fiz deploy (ou sei como fazer)

---

**BeautyProcure** - MVP Completo e Documentado 🚀

*Última atualização: Março 2024*
