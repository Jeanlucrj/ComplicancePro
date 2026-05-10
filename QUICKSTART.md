# Quick Start - BeautyProcure

Comece a usar o BeautyProcure em menos de 5 minutos!

## ⚡ Setup Rápido (5 minutos)

### 1. Instalar dependências (1 min)

```bash
npm install
```

### 2. Configurar Supabase (2 min)

1. Acesse [supabase.com](https://supabase.com) e crie um projeto
2. Copie URL e chave anon
3. Crie `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Configurar Banco de Dados (2 min)

No Supabase SQL Editor, execute:

```sql
-- Copie e cole o conteúdo de supabase/schema.sql
-- Depois copie e cole o conteúdo de supabase/seed.sql
```

### 4. Iniciar servidor

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## 🎯 Testando as Funcionalidades

### Landing Page
- ✅ Acesse `http://localhost:3000`
- ✅ Veja hero, features e pricing
- ✅ Clique em "Começar Agora"

### Dashboard
- ✅ Acesse `http://localhost:3000/dashboard`
- ✅ Veja tabela com 8 fornecedores
- ✅ Teste filtros (Estado, Status Anvisa)
- ✅ Busque por "Vloss" ou CNPJ

### Dossiê do Fornecedor
- ✅ Clique em "Ver Dossiê" em qualquer fornecedor
- ✅ Veja informações completas
- ✅ Teste calculadora de frete
- ✅ Veja catálogo de produtos

---

## 🚀 Próximos Passos

### Personalizar o projeto

```bash
# Alterar cores do tema
# Edite: tailwind.config.ts

# Adicionar logo
# Coloque em: public/logo.png

# Modificar meta tags
# Edite: app/layout.tsx
```

### Adicionar autenticação

```typescript
// lib/auth.ts
import { supabase } from './supabase';

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}
```

### Integrar API real de frete

```typescript
// utils/frete.ts
export async function calcularFreteReal(cepDestino: string, cepOrigem: string) {
  const response = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: { postal_code: cepOrigem },
      to: { postal_code: cepDestino },
      // ... outros params
    }),
  });
  return response.json();
}
```

---

## 📚 Recursos Úteis

### Documentação
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev)

### Tutoriais
- [Next.js App Router Tutorial](https://nextjs.org/docs/app)
- [Supabase Authentication](https://supabase.com/docs/guides/auth)
- [Tailwind Components](https://tailwindui.com)

---

## 🐛 Problemas Comuns

### Erro: "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Erro: "Supabase client error"
- Verifique `.env.local`
- Confirme que o projeto Supabase está ativo
- Teste conectividade: `curl https://xxx.supabase.co`

### Tabela vazia no dashboard
- Execute `supabase/seed.sql` no SQL Editor
- Verifique se as credenciais estão corretas
- Veja erros no console do navegador (F12)

### Página em branco
- Verifique console do navegador (F12)
- Verifique terminal do Next.js
- Execute `npm run dev` novamente

---

## 💡 Dicas Produtivas

### VSCode Extensions Recomendadas
- ES7+ React/Redux/React-Native snippets
- Tailwind CSS IntelliSense
- Prettier - Code formatter
- ESLint

### Atalhos Úteis
- `Ctrl+P`: Buscar arquivo
- `Ctrl+Shift+P`: Command palette
- `F12`: Ir para definição
- `Shift+F12`: Ver referências

### Scripts NPM
```bash
npm run dev      # Desenvolvimento
npm run build    # Build produção
npm run start    # Rodar produção
npm run lint     # Verificar código
```

---

## 🎨 Customização Rápida

### Mudar cor primária (de azul para verde)

```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      primary: {
        50: '#f0fdf4',
        // ... cores verdes
        600: '#16a34a',  // cor principal
      }
    }
  }
}
```

Depois substitua `blue-600` por `primary-600` nos componentes.

### Adicionar campo ao fornecedor

```sql
-- No Supabase SQL Editor
ALTER TABLE fornecedores ADD COLUMN website VARCHAR(255);
```

```typescript
// lib/supabase.ts
export interface Fornecedor {
  // ... campos existentes
  website: string | null;
}
```

### Criar nova métrica no dashboard

```typescript
// app/dashboard/page.tsx
const fornecedoresRegulares = fornecedores.filter(
  f => f.status_anvisa === 'REGULAR'
).length;

<div className="bg-white p-4 rounded-lg">
  <p className="text-sm text-slate-500">Fornecedores Regulares</p>
  <p className="text-3xl font-bold text-green-600">{fornecedoresRegulares}</p>
</div>
```

---

## 🚢 Deploy em 2 minutos

### Vercel (Mais Rápido)

```bash
# Instale Vercel CLI
npm i -g vercel

# Deploy
vercel

# Adicione env vars quando solicitado
# Deploy completo!
```

### Render.com (Alternativa)

1. Conecte seu GitHub
2. Selecione o repositório
3. Adicione variáveis de ambiente
4. Deploy automático!

---

## 📊 Métricas de Sucesso

Após setup, você deve ter:

- ✅ 8 fornecedores visíveis no dashboard
- ✅ Filtros funcionando (Estado, Status)
- ✅ Busca retornando resultados
- ✅ Dossiê abrindo com produtos
- ✅ Calculadora de frete funcionando
- ✅ UI responsiva no mobile

---

## 🤝 Precisa de Ajuda?

1. Veja `README.md` para documentação completa
2. Veja `STRUCTURE.md` para entender arquitetura
3. Veja `DEPLOY.md` para deploy em produção
4. Abra issue no GitHub do projeto

---

**Pronto para começar? Execute `npm run dev` e boa codificação! 🚀**
