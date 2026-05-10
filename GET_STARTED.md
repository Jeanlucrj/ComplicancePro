# 🚀 BeautyProcure - Comece Aqui!

Bem-vindo ao **BeautyProcure**! Este guia vai te orientar pelos primeiros passos.

---

## 📦 O que você tem aqui?

Um MVP completo de SaaS B2B para homologação de fornecedores de cosméticos com:

- ✅ **1.663 linhas de código** (TypeScript + SQL)
- ✅ **6 páginas web** funcionais
- ✅ **2 API endpoints** prontos
- ✅ **8 fornecedores** de teste
- ✅ **25+ produtos** cadastrados
- ✅ **Documentação completa** (5 arquivos)

---

## 🎯 Seu Próximo Passo

### Opção 1: Setup Completo (5 minutos)

Se você quer rodar o projeto localmente:

👉 **Leia**: [`QUICKSTART.md`](./QUICKSTART.md)

Você vai:
1. Instalar dependências
2. Configurar Supabase
3. Rodar o projeto
4. Ver tudo funcionando!

### Opção 2: Apenas Explorar (2 minutos)

Se você quer apenas entender o projeto:

👉 **Leia**: [`PROJECT_SUMMARY.md`](./PROJECT_SUMMARY.md)

Você vai ver:
- Funcionalidades implementadas
- Estrutura de arquivos
- Stack tecnológica
- Métricas do projeto

### Opção 3: Deploy em Produção (10 minutos)

Se você quer colocar no ar agora:

👉 **Leia**: [`DEPLOY.md`](./DEPLOY.md)

Você vai:
1. Fazer deploy na Vercel
2. Configurar variáveis de ambiente
3. Ter uma URL pública funcionando

---

## 📚 Guia de Documentação

Aqui está TODA a documentação disponível:

| Arquivo | O que você vai encontrar | Tempo de leitura |
|---------|--------------------------|------------------|
| **[README.md](./README.md)** | Documentação principal completa | 10 min |
| **[QUICKSTART.md](./QUICKSTART.md)** | Setup rápido em 5 minutos | 5 min |
| **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** | Visão geral do projeto | 8 min |
| **[STRUCTURE.md](./STRUCTURE.md)** | Arquitetura e estrutura de arquivos | 12 min |
| **[DEPLOY.md](./DEPLOY.md)** | Guia de deploy em produção | 10 min |

**Total**: ~45 minutos de leitura para dominar o projeto completo.

---

## 🗺️ Mapa do Projeto

### Front-end (Páginas)

```
┌─────────────────────────────────────────┐
│  Landing Page (/)                       │
│  • Hero + Features + Pricing            │
│  Arquivo: app/page.tsx                  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Dashboard (/dashboard)                 │
│  • Tabela de fornecedores                │
│  • Filtros + Busca                       │
│  Arquivo: app/dashboard/page.tsx        │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Dossiê (/dashboard/fornecedor/[cnpj])  │
│  • Informações completas                 │
│  • Catálogo de produtos                  │
│  • Calculadora de frete                  │
│  Arquivo: app/dashboard/fornecedor/     │
│           [cnpj]/page.tsx                │
└─────────────────────────────────────────┘
```

### Back-end (APIs)

```
┌─────────────────────────────────────────┐
│  GET /api/fornecedores                  │
│  • Lista com filtros                     │
│  Arquivo: app/api/fornecedores/route.ts │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  GET /api/fornecedores/[cnpj]           │
│  • Dossiê + Produtos                     │
│  Arquivo: app/api/fornecedores/         │
│           [cnpj]/route.ts                │
└─────────────────────────────────────────┘
```

### Banco de Dados

```
┌─────────────────┐       ┌──────────────────────┐
│  fornecedores   │──────<│  produtos_catalogo   │
│  (8 registros)  │ 1:N   │  (25+ registros)     │
└─────────────────┘       └──────────────────────┘
```

---

## 🎨 Preview Visual

### Landing Page
```
┌────────────────────────────────────────┐
│  BeautyProcure                 [Login] │
├────────────────────────────────────────┤
│                                        │
│   Homologação de Fornecedores          │
│   de Cosméticos em Segundos            │
│                                        │
│   [Começar Agora]  [Agendar Demo]      │
│                                        │
├────────────────────────────────────────┤
│  ✓ Compliance Anvisa                   │
│  ✓ Saúde Fiscal                        │
│  ✓ Inteligência Logística              │
├────────────────────────────────────────┤
│  Plano Pro: R$ 147/mês                 │
│  Plano Enterprise: R$ 497/mês          │
└────────────────────────────────────────┘
```

