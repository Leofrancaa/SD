# Superdeli · Cifrai

A responsive bakery and minimarket management pilot built with Next.js App Router, TypeScript and Tailwind CSS. The interface is Brazilian Portuguese. Thirty days of deterministic synthetic records cover 14 illustrative products: five bakery items and nine resale goods.

## Run locally

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The dashboard works without credentials. For chat, copy `.env.example` to `.env.local` and set `GROQ_API_KEY`. Never use a `NEXT_PUBLIC_` prefix for this credential. `GROQ_MODEL` optionally overrides the default `openai/gpt-oss-120b`. If the primary model is rate-limited or unavailable before emitting any text, the server makes one bounded attempt with `openai/gpt-oss-20b`; partial responses are never mixed across models.

## Login e perfis

Sem banco de dados: um usuário por perfil, senha em variável de ambiente e sessão em cookie assinado (HMAC, 8 h).

| Usuário    | Acesso                                                    |
| ---------- | --------------------------------------------------------- |
| `admin`    | Todas as telas, exportação e chat                         |
| `gerencia` | Somente Estoque e reposição; chat bloqueado também na API |

Defina `AUTH_SECRET` (32+ caracteres), `ADMIN_PASSWORD` e `GERENCIA_PASSWORD` na Vercel (produção e preview). Sem elas o login fica bloqueado. Em `npm run dev` valem os padrões `admin`/`admin` e `gerencia`/`gerencia`. Os dados sintéticos ainda vão no bundle do navegador, então a restrição da gerência é de interface; com dados reais, filtre no servidor.

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

Before using real records, add authentication, an authorized shared database, audited data imports and backup procedures. Confirm the catalog, costs, operating hours, brand assets and daily workflow with the owner.

Public visual reference supplied by the user: https://www.jacuipenoticias.com/guia/panificadoras/superdeli/superdeli.htm.
