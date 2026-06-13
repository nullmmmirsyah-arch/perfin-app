/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { mutation, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

// ─── Types ───

type CoachingSignal = {
  type: "danger" | "warning" | "info" | "success";
  category: "budget" | "spending" | "saving" | "recurring" | "general";
  title: string;
  message: string;
  tip?: string;
  actionLabel?: string;
  actionHref?: string;
};

type SignalInput = {
  type: "danger" | "warning" | "info" | "success";
  category: "budget" | "spending" | "saving" | "recurring" | "general";
  title: string;
  message: string;
  tip?: string;
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

function getFiscalDaysRemaining(budgetStartDay: number): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), budgetStartDay);
  if (now < start) {
    start.setMonth(start.getMonth() - 1);
  }
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return Math.max(1, Math.round((end.getTime() - now.getTime()) / 86400000));
}

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function generateBudgetTip(
  item: any,
  pct: number,
  currentDay: number,
  budgetStartDay: number,
): string | null {
  if (item.limit <= 0) return null;
  const daysRemaining = getFiscalDaysRemaining(budgetStartDay);
  if (daysRemaining <= 0) return null;

  const remaining = item.limit - item.spent;
  if (remaining <= 0) return null;

  const dailyMax = Math.round(remaining / daysRemaining);
  const daysElapsed = Math.max(1, currentDay);
  const currentDailyRate = Math.round(item.spent / daysElapsed);

  if (pct > 85) {
    if (currentDailyRate > dailyMax) {
      return `Max ${fmt(dailyMax)}/hari. Saat ini ${fmt(currentDailyRate)}/hari — hemat ${fmt(currentDailyRate - dailyMax)}/hari.`;
    }
    return `Max ${fmt(dailyMax)}/hari untuk ${daysRemaining} hari ke depan.`;
  }

  if (item.enablePacing && pct > 70 && currentDay < 20) {
    if (currentDailyRate > dailyMax) {
      return `Kurangin ${fmt(currentDailyRate - dailyMax)}/hari. Maksimal ${fmt(dailyMax)}/hari biar aman.`;
    }
    return `Max ${fmt(dailyMax)}/hari. Sisa ${daysRemaining} hari lagi.`;
  }

  if (item.carryover < 0 && Math.abs(item.carryover) > item.limit * 0.3) {
    const effective = remaining + item.carryover;
    if (effective > 0) {
      return `Setelah utang carryover, efektif ${fmt(Math.round(effective / daysRemaining))}/hari.`;
    }
  }

  return null;
}

// ─── Rule Engine ───

