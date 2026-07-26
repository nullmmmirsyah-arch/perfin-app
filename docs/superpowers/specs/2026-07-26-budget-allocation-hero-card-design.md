# Budget Allocation Hero Card — Design Spec

## Problem

The current "Unassigned Cash" display on the budget page is a small, non-prominent pill in the header area. It doesn't motivate users to assign all their money toward zero-based budgeting. Users lack:
- A clear visual indicator of allocation progress
- Motivational nudge to reach 100% allocation
- Celebration feedback when fully assigned

## Goal

Replace the small "Unassigned" pill with a prominent **Allocation Progress Hero Card** that uses psychological principles (Goal Gradient Effect, Completion Bias, Loss Aversion, Variable Reward) to motivate users to assign 100% of their income to budget categories.

## Scope

**Budget page only** (`app/budgets/page.tsx`). No changes to dashboard, reports, or other pages.

## Design

### 1. Allocation Progress Hero Card (NEW)

**Placement:** Between the page header and the Month-End Review banner. Replaces the existing "Unassigned" pill in both mobile and desktop layouts.

**Layout (Mobile):**
```
┌─────────────────────────────────────────────┐
│  Budget Allocation                          │
│                                             │
│  ████████████████████░░░░░  78%             │
│  [==== allocated =====][unassigned]         │
│                                             │
│  Rp 8.500.000 dari Rp 10.000.000 assigned   │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Income   │ │Budgeted  │ │Unassigned│    │
│  │ 10.000K  │ │ 8.500K   │ │ 1.500K   │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│                                             │
│  Assign Rp 1.500.000 lagi untuk reach       │
│  zero-based budget!                         │
│                                             │
│  [ Move Funds → ]                           │
└─────────────────────────────────────────────┘
```

**Layout (Desktop):** Same structure, slightly wider card, stats row uses horizontal layout.

**Visual specs:**
- Card: `bg-card border rounded-xl p-5 shadow-sm` (matches existing summary cards)
- Title: "Budget Allocation" with icon (use `PieChart` from lucide-react)
- Progress bar: `h-3.5`, thicker than spending progress to be THE primary visual element
- Percentage: `text-2xl font-black` next to the bar
- Summary row: Three small stat blocks (Income / Budgeted / Unassigned) — same pattern as existing "New Planned" / "Adjustments"
- Nudge message: Italic, muted color, below stats
- Move Funds button: Full-width, primary variant, only shown when unassigned ≠ 0

**Progress bar colors by state:**

| Allocation % | Bar Color | Nudge Message |
|---|---|---|
| `= 0%` | `bg-muted` (gray) | "Start assigning your income to categories" |
| `1-49%` | `bg-primary` (blue) | "Great start! {remaining} still needs a home" |
| `50-79%` | `bg-primary` (blue) | "Almost halfway! Just {remaining} left" |
| `80-99%` | `bg-primary` (blue) | "So close! {remaining} to reach zero-based" |
| `= 100%` | `bg-success` (green) | "Every rupiah has a job!" |
| `< 0%` | `bg-destructive` (red) | "Over-allocated by {amount}. Move funds to fix." |

**Data source:** Uses existing `breakdown` object (already fetched in the page):
- `breakdown?.thisMonthIncome` → total income
- `breakdown?.thisMonthBudgeted` → total budgeted
- `unassignedCash` → already available
- `allocationPercent = totalIncome > 0 ? (totalBudgeted / totalIncome) * 100 : 0`

**Edge cases:**
| Scenario | Behavior |
|---|---|
| `thisMonthIncome === 0` | Hide Hero Card entirely |
| `isPastMonth === true` | Hide Hero Card |
| `!isAdmin` | Hide Hero Card |
| `unassignedCash < 0` | Red progress bar + "Over-allocated" nudge |
| `unassignedCash === 0` | Green "completed" state, hide Move Funds button |
| First time user (no budgets) | Show Hero Card with 0% and "Set First Budget" CTA |

### 2. Expenses Summary Card — Simplified (MODIFIED)

Remove the "New Planned" and "Adjustments" stat blocks (allocation info now lives in Hero Card).

**New layout:**
```
┌─────────────────────────────────────────────┐
│  Monthly Spending                           │
│                                             │
│  Rp 6.200.000                               │
│  spent of Rp 8.500.000 budget               │
│                                             │
│  ████████████████░░░░░░  73%                │
│                                             │
│  12 days left · Rp 192K/day avg             │
└─────────────────────────────────────────────┘
```

**What stays:** Spending progress bar, swept amount info.
**What's removed:** "New Planned" and "Adjustments" stat blocks.

### 3. Celebration System (NEW)

**Trigger:** When allocation transitions from `< 100%` to `= 100%`.

**Implementation:**
- Use existing `confetti()` from `canvas-confetti`
- Single burst: `particleCount: 80`, `spread: 60`, `origin: { y: 0.6 }`
- Toast notification: "All assigned! Every rupiah has a job"
- Progress bar transitions to `bg-success` (green)
- Respect `prefers-reduced-motion` — skip confetti if user prefers reduced motion

**State tracking:** `useRef` to track previous allocation state. Compare in `useEffect` to detect transition to 100%.

### 4. Nudge Message Helper (NEW)

```ts
function getAllocationNudge(percent: number, remaining: number): {
  message: string;
  variant: 'default' | 'success' | 'warning';
}
```

Returns contextual message based on allocation percentage and remaining amount. Used by Hero Card for motivational messaging.

### 5. Micro-Interactions

- Progress bar: `transition-all duration-500` for smooth animation
- Percentage text: Subtle scale animation on value change
- Nudge message: `AnimatePresence` for fade in/out on state change

### 6. Accessibility

- Progress bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`
- Nudge messages: `aria-live="polite"` region
- Confetti: Respects `prefers-reduced-motion`
- All interactive elements maintain existing keyboard navigation

## Implementation Notes

- **Files to modify:** `app/budgets/page.tsx` (primary), potentially extract `AllocationProgressCard` as a separate component
- **No data model changes** — all data already available from existing `breakdown` object
- **Confetti import:** Already used in codebase (`canvas-confetti`), follow existing pattern
- **Component extraction:** If the Hero Card logic grows complex, extract to `components/budgets/AllocationProgressCard.tsx`
- **Existing patterns to follow:** Use `motion.div` with `fadeInUp` variants for entrance animation (matches existing cards), `cn()` for conditional classes, `formatCurrency()` for formatting

## Anti-Patterns to Avoid

- Don't change the data model or Convex queries — all needed data is already available
- Don't add new Convex functions — calculation is simple enough for frontend
- Don't create overly complex state management — use existing `unassignedCash` and `breakdown` props
- Don't over-animate — keep micro-interactions subtle and purposeful
