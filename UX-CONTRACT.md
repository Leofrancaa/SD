# UI Contract

## Business source

PRODUCT.md records the user's pilot brief. Production changes remain the owner's responsibility. The dataset is illustrative; no live financial, customer or employee records are collected.

## Canonical UI Map

| Capability      | Canonical owner                                           | Source of truth | Allowed variants                       | Verification                      |
| --------------- | --------------------------------------------------------- | --------------- | -------------------------------------- | --------------------------------- |
| Select/Listbox  | Native select in dashboard.tsx                            | DESIGN.md       | OS-owned popup                         | Browser keyboard                  |
| Date            | Native date field in dashboard.tsx                        | PRODUCT.md      | OS-owned date popup                    | Browser recording                 |
| Form            | RecordForm in dashboard.tsx and validateRecord in demo.ts | PRODUCT.md      | Daily batch record                     | Domain and browser tests          |
| Scrollbar       | globals.css                                               | DESIGN.md       | Forced-colors system fallback          | Browser computed styles           |
| Toast           | Shared role=status banner in Dashboard                    | DESIGN.md       | Save/export/approval                   | Browser status checks             |
| Table Selection | PurchasePlanner native checkbox selection                 | UX-CONTRACT.md  | Selected purchase draft rows           | Owner browser tests               |
| Print           | OwnerReport and globals.css print rules                   | UX-CONTRACT.md  | Browser print / save PDF               | Print media and PDF browser tests |
| Download        | downloadFile in download.ts                               | UX-CONTRACT.md  | Raw records / reviewed purchase drafts | Download browser tests            |
| CRUD            | useDemoStore and RecordForm                               | PRODUCT.md      | Create or replace same date/product    | Domain and browser tests          |

## Flow ledger

Overview analytics share the global date range and recalculate after local record edits. Product ranking switches between units sold, revenue and estimated return (revenue minus sold-unit cost and discarded-unit cost; fixed expenses excluded). Weekday comparisons average revenue over unique recorded dates of each weekday, never over unobserved days. Production outcomes conserve sold, retained and discarded units. Chart colors are accompanied by visible numbers, labels and accessible summaries. Zero-data charts show zero values and no-data labels without division errors.

Navigation updates the URL section, restores focus to the heading and preserves range/search filters. Recording a batch opens the production screen and focuses the first field. Save validates integer units and conservation, persists first, then updates the app and announces success. Replacing an existing date/product record is explicitly disclosed next to the form. Failed persistence preserves user input and allows retry. Recommendations can be approved for planning or deferred; neither action changes production. CSV exports the current date range and excludes personal data. Saved drafts and decisions live only in the browser.

No deletion, authentication, billing, permissions or cross-device synchronization exist. Corrupt local data falls back to synthetic history with visible feedback and is not silently overwritten. Another browser tab's update triggers a refresh, preventing stale overwrite. Unavailable storage is explained before saving.

## AI chat

The chat uses Groq through `/api/chat`, with secrets confined to server environment variables. Source: the user's explicit request to integrate Groq. The current date range and all available validated browser records accompany each question; server-owned calculations and a read-only date-report tool ground responses. It cannot mutate records or execute business decisions. Provider transmission is disclosed beside the conversation. Responses identify the synthetic dataset, distinguish revenue from estimated return, and do not invent unrecorded expenses, hourly sales or net profit.

Use AI Elements Conversation and MessageResponse for scrolling and safe streaming Markdown. Chat state persists across in-app navigation in the mounted session only. Navigating away aborts active generation. Enter sends, Shift+Enter inserts a newline and IME composition never submits. A stable composer remains editable while generating; stop cancels both ends. Incomplete responses are explicitly marked and excluded from future model history. Failed questions remain available for retry. Live announcements cover state changes without narrating every token. Generated links use the maintained safe renderer, never raw HTML.

Same-origin checks, schema/size limits, bounded steps/output, request timeout and per-instance throttling apply at the server. Unconfigured, rate-limited, offline, timed-out, interrupted and failed requests have distinct recovery text. No credentials, provider payloads or internal reasoning appear in the browser or logs.

## Minimarket inventory

The synthetic catalog includes five bakery products and nine resale products. Resale records explicitly store opening stock and receipts; available units equal their sum. Closing stock deducts sales and recorded discards and carries forward in seeded history. Manual records are independent counts, without rewriting later counts. Stock value uses the latest snapshot per product, never the sum of daily balances. Coverage uses recorded daily sales for the selected period. Expiry dates and cold chain temperatures are unavailable. Existing five-product browser data receives only missing resale product histories, preserving edited records and decisions.

## Owner workflows

OwnerBriefing shows rule-derived priorities from selected-period losses and stockouts and full-history dated inventory. It routes directly to the canonical inventory, purchase, insight and recording screens. Coverage shows recorded product/date keys against the 14-product catalog. Period comparisons require complete matched product/date coverage in both periods; no monthly baseline is invented.

PurchasePlanner owns table selection for purchase drafts, using native checkboxes and labelled integer quantity fields. The native horizon select accepts OS-owned popup behavior. Default quantities use average sales per recorded date times the 3/7/14-day horizon plus minimum stock minus the latest counted inventory. Missing or stale counts, no sales and idle goods have no automatic purchase quantity. Selected quantities must be integers from 1 to 100000. Drafts live in the current screen session; horizon/period changes reset them and the UI explicitly asks users to export for retention. Exports include simulation, draft status, reviewed quantities and illustrative acquisition costs. No order is placed and no stock record changes. Shared downloadFile owns browser downloads; existing raw-record exports use the same utility and shared status banner.

OwnerReport owns the printable summary. The browser print workflow prints only the report, preserving the simulation disclosure, period, costs, estimated return definition, stock-at-cost, completeness and priorities. Table overflow is removed for A4 output. Fixed costs are unavailable, so net profit and realized savings are never claimed. Groq getPurchasePlan uses the same purchase calculations read-only, but cannot see manually edited browser drafts. Document title follows the current section in pt-BR.
