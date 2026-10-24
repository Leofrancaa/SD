# Superdeli · Cifrai

Painel de vendas da Superdeli (padaria e delicatessen) com dados reais do caixa, em Next.js App Router, TypeScript e Tailwind CSS. Interface em português do Brasil. Os pedidos vêm do ERP BMWeb, são importados por um pipeline em Python para o Supabase e lidos só pelo servidor do painel.

## Run locally

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Copy `.env.example` to `.env.local` and fill the Supabase variables to see real sales; without them the sales screen explains what is missing. For chat, also set `GROQ_API_KEY`. Never use a `NEXT_PUBLIC_` prefix for this credential. `GROQ_MODEL` optionally overrides the default `openai/gpt-oss-120b`. If the primary model is rate-limited or unavailable before emitting any text, the server makes one bounded attempt with `openai/gpt-oss-20b`; partial responses are never mixed across models.

## Vendas reais (BMWeb → Supabase)

A tela **Vendas** (inicial) lê os pedidos importados do BMWeb pelo pipeline em Python (`Superdeli/pipeline`). O navegador nunca fala com o Supabase: `/api/vendas` confere a sessão, valida o período e chama a função `painel_vendas` com a chave secreta, que só existe no servidor. A função é executável apenas pelo `service_role`; `anon` e `authenticated` não têm acesso. Há cache de 2 min por instância e a tela se atualiza sozinha a cada 5 min.

Indicadores: faturamento, pedidos, **ticket médio**, itens por pedido (com comparação ao período anterior de mesmo tamanho), ritmo diário/semanal/mensal, mapa de calor dia × hora, médias por dia da semana, faixas de ticket, formas de pagamento e ranking de produtos. Pedidos `PENDENTE` aparecem separados e podem ser filtrados.

O chat (só admin) responde com a ferramenta `getRealSales` (somente leitura), que chama a mesma função do banco; o navegador envia apenas o histórico da conversa. Só totais vão para a Groq, sem dados de clientes. Sem custos ou estoque nos dados, a IA não calcula lucro nem margem.

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

Import `Leofrancaa/SD`, select Next.js and use the repository root. The build command is `npm run build`; output detection is automatic. Set `GROQ_API_KEY` as a sensitive server environment variable for production and preview. Redeploy after changing it. Preview and production read the same Supabase project.
