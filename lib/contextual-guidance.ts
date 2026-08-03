export const BUDGET_WARNING_THRESHOLD = 0.2;
export const GOAL_NEAR_COMPLETE = 0.8;

export type GuidanceScenario =
  | "budget_warning"
  | "goal_opportunity"
  | "safe_to_save"
  | "positive_reinforcement";

export type GuidanceCard = {
  scenario: GuidanceScenario;
  title: string;
  description: string;
  ctaLabel: "View Budget" | "Quick Save" | "Continue";
  action: "view-budget" | "quick-save" | "dismiss";
  goalCategoryId?: string;
  goalAccountId?: string;
  usedPercentage?: number; // 0..100, only for budget_warning
};

export type GuidanceInput = {
  affectedCategory: {
    categoryName: string;
    hasBudget: boolean;              // effective limit > 0
    budgetLimit: number | null;      // effective limit = amount + carryover - swept
    spent: number;                   // fiscal-period spending
    isWeekly: boolean;               // allowanceType === "weekly"
    weeklySpent: number | null;      // null unless isWeekly
    weeklyRemaining?: number | null; // caller computes for weekly mode
  };
  goals: Array<{
    categoryId: string;
    categoryName: string;
    currentAmount: number;           // accumulated
    targetAmount: number;
    progress: number;                // 0..1
    monthlyLimit: number;
    monthlyContribution: number;
    linkedAccountId?: string;
  }>;
  displayName: string;
};

/** "Rp250.000" — whole rupiah, dot grouping, no decimals. */
export function formatGuidanceAmount(n: number): string {
  return "Rp" + Math.round(Math.max(0, n)).toLocaleString("id-ID");
}

export function getGuidance(input: GuidanceInput): GuidanceCard | null {
  const { affectedCategory: c, goals, displayName } = input;

  const fiscalRemaining = c.hasBudget && c.budgetLimit ? c.budgetLimit - c.spent : 0;

  // Remaining ratio per pacing mode.
  let ratio: number | null = null;
  if (c.isWeekly) {
    const weeklyTotal = (c.weeklyRemaining ?? 0) + (c.weeklySpent ?? 0);
    ratio = weeklyTotal > 0 ? (c.weeklyRemaining ?? 0) / weeklyTotal : (c.hasBudget ? 0 : null);
  } else if (c.hasBudget && c.budgetLimit && c.budgetLimit > 0) {
    ratio = fiscalRemaining / c.budgetLimit;
  }

  const underBudget =
    (ratio !== null && ratio < BUDGET_WARNING_THRESHOLD) ||
    fiscalRemaining <= 0 ||
    (c.isWeekly && (c.weeklyRemaining ?? 0) <= 0);

  // 1. Budget Warning (never uses name)
  if (c.hasBudget && c.budgetLimit && underBudget) {
    const used = c.budgetLimit > 0 ? Math.round((c.spent / c.budgetLimit) * 100) : 0;
    return {
      scenario: "budget_warning",
      title: "Budget Alert",
      description: `Your ${c.categoryName} budget is ${used}% used.`,
      ctaLabel: "View Budget",
      action: "view-budget",
      usedPercentage: used,
    };
  }

  const activeGoals = goals.filter((g) => g.targetAmount > 0 && g.progress < 1);

  // 2. Goal Opportunity: nearest to completing (>= 80%)
  const nearComplete = activeGoals
    .filter((g) => g.progress >= GOAL_NEAR_COMPLETE)
    .sort((a, b) => b.progress - a.progress)[0];

  if (nearComplete) {
    const remaining = Math.max(0, nearComplete.targetAmount - nearComplete.currentAmount);
    return {
      scenario: "goal_opportunity",
      title: "Almost There",
      description: `Great job, ${displayName}. Only ${formatGuidanceAmount(remaining)} left to complete ${nearComplete.categoryName}.`,
      ctaLabel: "Quick Save",
      action: "quick-save",
      goalCategoryId: nearComplete.categoryId,
      goalAccountId: nearComplete.linkedAccountId,
    };
  }

  // 3. Safe To Save: on track + at least one active goal
  if (c.hasBudget && activeGoals.length > 0) {
    const safeGoal = activeGoals
      .map((g) => ({ g, gap: Math.max(0, g.monthlyLimit - g.monthlyContribution) }))
      .sort((a, b) => b.gap - a.gap)[0]?.g || activeGoals[0];
    return {
      scenario: "safe_to_save",
      title: "Good News",
      description: `Great job, ${displayName}. You're still comfortably within your spending plan this week.`,
      ctaLabel: "Quick Save",
      action: "quick-save",
      goalCategoryId: safeGoal.categoryId,
      goalAccountId: safeGoal.linkedAccountId,
    };
  }

  // 4. Positive Reinforcement: healthy + no active goal
  if (c.hasBudget) {
    return {
      scenario: "positive_reinforcement",
      title: "You're On Track",
      description: `Great progress, ${displayName}. Your spending is within this week's budget.`,
      ctaLabel: "Continue",
      action: "dismiss",
    };
  }

  return null;
}
