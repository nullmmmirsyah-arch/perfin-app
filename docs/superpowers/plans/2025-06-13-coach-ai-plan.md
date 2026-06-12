# Coach AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement hybrid rule-based + Gemini-powered financial coaching on the dashboard.

**Architecture:** Rule engine runs in a Convex query for instant, quota-free signals. When data changes significantly, a Convex mutation triggers an HTTP action to Gemini 2.0 Flash Free Tier for natural language enhancement. Results are cached in a `coachInsights` table.

**Tech Stack:** Next.js 16, Convex, Gemini 2.0 Flash API, shadcn/ui

---

## File Structure

### New Files
```
convex/coach.ts                             → Rule engine + getInsight + refreshInsight
convex/http.ts                              → POST /coach/generate HTTP action
components/dashboard/CoachCard.tsx          → UI card
```

### Modified Files
```
convex/schema.ts                            → add coachInsights table
app/dashboard/page.tsx                      → add CoachCard full-width
```

---

### Task 1: Add coachInsights Table to Schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add coachInsights table**

In `C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app\convex\schema.ts`, add inside `defineSchema` after the last table (after `scheduledTransactions` closing comma):

```ts
coachInsights: defineTable({
  householdId: v.id("households"),
  month: v.number(),
  year: v.number(),
  dataHash: v.string(),
  signals: v.array(v.object({
    type: v.union(v.literal("danger"), v.literal("warning"), v.literal("info"), v.literal("success")),
    category: v.union(v.literal("budget"), v.literal("spending"), v.literal("saving"), v.literal("recurring"), v.literal("general")),
    title: v.string(),
    message: v.string(),
    actionLabel: v.optional(v.string()),
    actionHref: v.optional(v.string()),
  })),
  geminiInsight: v.optional(v.string()),
  insightSource: v.union(v.literal("rule"), v.literal("gemini")),
  generatedAt: v.number(),
})
.index("by_householdId_month", ["householdId", "month", "year"]),
```

Make sure there's a comma before `coachInsights` (after the previous table).

- [ ] **Step 2: Build to verify**

```bash
cd "C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app" && npm run build 2>&1 | Select-Object -Last 10
```
Expected: Compiled successfully

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app"
git add convex/schema.ts
git commit -m "feat: add coachInsights table to schema"
```

---

### Task 2: Rule Engine + Convex Queries/Mutations

**Files:**
- Create: `convex/coach.ts`

- [ ] **Step 1: Create convex/coach.ts**

Create `C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app\convex\coach.ts`:

```ts
import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// ─── Types ───

