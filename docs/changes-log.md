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

## 2026-07-25

### Changed
- **Month-end page data flow — proposals derived from `budgetData`:** Hapus query `getMonthEndProposals` dari month-end page. Proposals sekarang di-derive langsung dari `budgetData.data` (yang sudah di-fetch untuk Steps 1-3) menggunakan `useMemo`. Eliminasi timezone/date mismatch antara client dan server. Satu sumber data, konsisten.
- **Rollover dedup check:** Tambah `currentBudgetData` query (current fiscal month) untuk cek apakah rollover sudah diproses. Kalau `currentBudget.carryoverAmount` sudah match `sisa`, proposal rollover tidak ditampilkan lagi.
- **Banner condition:** Banner "Review & Process" di budgets page sekarang tampil kalau `budgetData.data.length > 0` (ada budget bulan lalu), bukan `monthEndProposals.length > 0`. Alasan: user perlu review performa meskipun tidak ada action sweep/rollover.
- **Banner text dinamis:** Subtitle banner tampilkan action count kalau ada proposals, atau "Review your previous period performance" kalau tidak ada.

### Fixed
- **Fiscal month calculation:** `prevMonth` di month-end page sekarang pakai `getFiscalDateDetails(now, budgetStartDay)` bukan `new Date().getMonth()`. Sebelumnya dengan `budgetStartDay=25`, July 25 → calendar month 6 → prevMonth 5 (June). Sekarang → fiscal month 7 (August) → prevMonth 6 (July). Data yang ditampilkan sekarang benar.
- **Import path:** `getFiscalDateDetails` diimport dari `@/lib/finance-utils` (client), bukan `convex/lib/finance` (server).
- **Negative amount colors:** Di ConfirmStep, amount < 0 (overspent) sekarang tampil dengan warna `destructive` (merah), bukan `success` (hijau). Checkbox, text, dan toggle button juga pakai warna merah untuk negatif.

### Removed
- **`MonthEndProcessDialog.tsx`:** Dihapus. Seluruh logic dipindah ke `/budgets/month-end` page.
- **Dead code di `budgets/page.tsx`:** Hapus `handleSweep`, `showMonthEndDialog`, `isProcessingMonthEnd` state, `processMonthEnd` useMutation, dan test button.
- **Query `getMonthEndProposals` dari month-end page:** Tidak lagi dipanggil dari client. Query masih ada di backend untuk backward compatibility.

### Docs
- **Spec `2026-07-24-month-end-experience-page-design.md`:** Update data flow section — hapus referensi ke `getMonthEndProposals` query, ganti dengan derived proposals dari `budgetData`. Hapus testing mode section. Update step descriptions.
- **Spec `2026-07-24-fix-handlesweep-month-and-atomic-processing.md`:** Tambah note bahwa `MonthEndProcessDialog` sudah dihapus dan logic ada di `/budgets/month-end` page.

## 2026-07-24

### Fixed
- **Bug: `moveBudgetFunds` — "Insufficient Unassigned Cash" error saat seharusnya cukup.** `calculateUnassignedCash` dipanggil tanpa data spending, sehingga semua alokasi budget dianggap belum terpakai. Unassigned terhitung jauh lebih kecil dari kenyataan (bahkan negatif). Sama juga terjadi di `getBudgetAssistance` dan `upsertBudget`.
- **Bug: `getUnassignedCash` — cache hanya berlaku untuk bulan saat ini.** Cache `userCaches.unassignedCash` dihitung untuk bulan fiscal sekarang. Jika user set budget untuk bulan lain (misal bulan depan), validasi pakai unassigned yang salah. Fix: bulan sekarang → baca cache; bulan lain → hitung langsung dengan spending data.
- **Bug: `handleSweep` proses bulan yang salah.** `handleSweep` menggunakan `selectedDate` (bulan yang dilihat user di UI) untuk hitung bulan sebelumnya. Jika user navigasi ke bulan berbeda, sweep/rollover diproses untuk bulan yang salah. Fix: gunakan `currentFiscalDate` (waktu aktual).
- **Bug: Sweep + rollover tidak atomic.** `handleSweep` memanggil `sweepBudgets` dan `rolloverBudgets` sebagai dua mutation terpisah. Jika sweep sukses tapi rollover gagal, state menjadi tidak konsisten. Fix: buat `processMonthEnd` mutation yang menggabungkan keduanya dalam satu transaksi.

