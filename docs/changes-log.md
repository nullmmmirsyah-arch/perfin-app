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

## 2026-08-02

### Fixed
- **Goal wizard/action drawer text sizes:** Standardized `text-[10px]` to `text-xs` (12px) across GoalActionDrawer, QuickSaveWidget, and AutoSaveFields for consistency with DESIGN.md type ramp
- **Goal wizard success animation:** Replaced dated `animate-bounce` with `animate-in fade-in zoom-in-95` on success overlay in GoalWizardDrawer
- **GoalActionDrawer loading state:** Added Skeleton loader when accounts data is loading to prevent empty state flash

### Changed
- **GoalActionDrawer subtitle styling:** Restored `uppercase tracking-wider` on Auto-Save subtitle for visual consistency

## 2026-07-31

### Added
- **Sprint 2 — UX Foundation: Trust & Clarity:** consistent loading/empty/error/form states across 6 core screens.
  - **`components/ui/empty-state.tsx`:** new `variant` prop (`default` | `compact` | `illustrated`), `secondaryAction`, `secondaryActionLabel`, backward-compatible `compact` prop mapping.
  - **`components/ui/error-state.tsx`:** `title` now required, new `description`, `icon` props; `onRetry`/`action`/`secondaryAction` retained. All callers updated (7 dashboard fallbacks + `error-boundary.tsx` default).
  - **`components/TransactionDrawer.tsx`:** inline submit-error banner (form stays intact, input preserved) with Try Again retry; loading skeletons for categories/accounts; category helper text; EmptyState for no-category/no-account relations; submit label now `Save Changes` / `Save Expense`.

### Changed
- **Dashboard / Transactions / Budgets / Categories Detail pages:** empty divs → `EmptyState` (illustrated for page-level, compact for widgets), `ErrorBoundary` + `ErrorState` fallbacks with specific titles, PageHeader copy tightened, toast copy "deleted" → "removed".
- **`components/BudgetDrawer.tsx`:** helper text for budget amount + weekly reset note.
- **`app/transactions/page.tsx`:** `ErrorState` fallback now includes required `title`/`description`.

### Removed
- **`hooks/use-content-state.ts`:** deleted during final review — no screen consumed it (screens use `ErrorBoundary` + ad-hoc branching). Reintroduce only if repeated branching patterns emerge.

### Docs
- **`docs/CODE_STYLE_GUIDE.md`:** added EmptyState / ErrorState / ErrorBoundary / loading-state / helper-text conventions to the Reusable Components section.
- **`docs/PRODUCT_GUIDELINES.md`:** expanded Feedback System section with empty/error state variant rules, inline form-submit error banner pattern, and submit-button label conventions (Save Expense / Save Changes / Cancel / Keep Editing).

## 2026-08-01

### Changed
- **AllocationProgressCard — "Move Funds" button always visible:** Tombol "Move Funds" sekarang selalu tampil meskipun semua budget sudah teralokasi penuh (unassigned = 0). Saat fully allocated, tombol berubah menjadi "Rebalance Budgets" (outline variant) agar user bisa memindahkan dana antar kategori.

### Added
- **Accessibility hardening for Transactions page:** Comprehensive a11y improvements across page, filters, list, and item components.
  - `prefers-reduced-motion` support: all animations wrapped with `motion-safe:animate-in motion-reduce:animate-none` variants
  - Touch targets: filter badge X buttons (`min-h-[28px] min-w-[28px]`), clear search button, expand chevron, "Clear filter" buttons all meet minimum touch target guidelines
  - ARIA: `aria-label="Search transactions"` on search input, `role="region" aria-label="Transaction details"` on expandable container, `aria-expanded` on expand toggle
  - Heading hierarchy: date group headings changed from `<h3>` to `<h2>` to fix H1→H3 skip
  - Font sizes: `text-[0.5rem]` → `text-[0.625rem]` to match DESIGN.md Micro type ramp
  - Design token: `muted-foreground` darkened from `oklch(0.5510)` to `oklch(0.48)` for better contrast (~4.8:1 → ~6:1) across `globals.css`, `DESIGN.md`, and `.impeccable/design.json`
