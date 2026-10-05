# Superdeli · eia

A responsive bakery management pilot built with Next.js App Router, TypeScript and Tailwind CSS. The interface is Brazilian Portuguese. Thirty days of deterministic synthetic records cover five illustrative products.

## Run locally

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No environment variables or API keys are required.

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

Import `Leofrancaa/SD`, select Next.js and use the repository root. The build command is `npm run build`; output detection is automatic. No environment variables are required. Preview and production use the same synthetic dataset.

## Demo boundaries

Daily records and reviewed suggestions persist in browser localStorage only. CSV exports provide a portable copy. Storage errors retain entered fields; corrupted saved data is protected from overwrite. Suggestions are rule-based, with no connected AI provider. Approval records a planning decision and never changes production automatically. Discarded loss is calculated at production cost. Estimated return excludes fixed operating expenses. Revenue, prices, costs and product quantities are illustrative.

Before using real records, add authentication, an authorized shared database, audited data imports and backup procedures. Confirm the catalog, costs, operating hours, brand assets and daily workflow with the owner.

Public visual reference supplied by the user: https://www.jacuipenoticias.com/guia/panificadoras/superdeli/superdeli.htm.
