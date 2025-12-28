# Product Guidelines & UX Patterns

This document outlines the design philosophy and user experience patterns used in Perfin.

## Design Philosophy
1.  **Mobile-First:** All features must work flawlessly on mobile devices.
2.  **Zero-Latency Feel:** UI should feel instant. We use Convex's optimistic updates and reactive queries.
3.  **Focus & Context:** Avoid clutter. Use drawers to drill down into complex tasks.

## UX Patterns

### 1. Navigation
- **Mobile:** Bottom Navigation Bar (`BottomNav.tsx`).
- **Desktop:** Sidebar (`Sidebar.tsx`).
- **Responsive:** Logic handled via `use-mobile.ts` hooks and CSS media queries.

### 2. Forms & Data Entry
- **Drawers (Sheet) over Modals:** Use `Drawer` (from `vaul`/shadcn) for almost all forms (Add Transaction, Edit Account, etc.).
- **Nested Drawers:** For complex sub-forms (like **Split Transactions**), DO NOT expand the form inline. Open a second, nested Drawer. This prevents keyboard occlusion issues on mobile.
- **Auto-Save/Validation:** Use `react-hook-form` + `zod` for instant validation.

### 3. Feedback System
- **Toasts:** Use `sonner` for all success/error feedback.
- **Skeletons:** Always show Skeleton loaders (`components/skeletons.tsx`) while data is fetching. Never show a blank screen.
- **Empty States:** Provide clear "No data" states with a Call to Action (e.g., "No accounts found. Create one?").

### 4. Categorization & Grouping
- **Separation of Concerns:**
  - **Accounts Page:** Separated into "Spending & Cash" vs "Savings & Assets".
  - **Categories Page:** Separated into "Goals", "Expenses", "Income", and "Archived".
  - **Closed Items:** Always hide archived/closed items inside a `Collapsible` section at the bottom.

### 5. Goal Achievement UX
- **Passive Trigger:** Don't force the user to check progress. Send a **Notification** (Bell Icon).
- **Guided Action:** When clicking the notification, launch a **Wizard** (Dialog) that guides the user through the financial implications (Transfer -> Close Account -> Mark Done). DO NOT make them do this manually.

## Visual Style
- **Components:** shadcn/ui (Radix UI + Tailwind).
- **Theme:** Support Dark/Light mode (via `next-themes`).
- **Colors:**
  - **Primary:** Blue/Zinc based.
  - **Success:** Green (Income/Goal Reached).
  - **Destructive:** Red (Expense/Over Budget).
  - **Asset/Gold:** Amber/Yellow.