- **Load More loading state:** "Load More" and "Load all transactions" buttons now show "Loading..." text and disable during fetch to prevent duplicate requests
- **Analytics data completeness framing:** Analytics tab "Load all" message clarified to "Showing X of more transactions. Load all for a complete analytics picture."

### Changed
- **`components/TransactionFilters.tsx`:** Filter badge X buttons use clean `min-h-[28px] min-w-[28px] -mr-1` touch targets (replaced broken `-m-3` negative margin hack); date format `id-ID` → `en-US`; "Clear all" button `h-6` → `h-8`; filter trigger gets `hover:shadow-sm` transition
- **`components/TransactionItem.tsx`:** Expand button `min-h-11 min-w-11` → `h-8 w-8` (appropriate for inline list control); card gets `hover:shadow-md` for interaction affordance
- **`components/transactions/TransactionListGrouped.tsx`:** Sticky date headers `py-3` → `py-2`, `font-bold` → `font-semibold`; "Clear filter" buttons get `min-h-8 px-2` touch targets
- **`app/transactions/page.tsx`:** Page padding `p-8` → `p-6`; analytics section spacing `space-y-2` → `space-y-3`

### Fixed
- **Mixed-language tooltip:** `TransactionItem.tsx` split transaction tooltip changed from Indonesian "Transaksi ini di-split" to English "This transaction is split across multiple categories"

### Docs
- **`docs/PRODUCT_GUIDELINES.md`:** Updated Split Indicator tooltip text to English
- **`docs/CODE_STYLE_GUIDE.md`:** Added Accessibility Patterns section with `prefers-reduced-motion` and touch target guidelines

### Added
- **Dashboard GoalsProgressCard:** New dedicated card between Budget per Category and Balance tabs showing all savings goals with dual progress bars (Overall + Monthly) and "Tabung" quick-save buttons. Replaces inline QuickSaveWidget in Goals tab.
  - `components/dashboard/GoalsProgressCard.tsx` — new component with GoalActionDrawer integration
  - Shows total funds, per-goal progress (accumulated/targetAmount + spent/limit), status badges (Done!, On Track, Needs Attention)
  - "Tabung" button hidden for achieved goals
  - Empty state: card hidden entirely when no active goals
- **GoalActionDrawer enhancements:** Quick-fill buttons (25%/50%/100%), balance preview (before/after), insufficient balance warning, fixed label from "Value Spent" to Indonesian
  - `components/goals/GoalActionDrawer.tsx` — added sourceBalance/goalBalance state, handleQuickFill, balance calculations
- **GoalCard Quick Save CTA:** Added "Tabung Sekarang" button to GoalCard when gap between monthly target and contribution exists
  - `components/GoalCard.tsx` — new onQuickSave prop, quickSaveGap calculation, CTA box
- **Auto-Save recommendation CTA on Goal Detail:** Enhanced auto-save card with recommendation card, "Nanti saja" dismiss, GoalWizardDrawer integration
  - `app/goals/[id]/page.tsx` — recommendation card, context-appropriate collapsed state message
- **Budgets Savings Tab CTAs:** Added "Tabung" and "Detail" buttons to savings BudgetCards in budgets page
  - `app/budgets/page.tsx` — GoalActionDrawer integration, quick save handler
  - `components/BudgetCard.tsx` — new linkedAccountId and onQuickSave props

### Changed
- **GoalSummary redesigned (Option B layout):** Each goal now shows two progress bars — Overall (accumulated/targetAmount) and Monthly (spent/limit) — with status badges and dividers between goals
  - `components/dashboard/GoalSummary.tsx` — complete rewrite with dual progress, icons, badges
