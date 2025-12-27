# Improvement Ideas for Perfin App

This document outlines potential improvements, new features, fixes, and refactoring opportunities for the Perfin application. Each item is categorized by its impact and effort level.

## 🚀 Features & Functionality

### 1. Recurring Transactions (Subscription Management)
*   **Description**: Allow users to set up recurring income or expenses (e.g., Netflix, Salary, Rent).
*   **Reason**: Critical for a finance app. Users shouldn't have to manually input fixed monthly costs.
*   **Effort**: **High** (Requires Convex Cron Jobs or Schedulers to automatically generate transactions).
*   **Impact**: **High**

### 2. Multi-Currency Support
*   **Description**: Support for multiple currencies in accounts and transactions (e.g., USD for stocks, IDR for daily).
*   **Reason**: Necessary for users with international assets or travel needs.
*   **Effort**: **Medium** (Schema update, fetch exchange rates via API).
*   **Impact**: **Medium**

### 3. Advanced Analytics & Reports
*   **Description**: Add charts for "Net Worth Trend", "Monthly Spending vs Income", and "Category Pie Chart" with date filtering.
*   **Reason**: The current dashboard is good for snapshots but lacks historical trend analysis.
*   **Effort**: **Medium** (Use Recharts/Chart.js, create new aggregate queries).
*   **Impact**: **High**

### 4. Export to CSV/PDF
*   **Description**: Allow users to download their transaction history.
*   **Reason**: Users often need to backup data or analyze it in Excel/Google Sheets.
*   **Effort**: **Low** (Frontend-only implementation using existing data).
*   **Impact**: **Medium**

### 5. Budget Rollover
*   **Description**: Option to carry over unused budget amounts to the next month.
*   **Reason**: Mimics "Envelope Budgeting" method (YNAB style), popular among finance enthusiasts.
*   **Effort**: **Medium/High** (Complex backend logic during month transition).
*   **Impact**: **Medium**

---

## 🎨 User Experience (UX) & UI

### 6. Transaction "Clone" or "Template"
*   **Description**: Swipe action or button to duplicate a past transaction.
*   **Reason**: Speeds up input for repetitive but non-scheduled transactions (e.g., daily coffee).
*   **Effort**: **Low**.
*   **Impact**: **Medium**

### 7. Skeleton Loading States
*   **Description**: Replace simple "Loading..." text or spinners with Skeleton UI (Shadcn Skeleton) matching the card layouts.
*   **Reason**: Reduces perceived latency and layout shifts (CLS).
*   **Effort**: **Low**.
*   **Impact**: **Medium**

### 8. Onboarding Tour
*   **Description**: A quick walkthrough for new users explaining Household, Accounts, and Budgets.
*   **Reason**: The concept of "Household" vs "Personal" might be confusing for first-timers.
*   **Effort**: **Medium**.
*   **Impact**: **High** (for retention).

### 9. Haptic Feedback (Mobile)
*   **Description**: Add vibration (via Web Vibration API) when adding a transaction or deleting items.
*   **Reason**: Enhances the "Native App" feel on PWA.
*   **Effort**: **Very Low**.
*   **Impact**: **Low** (Polishing).

---

## 🛠️ Code Quality & Architecture

### 10. Refactor "One-File" Components
*   **Description**: `app/dashboard/page.tsx` and `app/transactions/page.tsx` are becoming monolithic. Split Card components, Tabs content, and List renderers into separate files in `components/dashboard/` or `components/features/`.
*   **Reason**: Maintainability. Large files are hard to debug and test.
*   **Effort**: **Medium**.
*   **Impact**: **High** (Dev Experience).

### 11. Type Safety Improvements
*   **Description**: Some parts of the app use loose typing or manual casting (`as TransactionWithDetails`). Use Zod schemas shared between Convex and Frontend for tighter type safety.
*   **Reason**: Prevents runtime errors when schema changes.
*   **Effort**: **Medium**.
*   **Impact**: **Medium**.

### 12. Centralized "Money" Formatting
*   **Description**: Move `Intl.NumberFormat` logic to a global hook or utility that respects user locale (IDR vs USD).
*   **Reason**: Consistency across Dashboard, List, and Input forms.
*   **Effort**: **Low**.
*   **Impact**: **Medium**.

---

## 🗑️ Cleanup & Removals

### 13. Remove "Dashboard" from Bottom Nav?
*   **Analysis**: In many modern apps, "Dashboard" is the landing view, but if "Transactions" or "Budget" is the primary action, maybe Dashboard is redundant if it only summarizes them.
*   **Decision**: Keep for now, but monitor if users actually use the summary cards or just go straight to Transactions.

### 14. Deprecate "Sidebar" on Mobile Code entirely
*   **Description**: Currently we hide it with CSS (`hidden md:block`). We could use `useMediaQuery` hook to not even render the Sidebar component in DOM on mobile.
*   **Reason**: Performance (smaller DOM size).
*   **Effort**: **Low**.
*   **Impact**: **Low**.

---

## 🔒 Security & Data

### 15. Audit Log (Household Activity)
*   **Description**: Show who changed what budget or deleted which transaction in a Household.
*   **Reason**: Trust is crucial in shared finance. Knowing *who* deleted a transaction prevents conflict.
*   **Effort**: **Medium**.
*   **Impact**: **High** (for shared households).

### 16. Data Encryption (End-to-End?)
*   **Description**: Currently data is stored plain in Convex. Sensitive info like exact salary might need encryption.
*   **Reason**: Privacy.
*   **Effort**: **Very High**.
*   **Impact**: **Low** (unless targeting high-security market).

