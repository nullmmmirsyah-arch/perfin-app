# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Individuals and households managing personal finances. Primary use case: tracking daily expenses, managing savings goals, and maintaining zero-based budgets. Household collaboration supported (couples, families) with admin/member roles.

## Product Purpose

Help users leave every financial interaction feeling more in control of their finances. The app transforms budgeting from a chore into a confidence-building habit through immediate feedback, clear financial context, and supportive guidance.

Success means: users always know where they stand financially after every action.

## Positioning

Confidence-driven personal finance tracking. Unlike traditional budgeting apps that just record transactions, Perfin completes a "confidence loop" — every important financial action provides clear confirmation, updated financial state, and supportive context before the user moves on. Zero-based budgeting with goal-oriented savings.

## Operating Context

- **Daily workflow:** Record expenses/income → see immediate budget impact → adjust spending
- **Monthly cycle:** Budget allocation → track spending pace → month-end review (sweep/rollover)
- **Goal management:** Create savings goals → auto-save schedules → track progress → celebrate milestones
- **Household use:** Shared budgets, role-based access, invite system
- **Custom fiscal months:** Users can set budget start day (e.g., 25th) to align with pay cycles
- **Privacy:** Sensitive data masked by default (bullet characters), toggleable per session

## Capabilities and Constraints

**Core capabilities:**
- Transaction management (expense/income/transfer/split)
- Multi-account tracking (liquid, savings, assets with quantity/cost basis)
- Zero-based budgeting with allocation tracking and unassigned cash
- Goal-oriented savings with auto-save, cycle tracking, and achievement flows
- Merchant/payee tracking with icon system (emoji, letter avatar, brand logos)
- Household collaboration with role-based access
- Category insights with 12-month performance trends
- Export to CSV with exploded split rows
- PWA with push notifications
- Budget report with historical breakdown
- Receivables/debt tracking with partial settlements
- Funds reconciliation (virtual allocations)

**Technical constraints:**
- Real-time sync via Convex (WebSocket, no REST)
- Auth via Clerk (JWT)
- Must use `--webpack` for dev/build (Turbopack not supported)
- Dates normalized to 12:00 PM local before backend submission
- Currency stored as string, parsed via `parseAmount()`
- All backend functions must check `ctx.auth.getUserIdentity()`
- Household branching: queries use `by_householdId_*` or `by_userId_*` indexes
- Date-range queries must use composite indexes, never `.collect()` + JS filter
- Financial mutations must call `recomputeUserCache()` after DB ops

## Brand Commitments

- **Name:** Perfin
- **Voice:** Calm, friendly, supportive, professional — never shaming, robotic, or excessive
- **Personality:** Confidence-builder, not gamifier

## Evidence on Hand

- `docs/PRODUCT_OVERVIEW.md` — full feature inventory (14 major features)
- `docs/PRODUCT_GUIDELINES.md` — UX patterns, design philosophy, visual style
- `docs/TECH_STACK_AND_WORKFLOW.md` — architecture, data flow, performance patterns
- `docs/DATABASE_AND_RELATIONSHIPS.md` — schema, formulas, relationships
- `docs/CACHE_OPTIMIZATION.md` — userCaches table, when to use cache vs direct query
- `PRD_Sprint 1 — Confidence-Driven UX Foundation` — hero experience for expense completion
- `PRD_Sprint 2 — UX Foundation Trust & Clarity` — empty/loading/error states, UX writing

## Product Principles

1. **Confidence First** — Users should always feel more in control after completing an action
2. **Clarity Over Complexity** — Clear information is more important than visual effects
3. **Feedback Matters** — Every important action deserves clear confirmation
4. **Motion Explains Change** — Animation communicates state changes, not decoration
5. **Mobile-First** — All features must work flawlessly on mobile devices
6. **Zero-Latency Feel** — UI feels instant via optimistic updates and reactive queries

## Accessibility & Inclusion

No formal accessibility requirements established. Standard web accessibility practices apply via shadcn/ui (Radix UI primitives with ARIA support).
