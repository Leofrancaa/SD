# UI Contract

## Business source

PRODUCT.md records the user's brief. All figures are real BMWeb orders read from Supabase by the server; nothing is entered or edited in the browser.

## Canonical UI Map

| Capability | Canonical owner                            | Source of truth | Allowed variants             | Verification          |
| ---------- | ------------------------------------------ | --------------- | ---------------------------- | --------------------- |
| Select     | `Select` (Radix) in `components/ui`        | DESIGN.md       | Compact filter variant       | Browser keyboard      |
| Date       | Native date fields in `real-sales.tsx`     | PRODUCT.md      | OS-owned date popup          | Browser               |
| Toast      | Shared `role=status` banner in `Dashboard` | DESIGN.md       | Export confirmation          | Browser status checks |
| Download   | `downloadFile` in `download.ts`            | UX-CONTRACT.md  | Sales series CSV             | Browser download      |
| Chat       | `BakeryChat` + `/api/chat`                 | UX-CONTRACT.md  | Starter questions, free text | Unit + browser tests  |

## Flow ledger

Sales filters (period preset or custom dates, order status) persist in the URL (`vp`, `vi`, `vf`, `vs`). Each change requests `/api/vendas`; previous data stays dimmed while loading. The screen refreshes every 5 minutes while visible. Comparisons always use the previous period of the same length; a single in-progress day shows no comparison. Days without sales appear as zero. Weekday and hourly averages divide by how many times each weekday occurs in the period. Product quantities in kg are recalculated as value ÷ price because the report rounds weight. Errors explain whether the server is not configured or the request failed, with a retry.

Navigation updates `?view=`, restores focus to the heading and keeps chat history mounted during the session. Users without access to a view land on Sales.

## AI chat

`/api/chat` (admin only) receives only the conversation history. The server calls `getRealSales` (read-only) for any figure and never sends customer data to Groq. Same-origin checks, schema/size limits, bounded steps/output, timeout and per-instance throttling apply. The assistant does not compute profit, margin, waste or stock, states the period used and never claims to change anything. Responses can be wrong; users confirm on the Sales screen.