- **QuickSaveWidget shows all goals:** Removed `.slice(0, 3)` limit — all active goals now displayed sorted by urgency
  - `components/dashboard/QuickSaveWidget.tsx` — removed top-3 limit, empty state uses plain div instead of Card
- **MobileDashboardTabs Goals tab:** Simplified to show only GoalSummary (QuickSaveWidget moved to GoalsProgressCard)
  - `components/dashboard/MobileDashboardTabs.tsx` — removed QuickSaveWidget import and Card wrapper from Goals tab

### Fixed
- **Tax goal status not achieved:** Tax goal was fully withdrawn (balance=0) with `isGoalDisbursement: true` transaction but status remained "active" — `markAsAchieved` was never called. Fixed by setting status to "achieved" via Convex mutation.
- **BudgetCard treating savings goals as expense:** Savings goals with empty `targetAmount` (e.g., Emas investment) were rendered with expense-style budget view showing "over budget" red styling. Fix: `isGoal` now checks `category.type === 'saving'` regardless of `targetAmount`. `isOverBudget` border only applies to non-goal categories.
- **GoalActionDrawer isDeposit reference error:** `Cannot access 'isDeposit' before initialization` — variable was declared at line 168 but used at lines 99/105/108. Fix: moved declaration to line 66 (after `isAsset`).
- **TypeScript build errors:** `item.targetAmount` possibly undefined in GoalSummary, `goal.gapSuggestion` not on EnrichedGoal type in QuickSaveWidget. Fixed with fallback values and inline recalculation.

### Docs
- **`docs/PRODUCT_OVERVIEW.md`:** Updated Goals section with GoalsProgressCard, dual progress bars, and auto-save recommendation CTA
- **`docs/PRODUCT_GUIDELINES.md`:** Added Goals Dashboard Pattern section
- **`docs/DATABASE_AND_RELATIONSHIPS.md`:** Updated BudgetCard section with savings goal behavior

## 2026-07-29

### Fixed
- **`lib/allowance-calculator.ts` — `daysRemaining` inconsistent time-of-day:** `Math.floor((fiscalPeriodEnd - now) / msPerDay) + 1` menggunakan `now` mentah (ex: 12:00 siang), menyebabkan `daysRemaining` undercount 1 hari karena `fiscalPeriodEnd` adalah midnight (`getFiscalMonthRange` return `new Date(year, month, day)` tanpa komponen jam). Contoh: `now = 29 Jul 12:00`, `end = 24 Agt 00:00` → diff = 25,5 → `floor(25,5)+1 = 26` (harusnya 27). Fix: normalize `now` ke start-of-day (`nowStart.setHours(0,0,0,0)`) sebelum hitung. Sama pada `daysRemainingInWeek` line 162.
- **`lib/allowance-calculator.ts` — `daysRemainingInWeek` inconsistent time-of-day:** Same root cause. Now uses `nowStart` (normalized) instead of raw `now`.
- **Timezone gap di 4 area non-fiscal:** Semua `new Date().toISOString()` yang sebelumnya lolos audit sekarang pakai `getServerNow(timezone)`:
  - **Initial Balance transaction** (`convex/accounts.ts`) — transaksi awal akun baru pakai timezone user
  - **Goal reset & completion** (`convex/categories.ts`) — `completedDate` dan `lastResetDate` sinkron dengan timezone user
  - **Recurring overdue/upcoming** (`convex/recurring.ts`) — `currentDay` untuk filter overdue dihitung dari timezone user, bukan UTC
  - **Cron auto-save** (`convex/automations.ts`) — transaction date di set ke noon timezone user, bukan noon UTC. Offset DST dihitung di `schedule.nextRunAt` bukan `Date.now()`

### Changed
- **`docs/CODE_STYLE_GUIDE.md`:** Expanded Date Handling section — mencakup semua konteks yang butuh timezone (bukan cuma fiscal period)