### Changed
- **`convex/budgets.ts` — `getUnassignedCash` helper:** fungsi baru yang handle dua case: (1) bulan sekarang → baca dari `userCaches` (1 DB read), (2) bulan lain → hitung langsung dengan fetch transactions + spending data (fallback). Ketiga function (`getBudgetAssistance`, `upsertBudget`, `moveBudgetFunds`) sekarang pakai helper ini.
- **`convex/budgets.ts` — `upsertBudget`:** hapus `Promise.all` yang bungkus 1 query, hapus fetch `accounts` yang tidak dipakai.
- **`convex/budgets.ts` — `getBudgetAssistance`:** hapus dead code `targetBudgets` query yang tidak dipakai setelah refactor ke cache.
- **`convex/budgets.ts` — `processMonthEnd` mutation baru:** Menggabungkan sweep + rollover dalam satu transaksi atomic. `handleSweep` sekarang panggil satu mutation ini alih-alih dua mutation terpisah. Mutation existing (`sweepBudgets`, `rolloverBudgets`) tetap tersedia untuk use case lain.

## 2026-07-23

### Added
- **Motion animations di TransactionDrawer & MobileAmountInput:** Staggered field entrance, spring press feedback, pulse on amount change, shake on overspent warning.
- **Motion animations di Budgets page:** Mobile header fade-in, month-end banner fade-in, expense/savings summary cards fade-in, budget cards stagger entrance.
- **Motion animations di Transactions page:** Page header fade-in, controls toolbar fade-in, list view fade-in, analytics view fade-in.
- **`lib/animations.ts`:** Tambah `drawerFieldStagger`, `drawerFieldItem`, `shake` variants.
- **`components/mobile-amount-input.tsx`:** Numpad buttons `motion.button` + `whileTap` spring; amount display pulse via `useAnimation` controls; overspent `AnimatePresence` fade; Done button spring feedback.
- **`components/TransactionDrawer.tsx`:** Form fields wrapped `motion.div` + `drawerFieldStagger`; submit buttons wrapped `motion.div` + `whileTap` spring; overspent warning wrapped `motion.div` + `shake`.
- **`components/TransactionDrawer.tsx` — TransferFormFields:** Added `drawerFieldStagger` + `drawerFieldItem` motion wrappers for consistency with Expense/Income tabs.

### Fixed
- **Bug: AnimatePresence cause focus loss di MobileAmountInput.** Menggunakan `key={displayAmount}` menyebabkan remount input setiap keystroke. Fix: gunakan `useAnimation` controls dengan imperative `triggerPulse()` calls.
- **Bug: `motion.button` invalid di framer-motion v12.** `motion` namespace tidak punya `Button`. Fix: wrap Radix Button dengan `motion.div` wrapper.

### Changed
- **`docs/CODE_STYLE_GUIDE.md`:** Tambah section "Motion & Animation" dengan patterns dan rules.

### Removed
- **`lib/animations.ts`:** Hapus `amountPulse` dan `tabContent` exports yang tidak terpakai.

### Added
- **Timezone support untuk fiscal period:** Backend sekarang gunakan `getServerNow(timezone)` alih-alih `new Date()` (UTC) untuk menentukan fiscal period. Period transisi terjadi di tengah malam waktu user, bukan tengah malam UTC.
- **`convex/schema.ts`:** Tambah field `timezone` (IANA string, default "Asia/Jakarta") dan `timezoneMode` ("manual" | "device") di households table.
- **`convex/lib/finance.ts`:** Tambah `getServerNow(timezone)` — compute "now" berdasarkan IANA timezone, normalize ke noon untuk hindari edge case. Tambah `getFiscalConfig(household)` — extract `{ startDay, timezone }` dari household.
- **`components/TimezoneSettings.tsx`:** Komponen timezone picker dengan toggle Device/Manual mode di Preferences page.
- **`app/preferences/page.tsx`:** Tambah section "Timezone" dengan TimezoneSettings component.
- **Timezone picker di Household Settings:** User bisa pilih WIB/WITA/WIT atau timezone lain.

