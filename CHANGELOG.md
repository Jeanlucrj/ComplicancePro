# Changelog — Data Control

Histórico de modificações do projeto, organizado por data e sessão de trabalho.
Destinado a LLMs e desenvolvedores que precisam entender o estado atual do sistema.

---

## Contexto do Projeto

- **Nome:** Data Control (anteriormente CompliancePro)
- **Stack:** Next.js 14 (App Router), Supabase, Vercel, Tailwind CSS, TypeScript
- **Domínio:** Compliance de fornecedores para o setor de cosméticos e farmacêuticos no Brasil
- **Repositório:** https://github.com/Jeanlucrj/ComplicancePro
- **Produção:** Vercel (auto-deploy a cada push no branch `main`)
- **Banco de dados:** Supabase (PostgreSQL)

---

## 2026-05-17 — Sessão de melhorias com Claude Code

### [3a39643] Score IA: data persistida no banco + sistema de créditos por dia

**Arquivos modificados:**
- `lib/types.ts` — adicionado campo `score_gerado_em: string | null` à interface `Fornecedor`
- `app/api/fornecedores/[cnpj]/score-ia/route.ts` — lógica de cache 24h + consumo de crédito
- `components/ScoreIACard.tsx` — prop `scoreGeradoEmDb`, exibe custo no botão, trata 429
- `app/dashboard/fornecedor/[cnpj]/page.tsx` — passa `score_gerado_em` para o ScoreIACard

**Lógica implementada:**
- Cada geração de Score IA salva `score_gerado_em` na tabela `fornecedores` (persistente cross-device)
- Dentro de 24h da última geração: atualizar é **gratuito** (botão mostra "Atualizar")
- Após 24h (dia diferente): atualizar **consome 1 crédito** do pool mensal (botão mostra "Atualizar · 1 crédito")
- Se limite mensal atingido: API retorna HTTP 429 com `quota_exceeded: true`
- Créditos de score IA são registrados na tabela `consultas` com `tipo = 'score_ia'`

**SQL necessário (já aplicado no Supabase):**
```sql
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS score_gerado_em timestamptz;
ALTER TABLE public.consultas    ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'enriquecer';
```

---

### [abd7fa7] Fix: Gemini API key adicionada nas variáveis de ambiente da Vercel

**Problema:** Score IA retornava erro `API key expired` em produção.  
**Causa:** A variável `GEMINI_API_KEY` existia no `.env.local` (local) mas não estava configurada na Vercel.  
**Solução:** Variável adicionada manualmente no painel Vercel → redeploy disparado via commit vazio.

---

### [46c2937] Sistema de quota de consultas mensais (Plano Pro = 50/mês)

**Arquivos criados/modificados:**
- `app/api/consultas/route.ts` *(novo)* — GET endpoint: retorna `{ usadas, limite, restantes, plano }`
- `app/api/enriquecer/route.ts` — verifica quota antes de consultar; registra cada consulta bem-sucedida
- `app/dashboard/page.tsx` — barra de progresso colorida + botão desabilitado quando limite atingido

**Lógica implementada:**
- Tabela `consultas` no Supabase rastreia cada avaliação de CNPJ por usuário
- Limite: `plano = 'pro'` → 50/mês; `plano = 'enterprise'` → ilimitado
- Plano definido em `user_metadata.plano` no Supabase Auth (padrão: `'pro'`)
- Reset automático mensal (conta apenas registros do mês corrente via `DATE_TRUNC`)
- Barra de progresso: verde (< 80%) → amarelo (80–99%) → vermelho (100%)
- Graceful degradation: se tabela não existir, sistema continua sem bloquear
- API retorna HTTP 429 com `{ quota_exceeded: true, usadas, limite }`

**SQL necessário (já aplicado no Supabase):**
```sql
CREATE TABLE IF NOT EXISTS public.consultas (
  id         bigserial PRIMARY KEY,
  user_id    uuid      NOT NULL,
  cnpj       text      NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consultas_user_mes ON public.consultas (user_id, created_at);
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
```

**Para promover usuário para Enterprise:**
Supabase → Authentication → editar usuário → `user_metadata` → adicionar `"plano": "enterprise"`

---

### [1322adc] Landing page redesenhada (inspiração DataCrazy)

**Arquivo modificado:** `app/page.tsx`

**Antes:** Hero + 3 features + benefits + pricing + footer simples (4 seções)  
**Depois:** 9 seções completas

| Seção | Descrição |
|---|---|
| Hero | Badge "Plataforma Nº1", headline maior, CTA com ícone |
| Metrics strip | Faixa escura: 500+ empresas, 50k+ fornecedores, 99,9% uptime, 4.9/5 |
| Features × 6 | Expandido de 3 para 6 cards com hover interativo |
| Como funciona | 3 passos numerados sobre fundo escuro |
| Por que escolher | Benefits + 4 trust cards (ANVISA, RF, DOU, WhatsApp) |
| Testimonials × 3 | 3 depoimentos com estrelas preenchidas (era 1) |
| FAQ | 6 perguntas frequentes em cards |
| CTA Banner | Faixa azul com CTA antes do footer |
| Footer | Logo + colunas Produto e Legal |

---

### [31757df] Rebranding: CompliancePro → Data Control + nova logo