### Added
- **Transaction success view (Sprint 1 — Confidence-Driven UX):** After saving a new expense, the form inside `TransactionDrawer`/`Sheet` is replaced with a success view showing:
  - Green checkmark + "Expense recorded" confirmation
  - "Remaining Budget" hero number with count-up animation (500ms eased cubic via `requestAnimationFrame`)
  - Affected category's remaining budget (secondary, only if category has budget)
  - Transaction summary (amount at category name)
  - Contextual budget feedback message (color-coded: green=healthy, yellow=moderate, orange=low, red=exceeded)
  - Auto-dismiss after 3s, returning to home
- **`lib/budget-feedback.ts`:** `computeBudgetStatus()` helper with thresholds (>50% healthy, >25% moderate, >0% low, ≤0 exceeded) and `BUDGET_FEEDBACK_MESSAGES` map
- **`components/TransactionSuccessView.tsx`:** Success view component with entry animation (`fadeIn` + `scale 0.95→1`), checkmark pop animation, and count-up effect
- **Step state management in `TransactionDrawer`:** `"form"` → `"success"` step transition, `savedData` state, `handleDismiss` with `useCallback` for stable auto-dismiss timer

### Changed
- **`components/TransactionDrawer.tsx`:**
  - Submit handler now distinguishes expense creates from other types — expense creates compute optimistic budget data and show success view; income/transfer/edits keep existing toast behavior
  - Budget data computed optimistically from existing `budgetStatus` query (`categories.reduce` with `|| []` guard)
  - `isDirty` reset on save success to prevent "Discard changes?" dialog on dismiss
  - `handleDismiss` routes through `handleOpenChangeWrapper` with `isLocked` guard
- **Auto-dismiss timing:** 3000ms (was 1500ms in initial implementation)

### Fixed
- **`lib/budget-feedback.ts`:** `remaining <= 0` → `remaining < 0` — exact budget spend (`remaining === 0`) now correctly shows "low" instead of "exceeded"

## 2026-07-28

### Fixed
- **`daysRemaining` and `daysRemainingInWeek` off-by-one error in `AllowanceCalculator`:** Both used `Math.round(diffMs / msPerDay) + 1` which overcounted by 1 when the remaining time was less than 0.5 days but still the same calendar day. Example: user at 09:51 on the last day of a week → `Math.round(0.589) + 1 = 2` instead of correct `1`. Fix: `Math.round` → `Math.floor`. `Math.floor(0.589) + 1 = 1` ✅.
- **`segment.days` inflation in `splitIntoWeekSegments`:** Same `Math.round(...) + 1` bug caused segment day counts to be inflated by 1 (e.g., 5-day week computed as 6). This inflated `weeklyAllowance` and daily allowance shown to users. Fix: `Math.round` → `Math.floor` at lines 63 and 78.

### Fixed
- **`custom-sw.js` notification click opens browser tab instead of installed PWA:** `notificationclick` handler used `clients.openWindow()` which always opens a new browser tab. Fix: use `clients.matchAll({ type: 'window' })` to find existing PWA client window, `focus()` it, then `navigate()` to target URL. Falls back to `openWindow()` if no PWA window is open.
- **`custom-sw.js` unreturned navigate promise:** `client.navigate()` was not returned from the `.then()` callback, so `event.waitUntil()` resolved before navigation completed. Fix: added `return` keyword.
- **`custom-sw.js` redundant `'focus' in client` guard:** Removed — `clients.matchAll({ type: 'window' })` only returns `WindowClient` instances which always have `focus()`.

### Changed
- **`app/manifest.ts`:** Added `scope: '/'` and `display_override: ['window-controls-overlay', 'standalone']` so the OS correctly associates push notifications with the installed PWA rather than the browser.
- **`convex/push.ts` — `sendNotification`:** Added optional `url` parameter in args and payload, enabling deep-linking from notification clicks.
- **`convex/transactions.ts`:** Household transaction push notifications now include `url: '/dashboard'` for deep-linking.

### Docs
- Updated `DATABASE_AND_RELATIONSHIPS.md`: Added "Days Remaining Calculation" section documenting the `Math.floor` formula and why `Math.round` was incorrect.

