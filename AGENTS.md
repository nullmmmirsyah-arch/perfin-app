<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Perfin — Personal Finance Tracker

## Stack
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + shadcn/ui (new-york style, zinc base)
- **Backend:** Convex (realtime document DB, WebSocket, no REST)
- **Auth:** Clerk (JWT issuer domain in `convex/auth.config.ts`)
- **PWA:** `@ducanh2912/next-pwa` (`public/custom-sw.js`, disabled in dev)

## Commands
- `npm run dev --webpack` / `npm run build --webpack` — must use `--webpack` (Turbopack not supported)
- `npm run lint` — ESLint only. No typecheck or test scripts exist

## Convex Backend (`convex/`)
- **Schema** at `convex/schema.ts` — read first for indexes and field shapes
- Queries/mutations per feature file (`budgets.ts`, `transactions.ts`, `dashboard.ts`, etc.)
- Shared logic in `convex/lib/`: `finance.ts` (spending/cash/budget helpers), `constants.ts` (no magic strings), `auth.ts`, `recomputeCache.ts`
- Every public function must call `ctx.auth.getUserIdentity()`
- **Currency:** stored as `v.string()` — parse via `parseAmount()` from `convex/lib/finance.ts` (backend) or `@/lib/utils` (frontend)
- **Formatting:** `formatCurrency()` from `@/lib/utils` — handles privacy mode (`••••`)
- **Dates:** ISO strings. Always normalize to 12:00 PM noon local time before sending
- **Constants:** import from `convex/lib/constants.ts` — never write `"expense"`, `"saving"`, `"CASH"` inline
- **Household branching:** every query uses `by_householdId_*` or `by_userId_*` index based on `householdId`
- **Date-range queries:** use composite index (`by_userId_date` / `by_householdId_date`) with `.gte/.lte` — never `.collect()` + JS filter
- **Cache hook:** financial mutations must call `recomputeUserCache(ctx, userId, householdId)` after DB ops

## Component Patterns
- Use `Drawer` (vaul, `@/components/ui/drawer`) for all forms, not modals
- `DatePicker` from `@/components/ui/date-picker` — don't build custom date pickers
- Every drawer: `useRef(false)` lock + `isProcessing` for double-click prevention; `navigator.vibrate(10)` on submit; `window.history.pushState` + `popstate` for back-button; `formState.isDirty` + AlertDialog before close; reset locks in `useEffect` on `open`

## Must-Read Docs (`docs/`)
- `TECH_STACK_AND_WORKFLOW.md` — data flow, performance, fiscal month logic
- `CODE_STYLE_GUIDE.md` — naming, drawer lifecycle, formatting rules
- `DATABASE_AND_RELATIONSHIPS.md` — budget formulas, month-end, receivables
- `CACHE_OPTIMIZATION.md` — userCaches table, when to use cache vs direct query
- `PRODUCT_OVERVIEW.md` — features and business rules
- `PRODUCT_GUIDELINES.md` — UX patterns and visual style
- `changes-log .md` - Changes log
