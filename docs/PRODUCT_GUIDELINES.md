# Product Guidelines & UX Patterns

This document outlines the design philosophy and user experience patterns used in Perfin.

## Design Philosophy
1.  **Mobile-First:** All features must work flawlessly on mobile devices.
2.  **Zero-Latency Feel:** UI should feel instant. We use Convex's optimistic updates and reactive queries.
3.  **Focus & Context:** Avoid clutter. Use drawers to drill down into complex tasks.
4.  **Swipe Navigation:** Prioritize gestures (Swipe Left/Right) for switching contexts (e.g., List vs Analytics, Expenses vs Savings).
5.  **Data Integrity:** Ensure robust data handling, especially regarding dates and preventing duplicate submissions.
    - **Inventory Paradox Prevention:** For Asset Accounts, the backend must validate that any Update or Delete operation does not result in a negative quantity balance (e.g., selling more than you own).

## UX Patterns

### 1. Navigation
- **Mobile:** Bottom Navigation Bar (`BottomNav.tsx`).
- **Desktop:** Sidebar (`Sidebar.tsx`).
- **Contextual Selection:** Use **Tabs** at the top of forms for major mode switches (e.g., Transaction Type in `TransactionDrawer`, Account Type in `AccountDrawer`).
- **Swipeable Tabs:** Use **Carousel** for major view switches within a page.
    - *Example:* Transactions Page (List <-> Analytics).
    - *Example:* Budgets Page (Expenses <-> Savings).
- **Back Button Handling (Mobile):** 
    - Drawers use `window.history.pushState` to intercept the hardware/gesture Back button.
    - Pressing "Back" will close the active drawer (or sub-drawer like Split Editor) instead of navigating away from the application.
- **Action Triggers in Selectors:**
    - High-level actions (like **Split Transaction**) are integrated directly into selection drawers/dropdowns (e.g., Category Selector) for better discoverability.
    - **Visual Hierarchy:** Action items are visually distinguished from data items (e.g., using dashed borders, background tints, or separators) to maintain clear intent.
- **Application Exit Interception:**
    - To prevent accidental logout, the application intercepts the "Back" action when it would lead out of the app.
    - This is implemented globally in `LayoutWrapper` and should NOT be overridden by individual pages unless specifically required for complex multi-step wizards.

### 2. Forms & Data Entry
- **Drawers (Sheet) over Modals:** Use `Drawer` (from `vaul`/shadcn) for almost all forms (Add Transaction, Edit Account, etc.).
- **Nested Drawers:** For complex sub-forms (like **Split Transactions**), DO NOT expand the form inline. Open a second, nested Drawer. 
    - **Visual Consistency:** The nested drawer (Split Editor) must use the same component patterns as the main drawer (`MobileInputCard`, `MobileSelectionDrawer`).
    - **Focused Interface:** Hide redundant global fields in the parent drawer when a sub-editor is active to maintain user focus on the relevant context.
    - **Trigger Flow:** The Split Editor is triggered by selecting the "Split Transaction" option within the Category selector.
- **Unified Account & Goal:** For Saving/Asset accounts, provide optional "Goal Settings" directly in the `AccountDrawer`. This allows users to set targets without leaving the account context.
- **Auto-Save/Validation:** Use `react-hook-form` + `zod` for instant validation.
    - **FormMessage Placement:** Always ensure `<FormMessage />` is placed **INSIDE** the `<FormItem>` wrapper. This allows it to inherit the field context and display validation errors correctly.
    - **Nested Validation:** For nested arrays (like splits), use explicit validation triggers (`form.trigger('field')`) when closing sub-drawers to ensure the parent form reflects the latest state.
- **Submission Safety:**
    - **Double-Click Prevention:** Implement strict "Synchronous Locking" (`useRef` + `isProcessing` state) on all submit buttons to prevent duplicate data creation.
    - **Unsaved Changes Confirmation (Dirty Check):** For complex forms, use `form.formState.isDirty` to detect changes. 
        - If the user attempts to close a "dirty" form (via Back button, backdrop click, or Cancel), intercept the action and show an **AlertDialog** for confirmation.
    - **State Reset:** Ensure processing states and locks are reset when the drawer/dialog opens to prevent UI from getting stuck in a loading state if a previous attempt was interrupted or failed silently.
    - **Visual Feedback:** Buttons must show a "Loading/Saving..." state with a Spinner (`Loader2`) and be disabled during processing.
    - **Haptic Feedback:** Trigger a small vibration (`navigator.vibrate(10)`) on submit for tactile confirmation (Mobile).
- **Date Handling:**
    - **Timezone Safety:** When sending dates to the backend (e.g., Transaction Date, Goal Target Date), **always normalize the time**.
        - **Rule:** Always set time to **12:00 PM (Noon)** local time, regardless of whether it is "Today" or a manual selection.
        - This prevents UTC conversion shifts (e.g., 00:00 WIB -> 17:00 UTC previous day) from causing data to appear in the wrong budget period.