type CoachingSignal = {
  type: "danger" | "warning" | "info" | "success";
  category: "budget" | "spending" | "saving" | "recurring" | "general";
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

type SignalInput = {
  type: "danger" | "warning" | "info" | "success";
  category: "budget" | "spending" | "saving" | "recurring" | "general";
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

// ─── Helpers ───

function hashData(summary: any): string {
  const input = `${summary.remainingBudget}-${summary.totalSpending}-${summary.carryoverTotal}-${summary.currentMonth}-${summary.currentYear}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

function calculateMonthProgress(budgetStartDay: number): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), budgetStartDay);
  if (now < start) {
    start.setMonth(start.getMonth() - 1);
  }
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const total = (end.getTime() - start.getTime()) / 86400000;
  const elapsed = (now.getTime() - start.getTime()) / 86400000;
  return Math.max(0, Math.min(1, elapsed / total));
}

function getCurrentFiscalMonth(budgetStartDay: number): { year: number; month: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), budgetStartDay);
  if (now < start) {
    start.setMonth(start.getMonth() - 1);
  }
  return { year: start.getFullYear(), month: start.getMonth() + 1 };
}

// ─── Rule Engine ───

export function runRuleEngine(summary: any, currentDay: number): CoachingSignal[] {
  const signals: CoachingSignal[] = [];
  const breakdown = summary?.budgetBreakdown ?? [];

  if (!summary || breakdown.length === 0) {
    signals.push({
      type: "info",
      category: "general",
      title: "No budgets yet",
      message: "Set up your first budget to get personalized financial coaching.",
      actionLabel: "Create Budget",
      actionHref: "/budgets",
    });
    return signals;
  }

  let allSafe = true;

  for (const item of breakdown) {
    if (item.categoryType === "saving") {
      // Saving progress
      if (item.targetAmount && item.targetAmount > 0) {
        const progress = calculateMonthProgress(1); // approximate
        const expected = item.targetAmount * progress;
        if (item.accumulated >= expected) {
          signals.push({
            type: "success",
            category: "saving",
            title: "On track!",
            message: `${item.categoryName} saving is on track with ${item.accumulated} accumulated so far.`,
          });
        } else if (item.accumulated < expected * 0.5) {
          allSafe = false;
          signals.push({
            type: "warning",
            category: "saving",
            title: `${item.categoryName} behind schedule`,
            message: `You've saved ${item.accumulated} against a target of ${item.targetAmount}. Consider catching up.`,
            actionLabel: "View Goal",
            actionHref: `/goals/${item.categoryId}`,
          });
        }
      }
      continue;
    }

    // Expense budgets
    if (item.limit <= 0) {
      allSafe = false;
      signals.push({
        type: "danger",
        category: "budget",
        title: `${item.categoryName} exhausted`,
        message: item.carryover < 0
          ? `${item.categoryName} already exceeded by carryover of ${Math.abs(item.carryover)}. Review this budget.`
          : `${item.categoryName} budget is fully used.`,
        actionLabel: "Adjust",
        actionHref: "/budgets",
      });
      continue;
    }

    const pct = (item.spent / item.limit) * 100;

    if (item.spent > item.limit) {
      allSafe = false;
      signals.push({
        type: "danger",
        category: "budget",
        title: `${item.categoryName} over budget`,
        message: `Spent ${item.spent} of ${item.limit} (${Math.round(pct)}%). ${item.carryover < 0 ? "Carryover debt made this worse." : "Try to reduce spending."}`,
        actionLabel: "Adjust",
        actionHref: `/categories/${item.categoryId}`,
      });
    } else if (pct > 85) {
      allSafe = false;
      signals.push({
        type: "warning",
        category: "budget",
        title: `${item.categoryName} nearly full`,
        message: `${Math.round(pct)}% of budget used. Only ${item.limit - item.spent} remaining.`,
      });
    } else if (item.enablePacing) {
      // check pacing
      if (pct > 70 && currentDay < 20) {
        allSafe = false;
        signals.push({
          type: "warning",
          category: "spending",
          title: `${item.categoryName} spending high`,
          message: `${Math.round(pct)}% used early in the period. Current pace: ${item.spent} of ${item.limit}.`,
        });
      }
    }

    // Carryover warning
    if (item.carryover < 0 && Math.abs(item.carryover) > item.limit * 0.3) {
      allSafe = false;
      signals.push({
        type: "warning",
        category: "budget",
        title: `${item.categoryName} carryover burden`,
        message: `Carryover debt of ${Math.abs(item.carryover)} reduces effective budget.`,
      });
    }
  }

  // Recurring signals
  if (summary.recurringOverdue > 0) {
    allSafe = false;
    signals.push({
      type: "danger",
      category: "recurring",
      title: `${summary.recurringOverdue} bill(s) overdue`,
      message: "You have recurring bills past due. Mark them as paid to stay on track.",
      actionLabel: "View Bills",
      actionHref: "/recurring",
    });
  }

  if (summary.recurringUpcoming > 0) {
    signals.push({
      type: "info",
      category: "recurring",
      title: `${summary.recurringUpcoming} bill(s) due soon`,
      message: "Upcoming recurring bills this week. Make sure you have funds ready.",
      actionLabel: "View Bills",
      actionHref: "/recurring",
    });
  }

  // General signals
  if (summary.unassignedCash > 0) {
    signals.push({
      type: "info",
      category: "general",
      title: "Free cash available",
      message: `You have ${summary.unassignedCash} unassigned. Consider allocating to savings or investments.`,
    });
  }

  // All safe
  if (allSafe && signals.length === 0) {
    signals.push({
      type: "success",
      category: "general",
      title: "All on track!",
      message: "Great job! All budgets are within pace. Keep it up!",
    });
  }

  return signals;
}

// ─── Query: getInsight ───

