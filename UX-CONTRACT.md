# UI Contract

## Business source

PRODUCT.md records the user's pilot brief. Production changes remain the owner's responsibility. The dataset is illustrative; no live financial, customer or employee records are collected.

## Canonical UI Map

| Capability     | Canonical owner                                           | Source of truth | Allowed variants                    | Verification             |
| -------------- | --------------------------------------------------------- | --------------- | ----------------------------------- | ------------------------ |
| Select/Listbox | Native select in dashboard.tsx                            | DESIGN.md       | OS-owned popup                      | Browser keyboard         |
| Date           | Native date field in dashboard.tsx                        | PRODUCT.md      | OS-owned date popup                 | Browser recording        |
| Form           | RecordForm in dashboard.tsx and validateRecord in demo.ts | PRODUCT.md      | Daily batch record                  | Domain and browser tests |
| Scrollbar      | globals.css                                               | DESIGN.md       | Forced-colors system fallback       | Browser computed styles  |
| Toast          | Shared role=status banner in Dashboard                    | DESIGN.md       | Save/export/approval                | Browser status checks    |
| CRUD           | useDemoStore and RecordForm                               | PRODUCT.md      | Create or replace same date/product | Domain and browser tests |

## Flow ledger

Overview analytics share the global date range and recalculate after local record edits. Product ranking switches between units sold, revenue and estimated return (revenue minus sold-unit cost and discarded-unit cost; fixed expenses excluded). Weekday comparisons average revenue over unique recorded dates of each weekday, never over unobserved days. Production outcomes conserve sold, retained and discarded units. Chart colors are accompanied by visible numbers, labels and accessible summaries. Zero-data charts show zero values and no-data labels without division errors.

Navigation updates the URL section, restores focus to the heading and preserves range/search filters. Recording a batch opens the production screen and focuses the first field. Save validates integer units and conservation, persists first, then updates the app and announces success. Replacing an existing date/product record is explicitly disclosed next to the form. Failed persistence preserves user input and allows retry. Recommendations can be approved for planning or deferred; neither action changes production. CSV exports the current date range and excludes personal data. Saved drafts and decisions live only in the browser.

No deletion, authentication, billing, permissions, remote requests or cross-device synchronization exist. Corrupt local data falls back to synthetic history with visible feedback and is not silently overwritten. Another browser tab's update triggers a refresh, preventing stale overwrite. Unavailable storage is explained before saving.