### 3. Wizard Pattern (Multi-Step Forms)
- **Drawer-Based Wizards:** Use `Drawer` (vaul) for multi-step forms, not full-screen modals. Consistent with existing drawer patterns.
- **Step Indicator:** Show step progress with dots and step counter at the top. Include back/close buttons.
- **State Management:** Use a custom hook (e.g., `useGoalWizard`) to manage wizard state, validation, and dirty-state tracking.
- **Auto-Advance:** For selection steps (like choosing goal type), auto-advance to next step after a short delay for smooth UX.
- **Live Feedback:** Show real-time calculations as users input data (e.g., projected completion date based on contribution).
- **Review Step:** Always include a final review step before submission so users can verify all details.
- **Celebration:** Use confetti animation and sound effects on successful creation to make the experience rewarding.
- **Unsaved Changes:** Track dirty state and show AlertDialog confirmation when user tries to close with unsaved changes.
- **Back Button Handling:** Use `window.history.pushState` + `popstate` to handle hardware/gesture back button in drawers.
- **Double-Click Prevention:** Use `useRef` lock + `isProcessing` state to prevent duplicate submissions.

### 4. Feedback System
- **Toasts:** Use `sonner` for all success/error feedback.
- **Skeletons:** Always show Skeleton loaders (`components/skeletons.tsx`) while data is fetching. Never show a blank screen.
- **Empty States:** Provide clear "No data" states with a Call to Action (e.g., "No accounts found. Create one?").
- **Over-Budget Warnings:** Use Red/Destructive colors immediately when a budget is exceeded (Negative Remaining).
- **Positive Reinforcement:** Use Green colors and "Checklist" badges (e.g., "Monthly Goal Met! 🎉") when users hit their saving targets for the period.

### 5. Categorization & Grouping
- **Separation of Concerns:**
  - **Accounts Page:** Separated into "Spending & Cash" vs "Savings & Assets".
  - **Budgets Page:** Separated into "Monthly Expenses" (Limits) vs "Savings & Goals" (Targets) via Carousel.
  - **Goals Page:** Grouped by intent:
    - **🛡️ Security & Growth:** Investments & Assets.
    - **📅 Upcoming Obligations:** Sinking Funds (Bills).
    - **✨ Wishlist:** Optional purchases.
  - **Categories Page:** Separated into "Goals", "Expenses", "Income", and "Archived".
- **Closed Items:** Always hide archived/closed items inside a `Collapsible` section or filter them out by default.

### 6. Goal Achievement UX
- **Passive Trigger:** Don't force the user to check progress. Send a **Notification** (Bell Icon).
- **Dynamic Wizard:** When clicking the notification, launch a **Context-Aware Wizard**:
    - **Investment:** Celebrates milestone. Offers to **Increase Target** to keep growing wealth.
    - **Bill (Sinking Fund):** Prompts to **Pay Bill** (Disburse), then asks for **Next Due Date** to reset the cycle without closing the account.
    - **Purchase:** Prompts to **Spend Funds** and **Archive** the goal.

### 7. Merchant & Payee UX
- **Searchable Combobox:** Use `MerchantCombobox` in transaction forms for quick merchant selection.
  - **Auto-Create:** Type a new name and select "Create [name]" to instantly create a merchant with first-letter icon.
  - **No Drawer for Quick Create:** Creating from combobox bypasses the drawer — uses first letter as icon automatically.
  - **Icon Customization:** Users can edit merchants later via the merchant drawer to change icon (emoji, brand logo).
- **Icon Picker Tabs:** `MerchantIconPicker` uses tabs:
  - **Emojis Tab:** Grid of common finance/business emojis.
  - **Brand Icons Tab:** Searchable Iconify API integration for brand logos (e.g., Starbucks, Amazon).
- **Transaction Form Position:** Merchant field is positioned **after Amount, before Account** in both mobile and desktop forms. Merchant field is also available for split transactions.
- **Visual Consistency:** All merchant displays (combobox, transaction items, merchant page) render the same 3 icon types:
  - **URL icons:** Rendered as `<img>` with fallback.
  - **Letter avatars:** Colored circles with first letter.
  - **Emojis:** Rendered as text.
- **Split Indicator:** Split transactions show a `GitBranch` icon with a Radix `Tooltip` ("Transaksi ini di-split") that works on both cursor (hover) and touchscreen (long-press).
- **Merchant Filter:** The Transactions page filter popover includes a Merchant multi-select filter, allowing users to filter by specific merchants. The filter uses server-side `.filter()` for performance.
- **Delete Guard:** UI prevents deletion of merchants that are referenced by transactions (shows error).
- **Haptic Feedback:** `navigator.vibrate(10)` on merchant create/edit/delete operations.

