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

