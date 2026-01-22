# Tech Stack & Workflow

## Technology Stack

### Frontend
- **Framework:** [Next.js 16](https://nextjs.org/) (App Router).
- **Language:** TypeScript.
- **Styling:** [Tailwind CSS](https://tailwindcss.com/).
- **UI Library:** [shadcn/ui](https://ui.shadcn.com/) (based on Radix UI).
- **Charts:** [Recharts](https://recharts.org/) (via shadcn/ui Charts).
- **Icons:** [Lucide React](https://lucide.dev/).
- **Forms:** `react-hook-form` + `zod`.
- **Drawer/Dialog:** `vaul` (Drawer) for mobile-friendly sheets.
- **Carousel:** `embla-carousel-react` (via shadcn/ui Carousel) for swipeable tabs.

### Backend (BaaS)
- **Platform:** [Convex](https://convex.dev/).
- **Database:** Real-time Document Database (JSON-like).
- **Functions:**
  - `query`: Read data (Reactive, auto-subscribe).
  - `mutation`: Write data (ACID transactions).
  - `action`: Third-party API calls (e.g., Web Push).
  - `internalMutation`: Privileged functions not exposed to client (Used for Crons).
  - `cronJobs`: Scheduled tasks (Hourly/Daily).
- **Scheduling:** `ctx.scheduler` for async tasks (e.g., sending notifications after transaction).

### Authentication
- **Provider:** [Clerk](https://clerk.com/).
- **Integration:** Convex + Clerk integration via JWT.

### PWA (Progressive Web App)
- **Manifest:** `app/manifest.ts`.
- **Service Worker:** `public/custom-sw.js` (for Push Notifications).
- **Library:** `@ducanh2912/next-pwa`.
- **Push:** `web-push` library for VAPID notifications.

---

## Data Flow Architecture

1.  **Client-Side:**
    - Components use `useQuery(api.path.functionName)` to fetch data.
    - Components use `useMutation(api.path.functionName)` to modify data.
    - **No REST API:** We rarely use `fetch()`. Convex handles the WebSocket connection.

2.  **Server-Side (Convex):**
    - **Validation:** All arguments MUST be validated using `v` from `convex/values`.
    - **Auth:** Every public function MUST check `ctx.auth.getUserIdentity()`.
    - **Household Logic:** Most data queries must check `householdId` context.
        - If `householdId` is present -> Query by `by_householdId` index.
        - If `householdId` is missing -> Query by `by_userId` index (Personal).

3.  **Centralized Logic (Important):**
    - To maintain data consistency across Dashboard, Budget, and Transactions, core business logic is centralized in `convex/lib/`.
    - **`convex/lib/finance.ts`:** Contains pure functions for calculating Spending, Unassigned Cash, and Transaction Analysis. **ALWAYS** use these helpers instead of re-writing logic in queries.
    - **`convex/lib/finance.ts` (Fiscal Logic):**
        - `getFiscalDateDetails(date, startDay)`: Converts a Calendar Date to Fiscal Year/Month.
        - `getFiscalMonthRange(year, month, startDay)`: Returns start/end timestamps for a fiscal period.
        - **Critical:** All budget queries MUST use these helpers to support custom start days.
    - **`convex/lib/auth.ts`:** Centralized authorization checks (`ensureHouseholdAccess`).
    - **`convex/lib/constants.ts`:** Constants for Transaction Types, Category Types, Account Types, etc. **NEVER** use string literals (e.g., "expense") directly; import from constants.
    - **`lib/utils.ts` (Frontend):**
        - `formatCurrency`: Centralizes currency formatting and **Privacy Mode** logic. Handles standard bullet masking (`••••`).

4.  **Triggers & Automation:**
    - We don't have DB triggers (like SQL). We use **Application-Level Triggers**.
    - **Atomic Account-Category Mirroring:**
        - Creating a `SAVING` or `ASSET` account -> triggers creation of linked `saving` category.
        - Creating a `saving` category -> triggers creation of linked `SAVING` account.
        - Updating/Deleting one entity automatically propagates to the other.
    - **Auto-Categorization:** Transfer mutations check for destination accounts with `linkedCategoryId` to automatically assign the correct category.
    - **Smart Auto-Budgeting:** Transaction mutations explicitly call `ensureBudgetExists`. *Enhancement:* It now checks for `isGoalDisbursement` flag to prevent inflating budget during goal withdrawals.
    - **Smart Disbursement Detection:** In `convex/transactions.ts`, system automatically detects Transfer from Special Account -> Liquid Account and flags it as `isGoalDisbursement`. This ensures accurate accounting (Neutral/Income effect instead of Negative Spending).
    - **Goal Progress:** Inside `create` and `update` transaction mutations, we explicitly call `checkGoalProgress` to trigger notifications.
    - **Split Transaction Optimization (Search Indexing):**
        - To improve filtering performance, we use a **Denormalized Indexing** strategy.
        - **Schema:** Added `searchCategoryIds` and `searchLabelIds` (Array of Strings) to `transactions` table.
        - **Helper:** `generateSearchTags` in `convex/lib/transactions.ts` extracts all IDs from the main transaction and splits.
        - **Logic:** This helper is called automatically during `create` and `update` mutations to ensure the index is always in sync with the data.
        - **Migration:** A one-off script `convex/migrations.ts:backfillSearchTags` is available to populate this index for existing data.
    - **Reconciliation Optimization:**
        - **Schema:** Added indexes `by_accountId` and `by_toAccountId` to `transactions` table.
        - **Usage:** Used by `getLiquidAccountComposition` to quickly calculate net contribution from Liquid accounts to Goals without full table scans.
    - **Cron Jobs (Auto-Save):**
        - Uses **Native Convex Crons** defined in `convex/crons.ts`.
        - Runs **Hourly** to check `scheduledTransactions` table for due items (`nextRunAt <= Now`).
        - **Logic:** `convex/automations.ts:processDueSchedules`.
        - **Safety:** Checks source account balance before execution. If insufficient funds, it skips the transaction, flags as "failed", sends a **System Notification** to the user, and reschedules for the next period.
    - **Duplicate Prevention (Upsert Strategy):**
        - **Budgets:** When creating/updating Savings via Account logic, the system checks for existing budget entries for the same month/category before inserting. If found, it updates the amount to prevent duplicates.
        - **Auto-Save:** The `upsertSchedule` mutation enforces a "One Schedule Per Goal" rule by checking `linkedEntityId`. It updates the existing schedule instead of creating a new one if a schedule for that goal already exists.

5.  **Performance Optimization:**
    - **Avoid N+1 Queries:** When fetching lists of items with related data (e.g., Transactions with Accounts/Categories), always use **Batch Fetching**.
    - **Pattern:** Collect all IDs first -> `Promise.all(ids.map(ctx.db.get))` -> Map results back. **Do NOT** await `ctx.db.get` inside a loop.
    - **Memoization (Frontend):** Use `useMemo` for heavy client-side grouping or filtering operations (e.g., `TransactionListGrouped`), especially when dealing with large datasets on mobile devices.

## Directory Structure

```
├── app/                 # Next.js App Router
│   ├── (routes)         # page.tsx files
│   ├── layout.tsx       # Root layout + Providers
│   └── globals.css      # Tailwind imports
├── components/          # React Components
│   ├── ui/              # shadcn/ui primitives (Button, Input, etc.)
│   ├── forms/           # Shared form sections (AutoSaveFields, etc.)
│   ├── dashboard/       # Dashboard-specific widgets
│   ├── transactions/    # Transaction-specific components
│   ├── [Feature].tsx    # Shared Feature components (TransactionDrawer, etc.)
│   └── HouseholdProvider.tsx # Context for Household state
├── hooks/               # Custom React Hooks (useGoalCalculator, etc.)
├── convex/              # Backend Logic
│   ├── schema.ts        # Database Schema
│   ├── transactions.ts  # Transaction logic
│   ├── accounts.ts      # Account logic
│   ├── budgets.ts       # Budget logic
│   ├── labels.ts        # Label logic
│   ├── households.ts    # Household logic
│   ├── automations.ts   # Auto-Save & Scheduling logic (NEW)
│   ├── crons.ts         # Cron Job definitions (NEW)
│   ├── lib/             # Shared Business Logic & Helpers (Finance, Auth, Constants)
│   ├── push.ts          # Web Push Actions
│   ├── notifications.ts # In-app notification logic
│   └── _generated/      # Auto-generated Types
├── public/              # Static assets + SW
└── docs/                # Project Documentation
```