export const getInsight = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get household for budgetStartDay
    const household = await ctx.db.get(householdId);
    const budgetStartDay = household?.budgetStartDay ?? 1;
    const { year, month } = getCurrentFiscalMonth(budgetStartDay);
    const now = new Date();
    const currentDay = now.getDate();

    // Get dashboard summary
    const dashboardData = await ctx.runQuery(api.dashboard.getDashboardSummary, { householdId });

    // Extract recurring info
    const recurringSummary = await ctx.runQuery(api.recurring.getRecurringSummary, { householdId, year, month });

    // Build summary for rule engine & hash
    const totalSpending = (dashboardData?.budgetBreakdown ?? []).reduce((sum: number, b: any) => sum + (b.spent || 0), 0);
    const carryoverTotal = (dashboardData?.budgetBreakdown ?? []).reduce((sum: number, b: any) => sum + Math.abs(b.carryover || 0), 0);

    const summary = {
      remainingBudget: dashboardData?.remainingBudget ?? 0,
      totalSpending,
      carryoverTotal,
      unassignedCash: dashboardData?.unassignedCash ?? 0,
      liquidCash: dashboardData?.liquidCash ?? 0,
      totalReceivables: dashboardData?.totalReceivables ?? 0,
      recurringOverdue: recurringSummary?.overdueCount ?? 0,
      recurringUpcoming: recurringSummary?.upcoming?.length ?? 0,
      budgetBreakdown: dashboardData?.budgetBreakdown ?? [],
      currentMonth: month,
      currentYear: year,
    };

    const dataHash = hashData(summary);

    // Check cache
    const existing = await ctx.db
      .query("coachInsights")
      .withIndex("by_householdId_month", q => q.eq("householdId", householdId).eq("month", month).eq("year", year))
      .first();

    if (existing && existing.dataHash === dataHash) {
      return {
        signals: existing.signals,
        geminiInsight: existing.geminiInsight ?? null,
        insightSource: existing.insightSource as "rule" | "gemini",
        needsRefresh: false,
        generatedAt: existing.generatedAt,
      };
    }

    // Run rule engine
    const signals = runRuleEngine(dashboardData, currentDay);

    // Decide if we need Gemini
    const needsRefresh = summary.totalSpending > 0 && signals.some(s => s.type === "danger" || s.type === "warning");

    // If cache exists but hash changed, update rule signals
    if (existing) {
      await ctx.db.patch(existing._id, {
        dataHash,
        signals: signals as SignalInput[],
        generatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("coachInsights", {
        householdId,
        month,
        year,
        dataHash,
        signals: signals as SignalInput[],
        geminiInsight: undefined,
        insightSource: "rule",
        generatedAt: Date.now(),
      });
    }

    return {
      signals,
      geminiInsight: existing?.geminiInsight ?? null,
      insightSource: existing?.geminiInsight ? "gemini" : "rule",
      needsRefresh,
      generatedAt: Date.now(),
    };
  },
});

// ─── Mutation: refreshInsight ───

export const refreshInsight = mutation({
  args: {
    householdId: v.id("households"),
    dataHash: v.string(),
    signals: v.array(v.object({
      type: v.union(v.literal("danger"), v.literal("warning"), v.literal("info"), v.literal("success")),
      category: v.union(v.literal("budget"), v.literal("spending"), v.literal("saving"), v.literal("recurring"), v.literal("general")),
      title: v.string(),
      message: v.string(),
      actionLabel: v.optional(v.string()),
      actionHref: v.optional(v.string()),
    })),
    summary: v.any(),
  },
  handler: async (ctx, { householdId, dataHash, signals, summary }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const result = await ctx.runAction(api.coach.callGemini, {
      dataHash,
      signals,
      summary,
    });

    const household = await ctx.db.get(householdId);
    const budgetStartDay = household?.budgetStartDay ?? 1;
    const { year, month } = getCurrentFiscalMonth(budgetStartDay);

    const existing = await ctx.db
      .query("coachInsights")
      .withIndex("by_householdId_month", q => q.eq("householdId", householdId).eq("month", month).eq("year", year))
      .first();

    const patch: any = {
      geminiInsight: result?.insight,
      insightSource: result?.insight ? "gemini" : "rule",
      generatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    }
  },
});

// ─── Action: callGemini (HTTP request to Gemini API) ───