### Dashboard
```
┌─────────┬──────────────────────────────┐
│ [Menu]  │  Buscar Fornecedores         │
│         ├──────────────────────────────┤
│ Buscar  │  [Busca] [Estado▼] [Status▼] │
│ Materias│                               │
│ Alertas │  ┌─────────────────────────┐ │
│         │  │ Fornecedor | Local | ... │ │
│         │  ├─────────────────────────┤ │
│ [User]  │  │ Vloss | SP | [Dossiê]   │ │
│         │  │ Beleza Pura | RJ | ...  │ │
└─────────┴──└─────────────────────────┘─┘
```

---

## 🔥 Quick Commands

Copie e cole no terminal:

```bash
# 1. Instalar tudo
npm install

# 2. Criar arquivo de ambiente
cp .env.local.example .env.local
# (Edite .env.local com suas credenciais Supabase)

# 3. Rodar o projeto
npm run dev

# 4. Abrir no navegador
# Acesse: http://localhost:3000
```

---

## 🎓 Aprenda Explorando

### Para entender React/Next.js
- Comece em: `app/page.tsx` (landing page)
- Veja: `components/Navbar.tsx` (componente simples)
- Depois: `app/dashboard/page.tsx` (hooks, state)

### Para entender APIs
- Comece em: `app/api/fornecedores/route.ts`
- Veja: `lib/supabase.ts` (configuração)
- Depois: `utils/frete.ts` (lógica de negócio)

### Para entender Banco de Dados
- Comece em: `supabase/schema.sql`
- Veja: `supabase/seed.sql` (dados)
- Depois: Execute no Supabase SQL Editor

---

## 🎯 Objetivos de Aprendizado

Ao explorar este projeto, você vai aprender:

### Front-end
- [x] Next.js 14 App Router
- [x] React Server Components
- [x] Client Components ("use client")
- [x] TypeScript com React
- [x] Tailwind CSS
- [x] Lucide Icons
- [x] Responsive design

### Back-end
- [x] Next.js API Routes
- [x] Serverless functions
- [x] PostgreSQL queries
- [x] Supabase client
- [x] Error handling
- [x] Query params

### DevOps
- [x] Environment variables
- [x] Git best practices
- [x] Deploy ready
- [x] Documentation

---

## 💡 Dicas para Iniciantes

### Se você é novo em Next.js

1. **Comece pela landing page**: `app/page.tsx`
   - É um componente React simples
   - Veja como funciona JSX
   - Note o uso do Tailwind CSS

2. **Depois vá para o dashboard**: `app/dashboard/page.tsx`
   - Veja o uso de `useState` e `useEffect`
   - Entenda como fazer fetch de dados
   - Note o "use client" no topo

3. **Por último, veja as APIs**: `app/api/fornecedores/route.ts`
   - São funções JavaScript simples
   - Recebem request, retornam JSON
   - Conectam com Supabase

### Se você é novo em TypeScript

- Veja os `interface` em `lib/supabase.ts`
- Note os tipos em funções (`string`, `number`, etc)
- TypeScript é JavaScript com tipos - tranquilo!

### Se você é novo em Tailwind

- Classes como `bg-blue-600` = background azul
- Classes como `px-4 py-2` = padding horizontal/vertical
- Classes como `hover:bg-blue-700` = estilo no hover
- [Tailwind Docs](https://tailwindcss.com/docs) é seu amigo!

---

## 🆘 Precisa de Ajuda?

### Erro ao rodar `npm install`

```bash
# Limpe tudo e reinstale
rm -rf node_modules package-lock.json
npm install
```

### Erro "Module not found"

- Certifique-se de estar na pasta do projeto
- Execute `npm install` novamente

### Erro "Supabase client error"

- Verifique se `.env.local` existe
- Verifique se as credenciais estão corretas
- Veja: `QUICKSTART.md` seção "Configurar Supabase"

### Dashboard vazio (sem fornecedores)

- Execute `supabase/seed.sql` no SQL Editor do Supabase
- Veja: `QUICKSTART.md` seção "Configurar Banco de Dados"

---

## 🎉 Você está pronto!

Escolha seu próximo passo:

1. 🏃‍♂️ **Quero rodar agora** → [`QUICKSTART.md`](./QUICKSTART.md)
2. 📖 **Quero entender primeiro** → [`PROJECT_SUMMARY.md`](./PROJECT_SUMMARY.md)
3. 🚀 **Quero fazer deploy** → [`DEPLOY.md`](./DEPLOY.md)
4. 🏗️ **Quero ver arquitetura** → [`STRUCTURE.md`](./STRUCTURE.md)
5. 📚 **Quero ler tudo** → [`README.md`](./README.md)

---

## 📊 Status do Projeto

```
✅ MVP Completo
✅ Código de Produção
✅ Documentação Completa
✅ Pronto para Deploy
✅ Pronto para Customização
```

---

**Feito com Next.js, React, TypeScript e Supabase** 🚀

Desenvolvido como MVP demonstrativo de SaaS B2B moderno.

**Bora codar!** 💻
