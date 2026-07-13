# Changes Log

<!--
Format:
## YYYY-MM-DD
### Added
### Changed
### Fixed
### Removed
### Docs
-->

## 2026-07-10

### Added
- `getMonthEndProposals` query di `convex/budgets.ts` — lazy query untuk month-end proposal calculation, dipisah dari `getBudgetStatus`
- `docs/changes-log.md` — file perubahan
- `components/MoveFundsDrawer.tsx` — standalone drawer untuk Move Funds, dipisah dari BudgetDrawer
- Back-button history (`window.history.pushState` + `popstate`) + dirty-state AlertDialog di MoveFundsDrawer
- Backend guard: self-transfer validation (`fromCategoryId === toCategoryId`) di `moveBudgetFunds`
- "Move Funds" button di action bar halaman budgets

### Changed
- **`convex/budgets.ts` — `getBudgetAssistance`:** dioptimasi dari 4 full-table `.collect()` (transactions x2, budgets x2) menjadi indexed month-scoped queries. Month-end proposal dipindah ke `getMonthEndProposals`
- **`convex/budgets.ts` — `upsertBudget`:** dioptimasi dari fetch semua budgets menjadi indexed date-range query yang hanya mengambil expense budgets untuk current fiscal period
- **`components/BudgetCard.tsx`:** disederhanakan, menampilkan quick-adjust preset buttons (20%, 50%, 100%) langsung di card tanpa harus buka drawer
- **`app/budgets/page.tsx`:** menampilkan `MonthEndProposalBanner` terpisah dari budget list, hanya muncul saat relevan
- **`AGENTS.md`:** diisi dengan repo-specific guidance (stack, commands, architecture, key patterns)
- **`components/BudgetDrawer.tsx`:** tabs dihapus, hanya Set Limit — tidak lagi mengandung Move Funds
- **`convex/budgets.ts` — `moveBudgetFunds`:** `toCategoryId` jadi optional (support return-to-unassigned), carryoverAmount tidak dimodifikasi (avoid invariant break di `getMonthEndProposals`)
- **`components/MoveFundsDrawer.tsx`:** source dropdown pakai `budgetStatus.unassignedCash` langsung (bukan `assistanceData`), preview card menampilkan remaining budget (bukan effective limit)
- **`convex/budgets.ts` — 6 optimasi DB I/O:**
  - `moveBudgetFunds`: tambah `.gte/.lte` date range di index `by_householdId_date` (sebelumnya full scan → 1 bulan)
  - `sweepBudgets`: ganti index `by_householdId` → `by_householdId_date` + `.gte/.lte` (full scan → 1 bulan)
  - `getBudgetReport`: ganti index `by_householdId` → `by_householdId_date` + range report (full scan → N bulan)
  - `getMonthEndProposals`: pre-fetch current-month budgets + `Map.get()` lookup — hilangkan N+1 sequential query per pacing category
  - `getBudgetStatus`: batch-fetch saving category reset transactions — hilangkan N+1 parallel query per saving category
  - `getBudgetAssistance`: 3 sequential month-range queries → 1 range query + in-memory partition per fiscal month

### Removed
- Move Funds tab dari BudgetDrawer (backend mutation `moveBudgetFunds` tetap ada untuk backward compatibility)

### Docs
- `docs/DATABASE_AND_RELATIONSHIPS.md` — budget fields, formula, Move Funds status, lazy month-end query
- `docs/CACHE_OPTIMIZATION.md` — added "Recent Optimizations" section untuk getBudgetAssistance dan upsertBudget fixes
- `docs/TECH_STACK_AND_WORKFLOW.md` — replaced "Intentional Global Fetching" dan "Fiscal Month Filtering" dengan date-range indexed query pattern
- `docs/PRODUCT_OVERVIEW.md` — update Smart Drawer description (no more Move Funds tab)

## 2026-07-11

### Added
- `hooks/useGoalWizard.ts` — wizard state management hook (step navigation, field updates, validation, dirty-state tracking)
- `components/GoalWizardDrawer.tsx` — main 4-step wizard drawer container with confetti celebration, sound effect, and discard dialog
- `components/GoalWizardStepIndicator.tsx` — step progress UI with dots, step counter, back/close buttons
- `components/GoalWizardSteps/GoalTypeStep.tsx` — Step 1: 3 visual goal type cards (Investment, Bill, Purchase) with auto-advance on select
- `components/GoalWizardSteps/GoalNameTargetStep.tsx` — Step 2: goal name + target amount inputs with currency formatting
- `components/GoalWizardSteps/GoalTimelineStep.tsx` — Step 3: target date + monthly contribution with live projection calculator
- `components/GoalWizardSteps/GoalReviewStep.tsx` — Step 4: review summary card before creation
- `canvas-confetti` dependency — confetti animation for goal creation celebration
- `lib/utils.ts` — `formatNumberInput()` helper for numeric input fields

