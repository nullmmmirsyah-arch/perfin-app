# Tech Stack & Workflow

## Technology Stack

### Frontend
- **Framework:** [Next.js 15+](https://nextjs.org/) (App Router).
- **Language:** TypeScript.
- **Styling:** [Tailwind CSS](https://tailwindcss.com/).
- **UI Library:** [shadcn/ui](https://ui.shadcn.com/) (based on Radix UI).
- **Icons:** [Lucide React](https://lucide.dev/).
- **Forms:** `react-hook-form` + `zod`.
- **Drawer/Dialog:** `vaul` (Drawer) for mobile-friendly sheets.

### Backend (BaaS)
- **Platform:** [Convex](https://convex.dev/).
- **Database:** Real-time Document Database (JSON-like).
- **Functions:**
  - `query`: Read data (Reactive, auto-subscribe).
  - `mutation`: Write data (ACID transactions).
  - `action`: Third-party API calls (e.g., Web Push).
  - `internalMutation`: Privileged functions not exposed to client.
- **Scheduling:** `ctx.scheduler` for async tasks (e.g., sending notifications after transaction).

### Authentication
- **Provider:** [Clerk](https://clerk.com/).
- **Integration:** Convex + Clerk integration via JWT.

### PWA (Progressive Web App)
- **Manifest:** `app/manifest.ts`.
- **Service Worker:** `public/custom-sw.js` (for Push Notifications).
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

3.  **Triggers & Automation:**
    - We don't have DB triggers (like SQL). We use **Application-Level Triggers**.
    - *Example:* In `convex/transactions.ts`, inside the `create` and `update` mutation handler, we explicitly call `checkGoalProgress`.

## Directory Structure

```
├── app/                 # Next.js App Router
│   ├── (routes)         # page.tsx files
│   ├── layout.tsx       # Root layout + Providers
│   └── globals.css      # Tailwind imports
├── components/          # React Components
│   ├── ui/              # shadcn/ui primitives (Button, Input, etc.)
│   ├── dashboard/       # Dashboard-specific widgets
│   ├── transactions/    # Transaction-specific components
│   ├── [Feature].tsx    # Shared Feature components (TransactionDrawer, etc.)
│   └── HouseholdProvider.tsx # Context for Household state
├── convex/              # Backend Logic
│   ├── schema.ts        # Database Schema
│   ├── transactions.ts  # Transaction logic
│   ├── accounts.ts      # Account logic
│   ├── budgets.ts       # Budget logic
│   ├── push.ts          # Web Push Actions
│   ├── notifications.ts # In-app notification logic
│   └── _generated/      # Auto-generated Types
├── public/              # Static assets + SW
└── docs/                # Project Documentation
```