## 2026-07-27

### Fixed
- **Merchant icon URL displaying as text in mobile transaction drawer:** `TransactionDrawer` was always concatenating `selectedMerchant.icon` into `valueDisplay` text. When merchant uses an Iconify URL as icon, the entire URL appeared as text. Fix: only include icon character for non-URL icons (emoji/letter), skip for URL icons.
- **Category "Available" preview showing wrong budget period:** `TransactionDrawer` used calendar `getMonth()`/`getFullYear()` to fetch budget status, ignoring the household's `budgetStartDay`. When `budgetStartDay` is e.g. 25, a transaction on Jan 20th fetched January's budget instead of December's fiscal period. Fix: use `getFiscalDateDetails()` from `lib/finance-utils` to compute fiscal month/year, consistent with all other budget-aware components (`BudgetCard`, `CategoryDrawer`, dashboard widgets).

### Changed
- **`MobileHeroSummary` daily allowance now respects per-category `allowanceType`:** Replaced simple `remainingBudget / daysRemaining` with aggregated per-category `calculateAllowance()` that honors each category's `allowanceType` (budget_period/weekly). Filters to `expense` categories with `enablePacing !== false`. Categories using weekly mode now contribute their weekly-calculated allowance instead of flat monthly average.
- **`DailyOperationsCard.BudgetRow` now respects per-category `allowanceType`:** Replaced hardcoded `safeSpend = remaining / daysRemaining` with `calculateAllowance()` to honor each category's allowance setting (budget_period/weekly). Removed unused `daysRemaining` prop from `BudgetRow`.

### Added
- **Budget Allowance Feature:** Allowance configuration per category — pure recommendation layer, never affects budget allocation or month-end processing.
  - **Schema:** Added `allowanceType` (`"budget_period"` | `"weekly"`) and `weeklyResetDay` (0-6) to `categories` table.
  - **AllowanceCalculator:** Pure TypeScript module (`lib/allowance-calculator.ts`) — computes allowance amount, daily/weekly remaining, and pace status. No React/Convex dependencies, no UI labels, no transaction queries inside.
  - **`updateAllowanceConfig` mutation:** Updates `allowanceType` and `weeklyResetDay` on a category.
  - **Home screen (`MobileBudgetToday`):** Removed tabs. Each card shows allowance amount as primary (Rp X for today / for this week) with days remaining or week date range on the right. Layout mimics Budget Tracker summary style (progress bar on top, info row below).
  - **BudgetCard:** Remaining is primary display, allowance is secondary.
  - **BudgetDrawer:** Allowance config UI with RadioGroup (Budget Period / Weekly) + conditional weekly reset day Select.
  - **BudgetCategorySheet:** Dynamic allowance details based on type (daily vs weekly).
  - **Category Detail:** Allowance section with daily/weekly breakdown. `weeklySpent` computed in backend `getCategoryDetails` query using fiscal period filter (consistent with `getDashboardSummary`).

### Fixed
- **`weeklySpent` inconsistency between Home and Category Detail:** `getCategoryDetails` now filters transactions by fiscal period (same as `getDashboardSummary`), ensuring both pages show identical weeklySpent values.

### Changed
- **Mobile home: overall budget info removed from BudgetToday card.** `MobileBudgetToday` no longer shows the overall progress bar (spent vs budget) and status badge ("On Track / Spending Faster / Slow Down") — this info was redundant with the `MobileHeroSummary` card above it, which already displays remaining budget, daily allowance, and fiscal day. BudgetToday now focuses purely on per-category pacing breakdown and today's spending.

### Changed
- **Icon library migration: `lucide-react` → HeroIcons via `@iconify-icon/react`.** Semua icon (~96) diganti dengan HeroIcons (outline default, solid untuk emphasis). Wrapper `components/ui/icons.tsx` mengekspor icon dengan nama yang sama persis dengan lucide-react — 93 file hanya perlu ganti import path. `lucide-react` dihapus dari dependencies.

