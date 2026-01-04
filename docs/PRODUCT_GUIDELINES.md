# Product Guidelines & UX Patterns

This document outlines the design philosophy and user experience patterns used in Perfin.

## Design Philosophy
1.  **Mobile-First:** All features must work flawlessly on mobile devices.
2.  **Zero-Latency Feel:** UI should feel instant. We use Convex's optimistic updates and reactive queries.
3.  **Focus & Context:** Avoid clutter. Use drawers to drill down into complex tasks.
4.  **Swipe Navigation:** Prioritize gestures (Swipe Left/Right) for switching contexts (e.g., List vs Analytics, Expenses vs Savings).

## UX Patterns

### 1. Navigation
- **Mobile:** Bottom Navigation Bar (`BottomNav.tsx`).
- **Desktop:** Sidebar (`Sidebar.tsx`).
- **Contextual Selection:** Use **Tabs** at the top of forms for major mode switches (e.g., Transaction Type in `TransactionDrawer`, Account Type in `AccountDrawer`).
- **Swipeable Tabs:** Use **Carousel** for major view switches within a page.
    - *Example:* Transactions Page (List <-> Analytics).
    - *Example:* Budgets Page (Expenses <-> Savings).

### 2. Forms & Data Entry
- **Drawers (Sheet) over Modals:** Use `Drawer` (from `vaul`/shadcn) for almost all forms (Add Transaction, Edit Account, etc.).
- **Nested Drawers:** For complex sub-forms (like **Split Transactions**), DO NOT expand the form inline. Open a second, nested Drawer. This prevents keyboard occlusion issues on mobile.
- **Unified Account & Goal:** For Saving/Asset accounts, provide optional "Goal Settings" directly in the `AccountDrawer`. This allows users to set targets without leaving the account context.
- **Auto-Save/Validation:** Use `react-hook-form` + `zod` for instant validation.

### 3. Feedback System
- **Toasts:** Use `sonner` for all success/error feedback.
- **Skeletons:** Always show Skeleton loaders (`components/skeletons.tsx`) while data is fetching. Never show a blank screen.
- **Empty States:** Provide clear "No data" states with a Call to Action (e.g., "No accounts found. Create one?").
- **Over-Budget Warnings:** Use Red/Destructive colors immediately when a budget is exceeded (Negative Remaining).

### 4. Categorization & Grouping
- **Separation of Concerns:**
  - **Accounts Page:** Separated into "Spending & Cash" vs "Savings & Assets".
  - **Budgets Page:** Separated into "Monthly Expenses" (Limits) vs "Savings & Goals" (Targets) via Carousel.
  - **Categories Page:** Separated into "Goals", "Expenses", "Income", and "Archived".
- **Closed Items:** Always hide archived/closed items inside a `Collapsible` section or filter them out by default.

### 5. Goal Achievement UX
- **Passive Trigger:** Don't force the user to check progress. Send a **Notification** (Bell Icon).
- **Guided Action:** When clicking the notification, launch a **Wizard** (Dialog) that guides the user through the financial implications (Transfer -> Close Account -> Mark Done). DO NOT make them do this manually.

### 6. Actionable Insights
- **Safe Daily Spend:** Provide actionable daily limits (e.g., "~Rp 50k/day") instead of just static remaining budgets.
- **Smart Budget Pace Indicators:**
    - **Visuals:** Use colored dots (Green/Yellow/Red) next to category names to indicate spending velocity.
    - **Interaction:** Clicking the dot reveals a **Popover** with detailed context ("Time Passed: 30%, Budget Used: 60%") and specific advice ("Reduce spending to 50k/day").
    - **Prioritization:** In Dashboard, sort budget items by urgency (Danger > Warning > Safe) so users see critical issues first.
- **On-Demand Details:** Use interactive elements (like clicking a budget row) to reveal granular insights without cluttering the main view.
- **Contextual Summary:** Place summary cards (Total Remaining, Total Saved) directly within their relevant tabs/slides, not in global headers.

## Visual Style
- **Components:** shadcn/ui (Radix UI + Tailwind).
- **Theme:** Support Dark/Light mode (via `next-themes`).
- **Charts:** Use `shadcn/ui` charts with consistent CSS variables (`--chart-1`, `--chart-2`, etc.) for data visualization.
- **Colors:**
  - **Primary:** Blue/Zinc based.
  - **Success:** Green (Income/Goal Reached/Positive Cashflow).
  - **Destructive:** Red (Expense/Over Budget/Negative Cashflow).
  - **Asset/Gold:** Amber/Yellow.