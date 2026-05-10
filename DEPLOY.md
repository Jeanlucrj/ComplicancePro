# Guia de Deploy - BeautyProcure

Este documento fornece instruções para fazer deploy do BeautyProcure em produção.

## 🚀 Deploy na Vercel (Recomendado)

A Vercel é a plataforma oficial para deploy de aplicações Next.js e oferece integração perfeita.

### Passo a Passo

1. **Crie uma conta na Vercel**
   - Acesse [vercel.com](https://vercel.com)
   - Faça login com GitHub, GitLab ou Bitbucket

2. **Faça push do código para um repositório Git**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - BeautyProcure MVP"
   git remote add origin <seu-repositorio>
   git push -u origin main
   ```

3. **Importe o projeto na Vercel**
   - No dashboard da Vercel, clique em "Add New Project"
   - Selecione seu repositório
   - A Vercel detectará automaticamente que é um projeto Next.js

4. **Configure as variáveis de ambiente**

   Na seção "Environment Variables", adicione:
   ```
   NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
   ```

5. **Deploy**
   - Clique em "Deploy"
   - Aguarde alguns minutos
   - Sua aplicação estará disponível em `https://seu-projeto.vercel.app`

### Deploy Automático

Após o primeiro deploy, a Vercel automaticamente:
- Faz rebuild e redeploy a cada push na branch `main`
- Cria preview deployments para Pull Requests
- Fornece URLs exclusivas para cada deploy

## 🐳 Deploy com Docker

### Dockerfile

Crie um arquivo `Dockerfile` na raiz:

```dockerfile
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

### Comandos Docker

```bash
# Build
docker build -t beautyprocure .

# Run
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=sua_url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave \
  beautyprocure
```

## ☁️ Outras Opções de Deploy

### Netlify

1. Conecte seu repositório Git à Netlify
2. Configure build command: `npm run build`
3. Configure publish directory: `.next`
4. Adicione variáveis de ambiente
5. Deploy!

### AWS Amplify

1. No console da AWS Amplify, conecte seu repositório
2. Configure variáveis de ambiente
3. A Amplify detectará automaticamente Next.js
4. Deploy!

### DigitalOcean App Platform

1. Crie um novo app na DigitalOcean
2. Conecte seu repositório
3. Configure variáveis de ambiente
4. Escolha o plano (a partir de $5/mês)
5. Deploy!

## 🔒 Checklist de Segurança para Produção

Antes de fazer deploy em produção, certifique-se de:

- [ ] Nunca commitar o arquivo `.env.local`
- [ ] Usar HTTPS em produção (Vercel já inclui)
- [ ] Configurar Row Level Security (RLS) no Supabase
- [ ] Implementar rate limiting nas API routes
- [ ] Adicionar autenticação de usuários
- [ ] Configurar CORS adequadamente
- [ ] Monitorar logs de erro
- [ ] Configurar backup do banco de dados

## 📊 Monitoramento

### Vercel Analytics

Adicione ao projeto (gratuito até 100k events/mês):

```bash
npm install @vercel/analytics
```

Em `app/layout.tsx`:

```tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Sentry (Monitoramento de Erros)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

## 🔧 Configurações de Performance

### Next.js Config

Adicione em `next.config.mjs`:

```javascript
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['seu-dominio.com'],
  },
  // Para deploy standalone (Docker)
  output: 'standalone',
};
```

### Otimizações Supabase

1. **Ative o Connection Pooling** no painel do Supabase
2. **Configure índices** conforme uso em produção
3. **Ative Row Level Security (RLS)**

## 🌍 Domínio Customizado

### Na Vercel

1. Vá em Settings > Domains
2. Adicione seu domínio
3. Configure DNS conforme instruções
4. SSL é configurado automaticamente

### DNS Records

```
Type: CNAME
Name: www (ou @)
Value: cname.vercel-dns.com
```

## 📈 Escalabilidade

### Limites Gratuitos

- **Vercel Free**: 100GB bandwidth, 100 deployments/dia
- **Supabase Free**: 500MB database, 2GB bandwidth, 50k queries/mês

### Quando escalar

Considere upgrade quando atingir:
- 10.000+ usuários ativos/mês
- 1M+ API requests/mês
- 1GB+ de dados no banco

## 🔄 CI/CD

### GitHub Actions (Exemplo)

Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID}}
          vercel-project-id: ${{ secrets.PROJECT_ID}}
```

## 📝 Pós-Deploy

Após o deploy, teste:

1. [ ] Landing page carrega corretamente
2. [ ] Dashboard exibe fornecedores
3. [ ] Filtros funcionam
4. [ ] Página de dossiê abre
5. [ ] Calculadora de frete funciona
6. [ ] Responsividade mobile
7. [ ] Performance (Lighthouse > 90)

## 🆘 Suporte

Em caso de problemas:

1. Verifique logs na plataforma de deploy
2. Teste variáveis de ambiente
3. Confirme que o Supabase está acessível
4. Revise as configurações de build

---

Feito com Next.js e Supabase 🚀