### Docs
- **`TECH_STACK_AND_WORKFLOW.md`:** Update icon stack dari Lucide ke HeroIcons (Iconify).
- **`CODE_STYLE_GUIDE.md`:** Update contoh import icon ke `@/components/ui/icons`.

## 2026-07-26

### Added
- **Allocation Progress Hero Card:** Komponen baru `components/budgets/AllocationProgressCard.tsx` menampilkan progress bar prominent yang menunjukkan berapa % income sudah di-assign ke categories. Menggunakan psychological principles (Goal Gradient, Completion Bias) untuk memotivasi user mencapai zero-based budget. Includes:
  - Progress bar `h-3.5` dengan percentage display `text-4xl font-black`
  - Stats row: Income / Budgeted / Unassigned
  - Contextual nudge messages berdasarkan allocation % (`lib/allocation-nudge.ts`)
  - Confetti celebration saat mencapai 100% allocation (respect `prefers-reduced-motion`)
  - "Complete" badge dan green styling saat unassigned = 0
  - "Move Funds" button prominent (hanya muncul saat unassigned > 0)
- **`lib/allocation-nudge.ts`:** Helper function yang return contextual motivational messages berdasarkan allocation percentage dan remaining amount.
- **BudgetCard emotional redesign:** Pacing badge enlarged (12px) dengan colored bullet dot, progress bar lebih tebal (h-2.5), daily safe spend display (`Rp X/day safe`), over-budget coaching nudge, "Adjust Budget" CTA di thumb zone, goal strategy timeline (`Rp X/mo · X months to target`), confetti celebration saat goal monthly target tercapai via `useGoalCelebration` hook.
- **`hooks/useGoalCelebration.ts`:** Confetti hook yang fire 1x per category ID menggunakan module-level Set untuk prevent re-fire pada remount. Respects `prefers-reduced-motion`.

### Changed
- **Budgets page header — removed redundant "Move Funds" button:** Tombol "Move Funds" standalone di mobile header (Row 3) dan desktop header dihapus. AllocationProgressCard sudah menyediakan tombol dengan konteks yang lebih baik.
- **Expenses Summary Card simplified:** Hapus stat blocks "New Planned" dan "Adjustments" (allocation info sudah ada di AllocationProgressCard). Tambah "days left" dan "daily burn rate" di bawah spending progress bar.
- **BudgetCard over-budget dropdown label:** Dropdown menu sekarang tampilkan "Adjust Budget" saat over-budget, "Edit Budget" saat normal — membedakan shortcut button dari menu action.

### Removed
- **Old "Unassigned" pill from budgets page header:** Pill kecil "Unassigned: {amount}" dengan Info icon dan Popover breakdown dihapus dari both mobile dan desktop layouts. Digantikan oleh AllocationProgressCard yang lebih prominent dan actionable.
- **`lib/budget-card-nudge.ts`:** Dihapus karena tidak terpakai, copy di-inline langsung di BudgetCard.

### Fixed
- **AllocationProgressCard lint errors:** Hapus `showCelebration` state yang tidak terpakai dan `react-hooks/set-state-in-effect` warning.
- **BudgetCard mobile clipping:** Tambah `min-w-0` ke Card component dan motion.div grid wrappers untuk reset CSS Grid `min-width: auto` — mencegah card overflow pada mobile viewport (~400px).
- **useGoalCelebration import path:** Fix `../../convex/_generated/dataModel` → `../convex/_generated/dataModel` (hooks/ hanya 1 level dari root).

## 2026-07-26

### Fixed
- **`getUnassignedCash` returns 0 when `userCaches` entry is missing:** `moveBudgetFunds`, `getBudgetAssistance`, dan `upsertBudget` membaca unassigned cash dari cache. Jika cache entry belum ada (user lama belum di-seed, atau `recomputeUserCache` belum pernah dipanggil), fallback `?? 0` mengembalikan 0 — padahal UI menampilkan nilai asli dari `getBudgetStatus` (direct computation). Fix: jika cache null, fall through ke direct computation (sama seperti non-current month path).

