# Migração AbacatePay: Dev Mode → Produção

## O que precisa ser feito para ir a produção

### 1. Trocar a chave de API

No painel da AbacatePay, gere uma chave de **produção** (prefixo `abc_prod_`).

Atualize a variável de ambiente na Vercel:
```
ABACATEPAY_API_KEY = abc_prod_XXXXXXXXXXXX   ← substituir
```

A chave dev atual (`abc_dev_ASfbsaSyWPQhute0kg4Fw2df`) usa `devMode: true` e não cobra ninguém.

---

### 2. Remover o botão de simulação

**Arquivo:** `app/checkout/page.tsx`

Localizar e **deletar** o bloco abaixo (aproximadamente linha 362):

```tsx
{/* Botão de teste — só aparece em devMode */}
{checkout.chargeId && (
  <button
    onClick={async () => {
      const res = await fetch('/api/checkout/simulate', { ... });
      ...
    }}
    className="... text-yellow-400 ..."
  >
    🧪 Simular pagamento (Dev Mode)
  </button>
)}
```

---

### 3. Remover a rota de simulação

**Deletar o arquivo inteiro:**
```
app/api/checkout/simulate/route.ts
```

---

### 4. Configurar o Webhook real

No painel da AbacatePay → Webhooks:
- **URL:** `https://complicance-pro.vercel.app/api/webhook/abacatepay`
- **Secret:** (o mesmo valor de `ABACATEPAY_WEBHOOK_SECRET`)
- **Evento:** `transparent.completed`

O webhook já está implementado em `app/api/webhook/abacatepay/route.ts` e funciona em produção — ele atualiza o Supabase quando o pagamento é confirmado.

---

### 5. Coletar CPF do usuário no checkout (obrigatório em produção)

**Arquivo:** `app/api/checkout/route.ts`

Atualmente o código usa um CPF de teste como fallback:
```ts
...(user.user_metadata?.cpf ? { taxId: user.user_metadata.cpf } : { taxId: '11144477735' }),
```

Em produção, o CPF deve ser real. Opções:
- **Opção A:** Adicionar campo CPF no formulário de identificação do checkout (`app/checkout/page.tsx` — etapa 1)
- **Opção B:** Coletar CPF na tela de perfil e salvar em `user_metadata.cpf` antes do checkout

---

### 6. Coletar WhatsApp/telefone do usuário (recomendado)

O campo `cellphone` também usa fallback `'11999999999'`. Ideal coletar o número real no cadastro.

---

## Resumo dos arquivos que precisam de atenção

| Arquivo | Ação |
|---|---|
| `app/checkout/page.tsx` | Remover bloco do botão 🧪 |
| `app/api/checkout/simulate/route.ts` | **Deletar arquivo** |
| `app/api/checkout/route.ts` | Substituir CPF/telefone de fallback por dados reais |
| Vercel env vars | Trocar `ABACATEPAY_API_KEY` pela chave de produção |
| AbacatePay dashboard | Verificar webhook configurado com URL correta |

---

## O que JÁ está pronto para produção (não precisa mexer)

- `app/api/webhook/abacatepay/route.ts` — webhook funcional
- `app/api/checkout/route.ts` — payload correto para AbacatePay v2
- `app/api/checkout/status/route.ts` — polling de status
- `scripts/create-assinaturas-table.sql` — tabela já criada no Supabase
- Fluxo 2 etapas no checkout (identificação → pagamento)
- Redirect para `/dashboard/perfil?novo=true` após pagamento confirmado