**Arquivos modificados (14 arquivos):**
- `components/BrandLogo.tsx` *(novo)* — SVG personalizado: escudo + 3 barras de dados decrescentes
- `components/Sidebar.tsx` — nova logo + texto "Data Control"
- `components/Navbar.tsx` — nova logo + texto "Data Control"
- `app/layout.tsx` — título da aba
- `app/page.tsx` — 3 ocorrências na landing page
- `app/(auth)/login/page.tsx` — logo + texto
- `app/(auth)/signup/page.tsx` — logo + texto
- `app/(auth)/forgot-password/page.tsx` — logo + texto
- `app/(auth)/reset-password/page.tsx` — logo + texto
- `lib/enrichment.ts` — User-Agent header
- `lib/zapi.ts` — mensagens WhatsApp
- `app/api/whatsapp/test/route.ts` — mensagem de teste
- `app/dashboard/fornecedor/[cnpj]/page.tsx` — e-mail fallback
- `app/api/anvisa/sync-opendata/route.ts` — User-Agent header

**Design da logo:** SVG com escudo (controle) + 3 barras horizontais de largura decrescente (dados sendo filtrados). Substitui ícones genéricos `ShieldCheck` e `Package` do lucide-react.

---

### [c7df641] Catálogo ANVISA: filtro de tipos por setor da empresa

**Arquivo modificado:** `app/dashboard/catalogo/page.tsx`

**Mudanças:**
- Importa `useUserProfile` para ler o setor cadastrado da empresa
- Filtro de tipo (Todos / Cosméticos / Medicamentos) exibe apenas a opção do setor da empresa
- Se setor = `'ambos'`: mantém os 3 botões
- Estado `tipo` inicializado automaticamente com o setor da empresa via `useEffect`
- Removido "Dados Abertos" do subtítulo do cabeçalho

---

### [53c4031] Dashboard: tipo de produto filtrado pelo setor da empresa

**Arquivo modificado:** `app/dashboard/page.tsx`

**Mudança:** No card "Avaliar Novo Fornecedor", os botões de tipo (Cosméticos / Medicamentos / Ambos) agora exibem apenas o tipo cadastrado pela empresa no perfil.

**Lógica:**
```tsx
// Se setor específico: mostra só 1 botão
// Se setor 'ambos': mostra os 3
(profileLoaded && userTipoAnvisa !== 'ambos'
  ? [userTipoAnvisa]
  : ['cosmetico', 'medicamento', 'ambos']
).map(tipo => <button>...)
```

**Fonte do setor:** `UserProfileContext` → `user_metadata.tipo_anvisa` (Supabase Auth) com fallback na tabela `fornecedores` (is_perfil=true).

---

## 2026-05-16 — Correções no sistema de scraping ANVISA

### [051c58b] Fix: scrap-on-demand sempre chamado quando force=true

### [6986c5a] Fix: scrap-on-demand tenta múltiplos formatos de parâmetro CNPJ

### [4d8ad8f] Fix: scrap-on-demand busca regularizados com CNPJ completo e raiz (8 dígitos)

### [e6d50b5] Fix: botão Sincronizar ANVISA usa force=true e timeout 55s

### [b876466] Fix: internacionais e AFE usam truncate+insert para evitar duplicatas no CSV

### [fbbfb5f] Fix: desabilitar parecer medicamentos (schema incompatível)

---

## 2026-05-10 — Setup inicial e GitHub Actions

### [4e8c32e] Feat: GitHub Actions para sync automático ANVISA

**Arquivo criado:** `.github/workflows/` — pipeline de sync semanal dos dados ANVISA

### [e22d228] Security: remover credenciais hardcoded dos scripts

### [a24741b] Initial commit: CompliancePro — compliance ANVISA e Receita Federal

---

## Estrutura do Banco de Dados (estado atual)

### Tabelas principais

| Tabela | Descrição |
|---|---|
| `fornecedores` | Fornecedores cadastrados por empresa usuária |
| `anvisa_cosmeticos` | Produtos cosméticos registrados na ANVISA |
| `anvisa_medicamentos` | Medicamentos registrados na ANVISA |
| `dou_feed` | Alertas do Diário Oficial da União |
| `consultas` | Rastreamento de consultas mensais por usuário |

### Colunas relevantes adicionadas em 2026-05-17

```
fornecedores.score_gerado_em  — timestamptz  — data da última geração de Score IA
consultas.tipo                — text          — 'enriquecer' | 'score_ia' (default: 'enriquecer')
```

---

## Variáveis de Ambiente Necessárias

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini AI (Score IA)
GEMINI_API_KEY=          # Google AI Studio — aistudio.google.com/app/apikey

# WhatsApp (Z-API)
ZAPI_INSTANCE_ID=
ZAPI_TOKEN=

# Segurança
CRON_SECRET=             # Usado para autenticar chamadas dos GitHub Actions
```

> **Atenção:** O `.env.local` é apenas para desenvolvimento local. As variáveis de produção devem ser configuradas manualmente no painel da Vercel.

---

## Contexto de Autenticação e Planos

- Autenticação via **Supabase Auth**
- Plano do usuário armazenado em `user_metadata.plano`:
  - `'pro'` (padrão) — 50 consultas/mês
  - `'enterprise'` — ilimitado
- Setor da empresa em `user_metadata.tipo_anvisa`:
  - `'cosmetico'` | `'medicamento'` | `'ambos'`
- Perfil da empresa: registro na tabela `fornecedores` com `is_perfil = true`
