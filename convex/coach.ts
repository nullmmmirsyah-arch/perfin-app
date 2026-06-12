import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

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
      if (item.targetAmount && item.targetAmount > 0) {
        const progress = calculateMonthProgress(1);
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

  if (summary.unassignedCash > 0) {
    signals.push({
      type: "info",
      category: "general",
      title: "Free cash available",
      message: `You have ${summary.unassignedCash} unassigned. Consider allocating to savings or investments.`,
    });
  }

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

// ─── Mutation: getInsight ───

export const getInsight = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const household = await ctx.db.get(householdId);
    const budgetStartDay = household?.budgetStartDay ?? 1;
    const { year, month } = getCurrentFiscalMonth(budgetStartDay);
    const now = new Date();
    const currentDay = now.getDate();

    const dashboardData: any = await ctx.runQuery("dashboard:getDashboardSummary" as any, { householdId });
    const recurringSummary: any = await ctx.runQuery("recurring:getRecurringSummary" as any, { householdId, year, month });

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

    const signals = runRuleEngine(dashboardData, currentDay);

    const needsRefresh = summary.totalSpending > 0 && signals.some(s => s.type === "danger" || s.type === "warning");

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

// ─── Action: refreshInsight ───

export const refreshInsight = action({
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

    const insight = await fetchGeminiInsight(dataHash, signals, summary);

    await ctx.runMutation("coach:saveGeminiInsight" as any, {
      householdId,
      insight: insight?.insight,
      insightSource: insight?.insight ? "gemini" : "rule",
    });
  },
});

// ─── Internal Mutation: saveGeminiInsight ───

export const saveGeminiInsight = internalMutation({
  args: {
    householdId: v.id("households"),
    insight: v.optional(v.string()),
    insightSource: v.union(v.literal("rule"), v.literal("gemini")),
  },
  handler: async (ctx, { householdId, insight, insightSource }) => {
    const household = await ctx.db.get(householdId);
    const budgetStartDay = household?.budgetStartDay ?? 1;
    const { year, month } = getCurrentFiscalMonth(budgetStartDay);

    const existing = await ctx.db
      .query("coachInsights")
      .withIndex("by_householdId_month", q => q.eq("householdId", householdId).eq("month", month).eq("year", year))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        geminiInsight: insight,
        insightSource,
        generatedAt: Date.now(),
      });
    }
  },
});

// ─── Gemini Helper ───

async function fetchGeminiInsight(dataHash: string, signals: any[], summary: any): Promise<{ insight: string } | null> {
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
}

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
    return fetchGeminiInsight(dataHash, signals, summary);
  },
});
