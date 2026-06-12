# Coach AI — Hybrid Rule + Gemini Insights

## Overview

Hybrid rule-based + Gemini-powered financial coaching. Rule engine runs server-side for instant, quota-free signals. Gemini 2.0 Flash Free Tier provides natural-language enhancement when data changes significantly.

## Data Flow

```
Dashboard Load
     ↓
api.coach.getInsight({ householdId })
     ↓
Hitung dataStateHash (budgetMonth + totalSpending + carryover total)
     ↓
Cocokkin cache (coachInsights table)? ──Ya──→ Return cached insight (instant)
     ↓ Tidak / forced refresh
Rule Engine → CoachingSignal[]
     ↓
Perubahan data drastis? (>10% spending change) ──Tidak──→ Return rule-based insight
     ↓ Ya
POST /coach/generate → Gemini 2.0 Flash → Natural language insight
     ↓
Simpan ke coachInsights → Return ke client
```

## Convex Schema

### Table: `coachInsights`

```
coachInsights: defineTable({
  householdId: v.id("households"),
  month: v.number(),           // fiscal month
  year: v.number(),            // fiscal year
  dataHash: v.string(),        // hash of input data state
  signals: v.array(v.object({
    type: v.union(v.literal("danger"), v.literal("warning"), v.literal("info"), v.literal("success")),
    category: v.union(v.literal("budget"), v.literal("spending"), v.literal("saving"), v.literal("recurring"), v.literal("general")),
    title: v.string(),
    message: v.string(),
    actionLabel: v.optional(v.string()),
    actionHref: v.optional(v.string()),
  })),
  geminiInsight: v.optional(v.string()),  // null if rule-only
  insightSource: v.union(v.literal("rule"), v.literal("gemini")),
  generatedAt: v.number(),
})
.index("by_householdId_month", ["householdId", "month", "year"])
```

## Rule Engine (convex/coach.ts)

### Signals

| Rule | Kondisi | Level | Category |
|------|---------|-------|----------|
| Over budget | `spent > limit` | danger | budget |
| Pacing warning | `pacing === 'warning'` | warning | budget |
| Pacing danger | `pacing === 'danger'` | danger | budget |
| Carryover besar | `carryover < -limit * 0.5` | danger | budget |
| Spending spike | `todaySpent > avgDaily * 1.5` | warning | spending |
| Near limit | `spent > limit * 0.85` | warning | budget |
| Saving on track | `accumulated >= target * monthProgress` | success | saving |
| Saving behind | `accumulated < target * monthProgress * 0.5` | warning | saving |
| Recurring overdue | `overdueCount > 0` | warning | recurring |
| Recurring upcoming | `upcoming.length > 0` | info | recurring |
| Free cash available | `unassignedCash > 0` | info | general |
| No budgets | `budgetBreakdown.length === 0` | info | general |
| All safe | semua budget safe + no issues | success | general |

### Queries & Mutations

```
getInsight(args: { householdId: Id<"households"> })
  → { signals, geminiInsight?, insightSource, generatedAt }

refreshInsight(args: { householdId: Id<"households"> })
  → force regenerate, bypass cache
```

- `getInsight`: hitung data hash → cek cache → rule engine → jika data berubah drastis, HTTP action ke Gemini → simpan cache
- `refreshInsight`: sama tapi skip cache check

## Gemini HTTP Action (convex/http.ts)

Endpoint: `POST /coach/generate` (di-mount Convex HTTP action)

```
Request:
  dataHash: string
  signals: CoachingSignal[]
  summary: {
    remainingBudget: number
    liquidCash: number
    unassignedCash: number
    totalReceivables: number
    totalRecurring: number
    currentMonth: number
    currentYear: number
    budgetStartDay: number
    budgetBreakdown: Array<{ categoryName, carryover, spent, limit, enablePacing }>
    topCategories: Array<{ name, spent, percentage }>
    recentTransactionCount: number
  }

Process:
  1. Read CONVEX_GEMINI_API_KEY from env
  2. Build prompt (Bahasa Indonesia):
     "Kamu adalah asisten keuangan pribadi yang helpful dan ringkas.
      Berikut kondisi finansial user bulan ini dalam bentuk sinyal:
      [signals in bullet points]
      
      Ringkasan data:
      [summary as bullet points]
      
      Berikan 1-2 kalimat insight personal dalam Bahasa Indonesia:
      - Fokus ke satu hal paling penting
      - Jika ada masalah, sebut solusi spesifik
      - Jika semuanya baik, apresiasi dan saran untuk lebih baik"
  3. POST to Gemini API:
     https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
     Header: x-goog-api-key: <CONVEX_GEMINI_API_KEY>
  4. Parse, return { insight, generatedAt }

Response:
  200: { insight: string, generatedAt: number }
  401: { error: "API key not configured" }
  429: { error: "Rate limited" }
  500: { error: "Gemini API error" }
```

API key disimpan sebagai environment variable di Convex dashboard (`CONVEX_GEMINI_API_KEY`), bukan di `.env.local`.

## UI Component (components/dashboard/CoachCard.tsx)

Full-width card di atas grid desktop, juga di mobile sebagai kartu pertama.

### States

1. **Loading** — skeleton shimmer
2. **Rule insight** — menampilkan signals sebagai card/list + "Based on rule analysis"
3. **Gemini insight** — natural language text + "Based on AI Coach"
4. **Error/offline** — "Coach unavailable" + tombol retry
5. **Empty** (no signals) — "Semua terkendali! 👍"

### Layout (desktop)

```
┌─ Financial Coach ──────────────────────────────────┐
│                                                     │
│  status badge | "June 2026"                          │
│                                                     │
│  [Insight text paragraph]                            │
│                                                     │
│  [signal pills: 🔴 Makanan over budget · 🟡 ...]    │
│                                                     │
│  [🔄 Refresh] · "Based on AI Coach" | "Rule-based"  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Mobile

Sama persis layoutnya, full width di mobile stack.

### Position

- **Desktop:** Full-width card di atas grid (sebelum `.md:grid` div)
- **Mobile:** Kartu pertama di mobile section (sebelum `DailyGuidance`)

## Files

### New
```
convex/coach.ts                   → getInsight, refreshInsight
convex/http.ts                    → POST /coach/generate HTTP action
components/dashboard/CoachCard.tsx → UI card
```

### Modified
```
convex/schema.ts                  → add coachInsights table
app/dashboard/page.tsx            → add CoachCard full-width
```

## Scope Exclusions

- No push notifications
- No historical trend analysis (only current month)
- No multi-language prompt (Bahasa Indonesia only)
- No user feedback loop ("was this helpful?")
- No A/B testing of prompts
- Coach AI tidak punya akses ke data transaksi detail (hanya summary + sinyal)

## Future Considerations

- Feedback loop: thumbs up/down on insights to improve prompt
- Personalized prompt tuning per user spending pattern
- Scheduled weekly summary via push notification