export function runRuleEngine(summary: any, currentDay: number, budgetStartDay: number = 1): CoachingSignal[] {
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
  const pendingExpense = new Map<string, { worstType: CoachingSignal["type"]; issues: string[]; tip?: string; actionLabel?: string; actionHref?: string }>();
  const savingBullets: string[] = [];
  let savingHasWarning = false;

  for (const item of breakdown) {
    if (item.categoryType === "saving") {
      if (item.targetAmount && item.targetAmount > 0) {
        const progress = calculateMonthProgress(budgetStartDay);
        const expected = item.targetAmount * progress;
        if (item.accumulated >= expected) {
          savingBullets.push(`${item.categoryName}: on track with ${fmt(item.accumulated)} accumulated`);
        } else if (item.accumulated < expected * 0.5) {
          allSafe = false;
          savingHasWarning = true;
          savingBullets.push(`${item.categoryName}: behind schedule — saved ${fmt(item.accumulated)} of ${fmt(item.targetAmount)} target`);
        }
      }
      continue;
    }

    // Expense budgets — accumulate issues per category for consolidation
    const issues: string[] = [];
    let priority = 0; // 0=success 1=warning 2=danger
    let pct = 0;

    if (item.limit <= 0) {
      allSafe = false;
      priority = 2;
      issues.push(item.carryover < 0
        ? `already exceeded by carryover of ${fmt(Math.abs(item.carryover))}`
        : `budget is fully used`);
    } else {
      pct = (item.spent / item.limit) * 100;

      if (item.spent > item.limit) {
        allSafe = false;
        priority = 2;
        issues.push(`spent ${fmt(item.spent)} of ${fmt(item.limit)} (${Math.round(pct)}%)`);
        if (item.carryover < 0) {
          issues.push(`carryover debt made this worse`);
        }
      } else if (pct > 85) {
        allSafe = false;
        if (priority < 2) priority = 1;
        issues.push(`${Math.round(pct)}% used with only ${fmt(item.limit - item.spent)} remaining`);
      } else if (item.enablePacing && pct > 70 && currentDay < 20) {
        allSafe = false;
        if (priority < 2) priority = 1;
        issues.push(`spending pace is high (${Math.round(pct)}% used early)`);
      }

      if (item.carryover < 0 && Math.abs(item.carryover) > item.limit * 0.3) {
        allSafe = false;
        if (priority < 2) priority = 1;
        issues.push(`carryover debt of ${fmt(Math.abs(item.carryover))} is weighing on this budget`);
      }
    }

    if (issues.length > 0) {
      const worstType: CoachingSignal["type"] = priority === 2 ? "danger" : "warning";
      pendingExpense.set(item.categoryName, {
        worstType,
        issues,
        tip: generateBudgetTip(item, pct, currentDay, budgetStartDay) ?? undefined,
        actionLabel: "Adjust",
        actionHref: `/categories/${item.categoryId}`,
      });
    }
  }

  // Consolidate expense signals: one card per category
  for (const [catName, p] of pendingExpense) {
    signals.push({
      type: p.worstType,
      category: "budget",
      title: catName,
      message: p.issues.join('. '),
      tip: p.tip,
      actionLabel: p.actionLabel,
      actionHref: p.actionHref,
    });
  }

  // Saving consolidation: one card with bullet points
  if (savingBullets.length > 0) {
    signals.push({
      type: savingHasWarning ? "warning" : "success",
      category: "saving",
      title: "Savings",
      message: savingBullets.map(b => `• ${b}`).join('\n'),
    });
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
      message: `You have ${fmt(summary.unassignedCash)} unassigned. Consider allocating to savings or investments.`,
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

    const dashboardData: any = await ctx.runQuery(api.dashboard.getDashboardSummary, { householdId });
    const recurringSummary: any = await ctx.runQuery(api.recurring.getRecurringSummary, { householdId, year, month });

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

    const signals = runRuleEngine(dashboardData, currentDay, budgetStartDay);

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
  args: { householdId: v.id("households") },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { year, month } = getCurrentFiscalMonth(1);
    const currentDay = new Date().getDate();

    const dashboardData: any = await ctx.runQuery(api.dashboard.getDashboardSummary, { householdId });
    const recurringSummary: any = await ctx.runQuery(api.recurring.getRecurringSummary, { householdId, year, month });

    const totalSpending = (dashboardData?.budgetBreakdown ?? []).reduce((sum: number, b: any) => sum + (b.spent || 0), 0);

    const signals = runRuleEngine(dashboardData, currentDay);

    const summary = {
      remainingBudget: dashboardData?.remainingBudget ?? 0,
      totalSpending,
      unassignedCash: dashboardData?.unassignedCash ?? 0,
      budgetBreakdown: dashboardData?.budgetBreakdown ?? [],
      recurringOverdue: recurringSummary?.overdueCount ?? 0,
      recurringUpcoming: recurringSummary?.upcoming?.length ?? 0,
    };

    const insight = await fetchGeminiInsight(signals, summary);

    await ctx.runMutation(internal.coach.saveGeminiInsight, {
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
    } else {
      await ctx.db.insert("coachInsights", {
        householdId,
        month,
        year,
        dataHash: "",
        signals: [],
        geminiInsight: insight,
        insightSource,
        generatedAt: Date.now(),
      });
    }
  },
});

// ─── Gemini Helper ───

async function fetchGeminiInsight(signals: any[], summary: any): Promise<{ insight: string } | null> {
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