### Changed
- **`app/goals/page.tsx`:** replaced `CategoryDrawer` with `GoalWizardDrawer` for goal creation flow
- **`components/GoalWizardStepIndicator.tsx`:** removed dead `stepTitle` prop (hardcoded array used internally)
- **`components/GoalWizardSteps/GoalNameTargetStep.tsx`:** use shared `formatNumberInput` from `@/lib/utils`
- **`components/GoalWizardSteps/GoalTimelineStep.tsx`:** use shared `formatNumberInput` from `@/lib/utils`, improved feedback card visibility with larger padding, border, and animation

### Docs
- `docs/PRODUCT_OVERVIEW.md` — added Goal Creation Wizard description
- `docs/PRODUCT_GUIDELINES.md` — added Wizard Pattern section

## 2026-07-13

### Added
- `convex/schema.ts` — `merchants` table (household-only, name + icon) + `merchantId` index on transactions
- `convex/merchants.ts` — CRUD API: get, create, update, deleteMerchant (with transaction usage guard)
- `components/MerchantDrawer.tsx` — create/edit merchant drawer with icon picker (Emojis + Brand Icons via Iconify API), first-letter avatar fallback, back-button + dirty-form-guard patterns
- `components/MerchantCombobox.tsx` — searchable merchant selector with auto-create (first-letter icon on creation)
- `components/MerchantIconPicker.tsx` — tabbed icon picker: Emojis tab + Brand Icons tab (Iconify API search)
- `app/merchants/page.tsx` — merchant management page with search, create, edit, delete (with transaction usage guard)
- Merchant field in `TransactionDrawer` — positioned after Amount, before Account (both mobile and desktop)
- Merchant field in `TransactionFormFields` — added `merchants` prop for mobile transaction form
- `navigator.vibrate(10)` haptic feedback on merchant operations (create/edit/delete)

### Changed
- **`components/TransactionDrawer.tsx`:** merchant selector uses `MerchantCombobox` with inline create option (no separate drawer)
- **`components/TransactionItem.tsx`:** renders 3 icon types: URL icons as `<img>`, letter avatars as colored circles, emojis as text
- **`app/merchants/page.tsx`:** renders all 3 icon types correctly, removed bulk assign feature
- **`convex/merchants.ts` — `deleteMerchant`:** uses indexed query (`by_merchantId`) instead of full table scan
- **`convex/schema.ts`:** added `by_merchantId` index on transactions table

### Removed
- `components/BulkAssignMerchantDialog.tsx` — bulk assign merchant feature removed
- `components/MobileMerchantDrawer.tsx` — replaced by `MerchantCombobox`
- `bulkAssignMerchant` mutation from `convex/transactions.ts`

### Fixed
- `components/MerchantDrawer.tsx` — missing `Id` import, added `navigator.vibrate(10)` on submit
- `components/TransactionDrawer.tsx` — merchant field position corrected (after Amount, before Account)
- `components/MerchantDrawer.tsx` — added back-button handling (`window.history.pushState` + `popstate`) and dirty-state AlertDialog
- `convex/merchants.ts` — `deleteMerchant` now uses indexed query instead of `.filter()` full table scan

### Docs
- `docs/DATABASE_AND_RELATIONSHIPS.md` — added Merchants entity, merchantId index on transactions
- `docs/PRODUCT_OVERVIEW.md` — added Merchant & Payee Tracking feature section
- `docs/PRODUCT_GUIDELINES.md` — added Merchant UX patterns (combobox, icon picker, auto-create)
- `docs/CODE_STYLE_GUIDE.md` — updated backend examples with merchant patterns

## 2026-07-13 (2)

### Added
- Merchant filter in Transactions page filter popover (`TransactionFilters.tsx`)
- `merchantId` parameter in `convex/transactions.ts` queries: `get`, `searchTransactions`, `exportTransactions` (server-side `.filter()`)
- Date badge in active filter badges (shows when date range is set)
- Tooltip on split indicator (`GitBranch` icon) in `TransactionItem.tsx` and `MobileRecentTransactions.tsx` — "Transaksi ini di-split"

### Changed
- **`components/TransactionFilters.tsx`:** Merchant MultiSelect added to filter popover; DateRangePicker moved inside the filter popover (was standalone); `resetAll` now preserves date range
- **`components/TransactionItem.tsx`:** Split indicator wrapped with Radix `Tooltip` for cursor and touch; merchant badge removed, merchant icon shown inline next to merchant name
- **`components/dashboard/MobileRecentTransactions.tsx`:** Merchant icon replaces colored dot; GitBranch split indicator with tooltip; full date group headers ("Hari ini"/"Kemarin"/"DD MMM YYYY"); removed unused `getSplitDescription` function
- **`components/TransactionDrawer.tsx`:** Merchant field enabled for split transactions (removed `{!isSplit}` guard)
- **`components/transactions/ExportTransactionDialog.tsx`:** Export now respects merchant filter

### Fixed
- `components/TransactionFilters.tsx` — Reset/Clear all now preserves date range (was accidentally clearing it)
- `convex/transactions.ts` — `exportTransactions` query now accepts `merchantId` parameter

### Docs
- `docs/PRODUCT_OVERVIEW.md` — updated Filtering section with merchant filter; updated Export section
- `docs/PRODUCT_GUIDELINES.md` — updated Merchant UX section with split tooltip and filter details
- `docs/DATABASE_AND_RELATIONSHIPS.md` — added merchantId to query guidelines

