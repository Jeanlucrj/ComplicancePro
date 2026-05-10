# Estrutura Completa do Projeto BeautyProcure

Visualização detalhada de todos os arquivos e suas responsabilidades.

```
BeautyProcure/
│
├── 📁 app/                                    # Next.js App Router
│   │
│   ├── 📁 api/                                # API Routes (Serverless)
│   │   └── 📁 fornecedores/
│   │       ├── route.ts                       # GET /api/fornecedores (lista)
│   │       └── 📁 [cnpj]/
│   │           └── route.ts                   # GET /api/fornecedores/[cnpj] (detalhes)
│   │
│   ├── 📁 dashboard/                          # Área autenticada
│   │   ├── layout.tsx                         # Layout com Sidebar
│   │   ├── page.tsx                           # Busca de fornecedores (tabela)
│   │   │
│   │   ├── 📁 fornecedor/
│   │   │   └── 📁 [cnpj]/
│   │   │       └── page.tsx                   # Dossiê completo do fornecedor
│   │   │
│   │   ├── 📁 materiais/
│   │   │   └── page.tsx                       # Meus materiais (placeholder)
│   │   │
│   │   └── 📁 alertas/
│   │       └── page.tsx                       # Alertas (placeholder)
│   │
│   ├── layout.tsx                             # Root Layout (HTML, body, metadata)
│   ├── page.tsx                               # Landing Page (home)
│   └── globals.css                            # Estilos globais + Tailwind
│
├── 📁 components/                             # Componentes React reutilizáveis
│   ├── Navbar.tsx                             # Barra de navegação (landing)
│   ├── Sidebar.tsx                            # Menu lateral (dashboard)
│   ├── Badge.tsx                              # Badge de status (Regular/Suspensa)
│   └── LoadingSpinner.tsx                     # Indicador de carregamento
│
├── 📁 lib/                                    # Bibliotecas e configurações
│   └── supabase.ts                            # Cliente Supabase + Types
│
├── 📁 utils/                                  # Funções utilitárias
│   ├── frete.ts                               # Simulador de API Melhor Envio
│   └── formatters.ts                          # Formatação (CNPJ, data, moeda, etc)
│
├── 📁 supabase/                               # Scripts SQL
│   ├── schema.sql                             # Criação de tabelas e índices
│   └── seed.sql                               # Dados fictícios (8 fornecedores)
│
├── 📁 public/                                 # Arquivos estáticos
│   └── (vazio - adicione imagens aqui)
│
├── 📄 Arquivos de Configuração
│   ├── package.json                           # Dependências e scripts
│   ├── tsconfig.json                          # Configuração TypeScript
│   ├── tailwind.config.ts                     # Configuração Tailwind CSS
│   ├── postcss.config.mjs                     # Configuração PostCSS
│   ├── next.config.mjs                        # Configuração Next.js
│   ├── .env.local.example                     # Template de variáveis de ambiente
│   └── .gitignore                             # Arquivos ignorados pelo Git
│
└── 📄 Documentação
    ├── README.md                              # Documentação principal
    ├── DEPLOY.md                              # Guia de deploy
    └── STRUCTURE.md                           # Este arquivo
```

## 📋 Descrição Detalhada dos Arquivos

### Rotas e Páginas

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `app/page.tsx` | `/` | Landing page com hero, features e pricing |
| `app/dashboard/page.tsx` | `/dashboard` | Tabela de fornecedores com filtros |
| `app/dashboard/fornecedor/[cnpj]/page.tsx` | `/dashboard/fornecedor/12.345.678-0001-90` | Dossiê completo do fornecedor |
| `app/dashboard/materiais/page.tsx` | `/dashboard/materiais` | Documentos salvos (em desenvolvimento) |
| `app/dashboard/alertas/page.tsx` | `/dashboard/alertas` | Alertas de compliance (em desenvolvimento) |