### 8. Actionable Insights
- **Safe Daily Spend:** Provide actionable daily limits (e.g., "~Rp 50k/day") instead of just static remaining budgets.
- **Monthly Saving Performance:** In Goal Details, display a **Visual Bar Chart** (list view) showing contribution history per month vs the required monthly target.
- **Smart Budget Pace Indicators:**
    - **Visuals:** Use colored dots (Green/Yellow/Red) next to category names to indicate spending velocity.
    - **Interaction:** Clicking the dot reveals a **Popover** with detailed context ("Time Passed: 30%, Budget Used: 60%") and specific advice ("Reduce spending to 50k/day").
    - **Prioritization:** In Dashboard, sort budget items by urgency (Danger > Warning > Safe) so users see critical issues first.
- **On-Demand Details:** Use interactive elements (like clicking a budget row or a goal) to reveal granular insights and full transaction history by navigating to their respective detail pages.
- **Contextual Summary:** Place summary cards (Total Remaining, Total Saved) directly within their relevant tabs/slides, not in global headers.
- **Wealth Dashboard:** Provide "Required Saving" insights (e.g., "+1.2M/mo") directly on the Wealth Card to guide user behavior.
- **Budget Transparency (Assigned vs. Effective):** 
    - **Concept:** Clearly separate "New Money" allocated this month from "Adjustments" (rollover debt/surplus).
    - **Visuals:** Use a **Stats Grid** in the header to show the breakdown (Planned + Adjustments = Effective).
    - **Standardization:** Both the Dashboard and Budgets page use the same centralized function (`calculateMonthlyBudgetLeft`) and label ("Monthly Budget Left") to ensure consistency.
    - **Mobile-First:** Ensure the grid uses `flex-wrap` to stack gracefully on small screens without losing detail.
    - **Transparency:** Explicitly show when funds are "swept back" to clarify why the remaining balance might have changed after a month-end process.
- **Receivables & Striped Bar:**
    - **Problem:** User lent money, making the budget bar red/full, but it's not their actual expense.
    - **Solution:** Use a **Striped (Arsir) Bar** pattern.
    - **Visuals:** Personal spending is a solid color (Primary/Blue). Pending receivables (lent money) use a striped pattern overlay.
    - **Partial Support:** The striped portion shrinks as the borrower pays back installments.
- **Privacy Mode:**
    - **Purpose:** Protect sensitive financial data when using the app in public spaces.
    - **Default Behavior:** Privacy Mode defaults to **ON (Active)** every time the application is loaded or the user navigates back to the Dashboard. It does not persist the "OFF" state across sessions/navigation to ensure security.
    - **Visuals:** Sensitive amounts (Balances, Totals) are masked using bullet characters (`••••`) instead of asterisks.
    - **Interaction:** Toggled via the **Eye Icon** in the Dashboard Page Header.
- **Budget Report (/report):**
    - **Purpose:** Historical view of budget performance with detailed breakdown per period.
    - **Features:**
        - **Period Selector:** 3, 6, or 12 months view.
        - **Category Filter:** Filter by specific category or view all.
        - **View Mode:** Toggle between Table and Chart visualization.
    - **Breakdown Display:**
        | Period | Initial | Adjustment | Carryover | Total | Spent | Remaining |
        |--------|---------|------------|-----------|-------|-------|-----------|
        | Mar 26 | 500.000 |   +50.000  |  +25.000  |575.000|450.000| 125.000 |
    - **Chart View:** Stacked bar chart showing Initial + Adjustment + Carryover, with Spent as line overlay.

### 8. Category Detail Page
- **Performance Trend:** A 12-month bar chart visualizing **Effective Budget** (Planned + Carryover) vs. Actual Spending. 
- **Monthly History:** A detailed list showing Budget (Effective), Spent, Carryover, and Swept amounts for each fiscal month.
- **Grouped & Actionable Transactions:** A list of recent transactions grouped by date with **daily totals**. Users can directly Edit or Delete transactions from this view.
- **Advanced Filtering:** Supports multi-select filtering by **Account** and **Date Range**, allowing for deep-dive analysis of spending patterns.
- **Fiscal Awareness:** All data points and default filters respect the user's custom **Budget Start Day**.

## Visual Style
- **Components:** shadcn/ui (Radix UI + Tailwind).
- **Theme:** Support Dark/Light mode (via `next-themes`).
- **Charts:** Use `shadcn/ui` charts with consistent CSS variables (`--chart-1`, `--chart-2`, etc.) for data visualization.
- **Colors:**
  - **Primary:** Blue/Zinc based.
  - **Success:** Green (Income/Goal Reached/Positive Cashflow).
  - **Destructive:** Red (Expense/Over Budget/Negative Cashflow).
  - **Asset/Gold:** Amber/Yellow.