## 2026-07-25

### Fixed
- **`getFiscalDateDetails` month indexing inconsistency:** Function returned 0-indexed months for `startDay=1` but 1-indexed for `startDay>1`. Database always stores 0-indexed. Caused cache to compute `unassignedCash` against wrong month's budgets. Fix: always return 0-indexed months.
- **`getFiscalMonthRange` for `startDay=1`:** End date was calculated incorrectly. Fix: use `new Date(year, month+1, 0)` for correct last-day-of-month.
- **`MobileBudgetToday` pace calculation:** Used raw calendar year/month instead of fiscal year/month. Caused dashboard to show incorrect pacing status when `budgetStartDay > 1`. Fix: use `getFiscalDateDetails` for fiscal year/month.

### Docs
- Updated `DATABASE_AND_RELATIONSHIPS.md`: Month-end section now reflects client-side proposal derivation via `useMemo`
- Updated `TECH_STACK_AND_WORKFLOW.md`: Replaced "Lazy Sub-queries for Month-End" with current architecture
- Updated `CACHE_OPTIMIZATION.md`: Marked `getMonthEndProposals` as legacy (month-end page derives client-side)
- Updated `TECH_STACK_AND_WORKFLOW.md`: Documented `getFiscalDateDetails` always returns 0-indexed months
- Updated `DATABASE_AND_RELATIONSHIPS.md`: Added 0-indexed month convention for budgets

### Removed Auto-Rollover + Add Re-process Button
- Removed `ensureCurrentRollover` from page load - wizard is now the single source of truth
- Added "Re-process Rollover" button on budgets page for unprocessed periods
- Month-end page handles `?reprocess=true` query param to start at Step 4
- Snapshot storage now overwrites existing records instead of creating duplicates
- Users have full control over when month-end processing occurs
- Fixed button visibility logic: Month-End Review shows for first-time processing, Re-process shows only when user has processed before but current period needs re-processing

### Added
- **Month-end rollback mechanism:** User bisa undo proses month-end terakhir. Snapshot disimpan sebelum `processMonthEnd` menjalankan sweep/rollover, dan bisa di-restore jika user klik "Undo".
- **`monthEndSnapshots` table:** Menyimpan previous state `sweptAmount` dan `carryoverAmount` sebelum proses, plus ID budget yang di-insert saat rollover.
- **`convex/monthEndSnapshots.ts`:** Module dengan `getLatest` query, `save` mutation, `rollback` mutation. Semua pakai household auth check.
- **Undo banner di budgets page:** Banner subtle tampilkan "Month-end processed" dengan tombol "Undo last process". Hanya muncul di bulan yang sedang dilihat (sama dengan snapshot).
- **Rollback confirmation dialog:** AlertDialog tampilkan detail berapa kategori yang di-rollback (swept amounts, carryover amounts, inserted budgets) dengan warning "This action cannot be undone".

### Changed
- **Month-end page data flow — proposals derived from `budgetData`:** Hapus query `getMonthEndProposals` dari month-end page. Proposals sekarang di-derive langsung dari `budgetData.data` (yang sudah di-fetch untuk Steps 1-3) menggunakan `useMemo`. Eliminasi timezone/date mismatch antara client dan server. Satu sumber data, konsisten.
- **Rollover dedup check:** Tambah `currentBudgetData` query (current fiscal month) untuk cek apakah rollover sudah diproses. Kalau `currentBudget.carryoverAmount` sudah match `sisa`, proposal rollover tidak ditampilkan lagi.
- **Banner condition:** Banner "Month-End Review" di budgets page sekarang tampil kalau `budgetData.data.length > 0` (ada budget bulan lalu), bukan `monthEndProposals.length > 0`. Alasan: user perlu review performa meskipun tidak ada action sweep/rollover.
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