### API Routes

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/fornecedores` | GET | Lista fornecedores com filtros (estado, busca, status) |
| `/api/fornecedores/[cnpj]` | GET | Retorna dossiê completo + produtos do fornecedor |

### Componentes

| Componente | Onde é usado | Descrição |
|------------|--------------|-----------|
| `Navbar` | Landing page | Navegação principal com logo e CTAs |
| `Sidebar` | Dashboard | Menu lateral fixo com navegação |
| `Badge` | Tabela e dossiê | Badge colorido de status (Regular/Suspensa) |
| `LoadingSpinner` | Todas as páginas | Indicador de carregamento |

### Utilitários

| Arquivo | Funções Principais |
|---------|-------------------|
| `lib/supabase.ts` | `supabase` (cliente), types `Fornecedor` e `Produto` |
| `utils/frete.ts` | `calcularFreteEstimado()`, `formatarCEP()`, `validarCEP()` |
| `utils/formatters.ts` | `formatarCNPJ()`, `formatarData()`, `formatarMoeda()`, `getStatusColor()` |

### Banco de Dados

| Tabela | Registros | Descrição |
|--------|-----------|-----------|
| `fornecedores` | 8 | Dados dos fornecedores (CNPJ, razão social, status Anvisa, etc) |
| `produtos_catalogo` | 25+ | Produtos oferecidos pelos fornecedores |

## 🎨 Fluxo de Dados

```
┌─────────────┐
│  Usuário    │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│   Landing Page      │  ← app/page.tsx
│   (Next.js SSR)     │  ← components/Navbar.tsx
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Dashboard         │  ← app/dashboard/page.tsx
│                     │  ← components/Sidebar.tsx
└──────┬──────────────┘
       │ fetch()
       ▼
┌─────────────────────┐
│  API Route          │  ← app/api/fornecedores/route.ts
│  /api/fornecedores  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Supabase          │  ← lib/supabase.ts
│   (PostgreSQL)      │  ← supabase/schema.sql
└─────────────────────┘
```

## 🔄 Ciclo de Vida de uma Requisição

### Exemplo: Buscar fornecedores

1. **Usuário** acessa `/dashboard`
2. **React** renderiza `app/dashboard/page.tsx`
3. **useEffect** dispara fetch para `/api/fornecedores?estado=SP`
4. **API Route** (`app/api/fornecedores/route.ts`) recebe requisição
5. **Supabase Client** (`lib/supabase.ts`) consulta PostgreSQL
6. **Dados** retornam como JSON
7. **useState** atualiza estado do componente
8. **UI** re-renderiza com dados

## 📦 Dependências Principais

```json
{
  "dependencies": {
    "@supabase/supabase-js": "Cliente para PostgreSQL",
    "lucide-react": "Ícones SVG otimizados",
    "next": "Framework React com SSR/SSG",
    "react": "Biblioteca UI",
    "react-dom": "Renderização React"
  },
  "devDependencies": {
    "typescript": "Tipagem estática",
    "tailwindcss": "CSS utility-first",
    "@types/*": "Tipos TypeScript"
  }
}
```

## 🎯 Pontos de Entrada

### Para desenvolvedores Front-end
- Comece em `app/page.tsx` (landing)
- Veja componentes em `components/`
- Estilos em `app/globals.css` e classes Tailwind

### Para desenvolvedores Back-end
- Comece em `app/api/fornecedores/route.ts`
- Veja configuração Supabase em `lib/supabase.ts`
- Scripts SQL em `supabase/`

### Para designers
- Paleta de cores: `slate` (neutro) + `blue` (primário)
- Ícones: Lucide React
- Tipografia: System fonts (Apple, Segoe UI, etc)

## 🔧 Modificações Comuns

### Adicionar nova página

1. Crie `app/nova-pagina/page.tsx`
2. Exporte componente React
3. Acesse via `/nova-pagina`

### Adicionar nova API route

1. Crie `app/api/nova-rota/route.ts`
2. Exporte função `GET`, `POST`, etc
3. Acesse via `/api/nova-rota`

### Adicionar nova coluna no banco

1. Edite `supabase/schema.sql`
2. Execute ALTER TABLE no Supabase SQL Editor
3. Atualize type `Fornecedor` em `lib/supabase.ts`

---

**Dica**: Use Ctrl+P (VSCode) para busca rápida de arquivos!
