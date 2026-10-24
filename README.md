# Superdeli · Cifrai

A responsive bakery and minimarket management pilot built with Next.js App Router, TypeScript and Tailwind CSS. The interface is Brazilian Portuguese. Thirty days of deterministic synthetic records cover 14 illustrative products: five bakery items and nine resale goods.

## Run locally

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The dashboard works without credentials. For chat, copy `.env.example` to `.env.local` and set `GROQ_API_KEY`. Never use a `NEXT_PUBLIC_` prefix for this credential. `GROQ_MODEL` optionally overrides the default `openai/gpt-oss-120b`. If the primary model is rate-limited or unavailable before emitting any text, the server makes one bounded attempt with `openai/gpt-oss-20b`; partial responses are never mixed across models.

## Vendas reais (BMWeb → Supabase)

A tela **Vendas reais** (inicial para administradores) lê os pedidos importados do BMWeb pelo pipeline em Python (`Superdeli/pipeline`). O navegador nunca fala com o Supabase: `/api/vendas` confere a sessão, valida o período e chama a função `painel_vendas` com a chave secreta, que só existe no servidor. A função é executável apenas pelo `service_role`; `anon` e `authenticated` não têm acesso. Há cache de 2 min por instância e a tela se atualiza sozinha a cada 5 min.

Indicadores: faturamento, pedidos, **ticket médio**, itens por pedido (com comparação ao período anterior de mesmo tamanho), ritmo diário/semanal/mensal, mapa de calor dia × hora, médias por dia da semana, faixas de ticket, formas de pagamento e ranking de produtos. Pedidos `PENDENTE` aparecem separados e podem ser filtrados.

O chat ganha a ferramenta `getRealSales` (somente leitura) quando o Supabase está configurado; a resposta indica no início se usou vendas reais ou dados simulados. Só totais vão para a Groq, sem dados de clientes.

As demais telas continuam sendo a demonstração com dados sintéticos, agrupadas no menu como "Demonstração".

## Login e perfis

Usuários ficam no Supabase (`app.usuarios`, fora da API), com senha em hash **scrypt** (N=2^17). O servidor busca o usuário pela função `auth_usuario` (só `service_role`), compara o hash em tempo constante (inclusive para usuário inexistente) e grava uma sessão em cookie assinado (HMAC, 8 h, `httpOnly`, `secure`, `SameSite=Lax`). O login limita 5 erros por IP e 20 por usuário a cada 15 min (por instância).

| Perfil     | Acesso                                                              |
| ---------- | ------------------------------------------------------------------- |
| `admin`    | Todas as telas, vendas reais, exportação e chat                     |
| `gerencia` | Somente Estoque e reposição; vendas e chat bloqueados também na API |

Criar usuário ou trocar senha: `node scripts/usuario.mjs <usuario> <admin|gerencia> "<Nome>"` e cole o SQL gerado no SQL Editor do Supabase. Bloquear: `update app.usuarios set ativo = false where usuario = '...'`.

Variáveis na Vercel (produção e preview): `AUTH_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_EMPRESA_ID` e `GROQ_API_KEY`. Sem Supabase (desenvolvimento e testes), o login cai para `ADMIN_PASSWORD`/`GERENCIA_PASSWORD`; em `npm run dev` valem `admin`/`admin` e `gerencia`/`gerencia`.

Cabeçalhos de segurança em `next.config.ts` (`frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`). Funções na região `gru1` (São Paulo), perto do banco (`vercel.json`).

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npx playwright test
```

## Deploy to Vercel

Import `Leofrancaa/SD`, select Next.js and use the repository root. The build command is `npm run build`; output detection is automatic. Set `GROQ_API_KEY` as a sensitive server environment variable for production and preview. Redeploy after changing it. Preview and production use the same synthetic dataset.

## Owner workflows

The overview prioritizes restocking, discarded losses, idle goods and shortages, and highlights resale goods that are almost out of stock. The inventory screen includes a sale simulator that deducts a demo sale from the latest count so the alerts, purchase draft and metrics update live. The purchase draft estimates quantities for 3/7/14 days, supports manual review and exports selected items at illustrative purchase cost. Exporting never places an order. The owner report prints to A4 or PDF through the browser, with financial definitions and explicit simulation labels. Comparisons require complete matched periods; drafts are not persisted or sent to chat.

## Demo boundaries

Daily records and reviewed suggestions persist in browser localStorage only. CSV exports provide a portable copy. Storage errors retain entered fields; corrupted saved data is protected from overwrite. Dashboard suggestions are rule-based; the chat uses Groq through a server endpoint. Approval records a planning decision and never changes production automatically. Discarded loss is calculated at production or purchase cost. Retail inventory uses the latest dated closing snapshot, with opening stock and received units recorded separately. Saved legacy bakery records are preserved when the resale catalog is added. Estimated return excludes fixed operating expenses. Revenue, prices, costs and product quantities are illustrative.

Chat history stays in the mounted browser session and is not saved by the application. Questions and synthetic records are sent to Groq for generation; avoid personal data. The server validates records and roles, calculates reports, rejects foreign origins, limits request/history sizes, caps output and tool steps, supports cancellation, and masks provider failures. The in-memory limit is eight requests per minute per IP **per server instance**, not a distributed quota or authentication boundary. Add durable rate limits and authentication before expanding public access or accepting real business data. AI answers can still be wrong; users must review them.

Real sales now come from the BMWeb import (see "Vendas reais"). The production, stock, purchase and report screens remain synthetic until the matching real records exist. Confirm the catalog, costs, operating hours, brand assets and daily workflow with the owner.

Public visual reference supplied by the user: https://www.jacuipenoticias.com/guia/panificadoras/superdeli/superdeli.htm.