export const callGemini = action({
  args: {
    dataHash: v.string(),
    signals: v.array(v.object({
      type: v.union(v.literal("danger"), v.literal("warning"), v.literal("info"), v.literal("success")),
      category: v.union(v.literal("budget"), v.literal("spending"), v.literal("saving"), v.literal("recurring"), v.literal("general")),
      title: v.string(),
      message: v.string(),
      actionLabel: v.optional(v.string()),
      actionHref: v.optional(v.string()),
    })),
    summary: v.any(),
  },
  handler: async (ctx, { dataHash, signals, summary }) => {
    const apiKey = process.env.CONVEX_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("CONVEX_GEMINI_API_KEY not configured");
      return null;
    }

    const signalBullets = signals.map(s =>
      `[${s.type.toUpperCase()}] ${s.title}: ${s.message}`
    ).join("\n");

    const budgetLines = (summary.budgetBreakdown ?? []).map((b: any) =>
      `- ${b.categoryName}: spent ${b.spent} of ${b.limit} (carryover: ${b.carryover ?? 0})`
    ).join("\n");

    const prompt = `Kamu adalah asisten keuangan pribadi yang helpful dan ringkas. Berikut kondisi finansial user bulan ini:

Sinyal terdeteksi:
${signalBullets}

Ringkasan data:
- Sisa budget: ${summary.remainingBudget}
- Total pengeluaran: ${summary.totalSpending}
- Kas bebas: ${summary.unassignedCash}
- Tagihan recurring overdue: ${summary.recurringOverdue}
- Tagihan recurring upcoming: ${summary.recurringUpcoming}

Detail budget:
${budgetLines}

Berikan 1-2 kalimat insight personal dalam Bahasa Indonesia:
- Fokus ke satu hal paling penting
- Jika ada masalah, sebut solusi spesifik
- Jika semuanya baik, apresiasi dan saran untuk lebih baik`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 200,
            },
          }),
        }
      );

      if (!response.ok) {
        console.warn(`Gemini API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const insight = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!insight) return null;

      return { insight };
    } catch (err) {
      console.error("Gemini call failed:", err);
      return null;
    }
  },
});

// ─── Mutation: refreshInsight (force regenerate) ───

export const refreshInsight = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Force regenerate by clearing the cache entry's dataHash
    const household = await ctx.db.get(householdId);
    const budgetStartDay = household?.budgetStartDay ?? 1;
    const { year, month } = getCurrentFiscalMonth(budgetStartDay);

    const existing = await ctx.db
      .query("coachInsights")
      .withIndex("by_householdId_month", q => q.eq("householdId", householdId).eq("month", month).eq("year", year))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { dataHash: "" });
    }
  },
});
```

- [ ] **Step 2: Run codegen**

```bash
cd "C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app" && npx convex codegen 2>&1 | Select-Object -Last 10
```
Expected: Generating TypeScript bindings...

- [ ] **Step 3: Build to verify**

```bash
cd "C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app" && npm run build 2>&1 | Select-Object -Last 10
```
Expected: Compiled successfully

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app"
git add convex/coach.ts
git commit -m "feat: add rule engine, getInsight query, and Gemini HTTP action"
```

---

### Task 3: CoachCard UI Component

**Files:**
- Create: `components/dashboard/CoachCard.tsx`

- [ ] **Step 1: Create CoachCard component**

Create `C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app\components\dashboard\CoachCard.tsx`:

```tsx
'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { fadeInUp } from '@/lib/animations'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Lightbulb,
  Sparkles,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  BrainCircuit,
} from 'lucide-react'
import { useHousehold } from '@/components/HouseholdProvider'

type Props = {
  isPrivacyMode?: boolean;
};

const signalIcon = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const signalColor = {
  danger: 'text-destructive border-destructive/30 bg-destructive/5',
  warning: 'text-yellow-600 dark:text-yellow-400 border-yellow-500/30 bg-yellow-500/5',
  info: 'text-muted-foreground border-border/50 bg-muted/30',
  success: 'text-success border-success/30 bg-success/5',
};

export function CoachCard({ isPrivacyMode }: Props) {
  const { householdId } = useHousehold()
  const [isGenerating, setIsGenerating] = useState(false)
  const insight = useQuery(api.coach.getInsight, householdId ? { householdId: householdId as Id<"households"> } : 'skip')
  const doRefresh = useMutation(api.coach.refreshInsight)
  const now = new Date()
  const monthName = now.toLocaleString('en-US', { month: 'long' })

  // Trigger Gemini generation when needsRefresh is true
  useEffect(() => {
    if (insight?.needsRefresh && householdId && !isGenerating) {
      setIsGenerating(true)
      const signals = insight.signals as any[]
      const summary = {
        remainingBudget: 0,
        totalSpending: 0,
        carryoverTotal: 0,
        unassignedCash: 0,
        liquidCash: 0,
        totalReceivables: 0,
        recurringOverdue: 0,
        recurringUpcoming: 0,
        budgetBreakdown: [],
        currentMonth: now.getMonth() + 1,
        currentYear: now.getFullYear(),
      }

      doRefresh({
        householdId: householdId as Id<"households">,
        dataHash: '',
        signals,
        summary,
      }).finally(() => setIsGenerating(false))
    }
  }, [insight?.needsRefresh, householdId])

  const handleRefresh = async () => {
    if (householdId && insight && !isGenerating) {
      setIsGenerating(true)
      doRefresh({
        householdId: householdId as Id<"households">,
        dataHash: '',
        signals: insight.signals as any[],
        summary: {
          remainingBudget: 0,
          totalSpending: 0,
          carryoverTotal: 0,
          unassignedCash: 0,
          liquidCash: 0,
          totalReceivables: 0,
          recurringOverdue: 0,
          recurringUpcoming: 0,
          budgetBreakdown: [],
          currentMonth: now.getMonth() + 1,
          currentYear: now.getFullYear(),
        },
      }).finally(() => setIsGenerating(false))
    }
  }

  // Loading
  if (insight === undefined) {
    return (
      <Card className="w-full animate-pulse">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Financial Coach</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  // Error / no data
  if (!insight || insight.signals.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Financial Coach</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Lightbulb}
            title="Coach unavailable"
            description="Set up budgets first to get personalized coaching."
            action={{ href: "/budgets", label: "Go to Budgets" }}
            compact
          />
        </CardContent>
      </Card>
    )
  }

  const topSignals = insight.signals.slice(0, 3)

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Financial Coach</CardTitle>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-normal">
            {monthName}
          </Badge>
          {insight.insightSource === 'gemini' && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal gap-0.5">
              <BrainCircuit className="h-2.5 w-2.5" /> AI
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleRefresh} disabled={isGenerating}>
          <RefreshCw className={cn("h-3 w-3 mr-1", isGenerating && "animate-spin")} /> {isGenerating ? 'Generating...' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {insight.geminiInsight && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-sm leading-relaxed"
          >
            <p className="text-foreground/90">{insight.geminiInsight}</p>
            <p className="text-[10px] text-muted-foreground mt-2 italic">Based on AI Coach</p>
          </motion.div>
        )}

        {!insight.geminiInsight && topSignals.length > 0 && (
          <div className="text-sm leading-relaxed text-muted-foreground">
            {topSignals.length === 1 && topSignals[0].type === 'success' ? (
              <p className="text-success font-medium">{topSignals[0].message}</p>
            ) : (
              <p className="text-foreground/80">
                {topSignals.filter(s => s.type === 'danger' || s.type === 'warning').length > 0
                  ? `${topSignals.filter(s => s.type === 'danger').length} issue(s) need attention.`
                  : 'Everything looks good overall.'}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1 italic">Based on rule analysis</p>
          </div>
        )}

        {topSignals.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {topSignals.map((signal, i) => {
              const Icon = signalIcon[signal.type]
              return (
                signal.actionHref ? (
                  <a key={i} href={signal.actionHref} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity">
                    <Icon className="h-3 w-3" />
                    <span className={cn(signalColor[signal.type].split(' ')[0])}>{signal.title}</span>
                  </a>
                ) : (
                  <span key={i} className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border", signalColor[signal.type])}>
                    <Icon className="h-3 w-3" />
                    <span>{signal.title}</span>
                  </span>
                )
              )
            })}
            {insight.signals.length > 3 && (
              <span className="text-[10px] text-muted-foreground pl-1">
                +{insight.signals.length - 3} more
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
cd "C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app" && npm run build 2>&1 | Select-Object -Last 10
```
Expected: Compiled successfully

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app"
git add components/dashboard/CoachCard.tsx
git commit -m "feat: add CoachCard UI component"
```

---

### Task 4: Add CoachCard to Dashboard Page

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Import CoachCard**

In `C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app\app\dashboard\page.tsx`, add beside the other dashboard imports:

```tsx
import { CoachCard } from '@/components/dashboard/CoachCard'
```

- [ ] **Step 2: Add full-width CoachCard above the grid**

Find the mobile section and desktop grid. Add `<CoachCard>` in two places:

**Mobile section** (as first card, before DailyGuidance):
```tsx
<motion.div variants={fadeInUp}><CoachCard isPrivacyMode={isPrivacyMode} /></motion.div>
```

Add right after the opening `<>{` of the mobile section (line ~193).

**Desktop section** (full-width card above the grid):
Add between the closing `</motion.div>` of mobile section (line ~201) and the opening `<motion.div>` of the desktop grid (line ~204):

```tsx
<motion.div variants={fadeInUp} className="mb-6">
  <CoachCard isPrivacyMode={isPrivacyMode} />
</motion.div>
```

- [ ] **Step 3: Build to verify**

```bash
cd "C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app" && npm run build 2>&1 | Select-Object -Last 10
```
Expected: Compiled successfully

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Muhammad Mirsyah\Desktop\Project\perfin-app"
git add app/dashboard/page.tsx
git commit -m "feat: add CoachCard to dashboard page"
```
