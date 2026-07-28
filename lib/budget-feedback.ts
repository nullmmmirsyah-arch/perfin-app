export type BudgetStatus = "healthy" | "moderate" | "low" | "exceeded";

export function computeBudgetStatus(remaining: number, total: number): BudgetStatus | null {
  if (total <= 0) return null;
  const ratio = remaining / total;
  if (remaining < 0) return "exceeded";
  if (ratio <= 0.25) return "low";
  if (ratio <= 0.5) return "moderate";
  return "healthy";
}

export const BUDGET_FEEDBACK_MESSAGES: Record<BudgetStatus, string> = {
  healthy: "You're on track.",
  moderate: "Keep an eye on your spending.",
  low: "You're getting close to this week's budget.",
  exceeded: "You've exceeded this week's budget. Tomorrow is a fresh start.",
};