### Changed
- **`convex/budgets.ts` (5 locations):** Semua query yang gunakan `new Date()` untuk fiscal period sekarang pakai `getServerNow(household?.timezone)`.
- **`convex/dashboard.ts` (2 locations):** `getDashboardSummary` dan `getMonthlyTrends` gunakan timezone-aware "now".
- **`convex/transactions.ts` (1 location):** `getExpensesTrend` gunakan timezone-aware "now".
- **`convex/categories.ts` (5 locations):** Semua query fiscal period gunakan `getServerNow`.
- **`convex/accounts.ts` (3 locations):** Auto-budget creation gunakan timezone-aware "now".
- **`convex/households.ts`:** `updateSettings`, `create`, `getOrCreateDefault` handle `timezone` dan `timezoneMode`. Default timezone "Asia/Jakarta" dan mode "device" untuk household baru.
- **`docs/TECH_STACK_AND_WORKFLOW.md`:** Updated fiscal logic section dengan `getServerNow` dan `getFiscalConfig`.
- **`docs/DATABASE_AND_RELATIONSHIPS.md`:** Tambah timezone fields di households section.
- **`docs/CODE_STYLE_GUIDE.md`:** Updated date handling rules — backend pakai `getServerNow`, frontend normalize ke noon.
- **`docs/PRODUCT_GUIDELINES.md`:** Updated timezone safety section.

### Fixed
- **Bug: Period terlambat 7 jam untuk user WIB.** Sebelumnya backend pakai `new Date()` yang return UTC time. User di WIB (UTC+7) jam 00:00 tanggal 25 → server masih lihat tanggal 24. Sekarang backend compute timezone user, period transisi tepat di tengah malam waktu user.

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

## 2026-07-19

### Fixed
- **`components/LabelCombobox.tsx`:** nested `<button>` hydration error — inner remove button (×) diganti dari `<button>` ke `<span role="button">` + Space key `preventDefault()` karena `<button>` tidak boleh jadi descendant `<button>` lain (PopoverTrigger)

### Changed
- **`convex/lib/finance.ts` — `calculateUnassignedCash`:** rumus diubah menjadi `cash - sum(max(0, (amount + carryover) - spent))`. Carryover ditambahkan ke amount karena merupakan uang yang di-reserve dari bulan sebelumnya dan masih dialokasikan untuk kategori tersebut. Jika total (amount + carryover) sudah habis terpakai, remaining = 0 (di-cap). Parameter `spendingByCategory` ditambahkan untuk menyediakan data spent per kategori
- **`convex/dashboard.ts`:** obligation breakdown (expense/saving) diselaraskan dengan formula baru — `obligation = allocated - swept`
- **`convex/budgets.ts`:**
  - `getBudgetStatus`: `thisMonthBudgeted` diubah dari `(allocated + carryover - swept)` menjadi `sum(amount)` — hanya alokasi baru bulan ini
  - `getBudgetAssistance`: hapus query `targetTransactions` yang tidak dipakai
  - `upsertBudget`: hapus query `transactions` dan `categories` yang tidak dipakai
  - `moveBudgetFunds`: hapus query `allTx` (all-time transactions) dan `categories` yang tidak dipakai

### Removed
- Dead DB queries: 3 query transaction fetches (`targetTransactions` di `getBudgetAssistance`, `allTransactions` di `upsertBudget`, `allTx` di `moveBudgetFunds`) dan 3 category fetches yang tidak lagi diperlukan

