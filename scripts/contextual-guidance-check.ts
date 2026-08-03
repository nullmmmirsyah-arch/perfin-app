// Standalone smoke test for lib/contextual-guidance.ts (no framework).
// Run: npx tsx scripts/contextual-guidance-check.ts
import { getGuidance, GuidanceInput } from "../lib/contextual-guidance";

const base = (over: Partial<GuidanceInput["affectedCategory"]> = {}): GuidanceInput["affectedCategory"] => ({
  categoryName: "Food",
  hasBudget: true,
  budgetLimit: 1000,
  spent: 900,
  isWeekly: true,
  weeklySpent: 900,
  weeklyRemaining: 100,
  ...over,
});

const baseGoals = (): GuidanceInput["goals"] => [
  {
    categoryId: "g1",
    categoryName: "Emergency Fund",
    currentAmount: 900,
    targetAmount: 1000,
    progress: 0.9,
    monthlyLimit: 200,
    monthlyContribution: 100,
    linkedAccountId: "acc1",
  },
];

const mk = (affectedCategory: GuidanceInput["affectedCategory"], goals: GuidanceInput["goals"] = baseGoals(), displayName = "Kevin"): GuidanceInput => ({
  affectedCategory,
  goals,
  displayName,
});

let failures = 0;
function expect(cond: boolean, name: string) {
  if (!cond) { failures++; console.log("FAIL:", name); } else { console.log("ok:", name); }
}

// Budget warning (weekly under 20%)
expect(getGuidance(mk(base()))?.scenario === "budget_warning", "budget_warning weekly");

// Budget warning (budget_period, exhausted)
expect(
  getGuidance(mk({ ...base(), isWeekly: false, weeklySpent: null, weeklyRemaining: null, spent: 980, budgetLimit: 1000 }))?.scenario === "budget_warning",
  "budget_warning period"
);

// Goal opportunity outranks safe: on-track category + near-complete goal
const g = getGuidance(
  mk(
    { ...base(), spent: 400, budgetLimit: 1000, isWeekly: false, weeklySpent: null, weeklyRemaining: null }
  )
);
expect(g?.scenario === "goal_opportunity" && g?.goalCategoryId === "g1", "goal_opportunity picked");

// Safe to save: no near-complete goal, but active goal present
const safeGoals = [
  { categoryId: "g2", categoryName: "Holiday", currentAmount: 200, targetAmount: 2000, progress: 0.1, monthlyLimit: 300, monthlyContribution: 50, linkedAccountId: "acc2" },
];
const safe = getGuidance(
  mk(
    { ...base(), spent: 400, budgetLimit: 1000, isWeekly: false, weeklySpent: null, weeklyRemaining: null },
    safeGoals
  )
);
expect(safe?.scenario === "safe_to_save" && safe?.goalCategoryId === "g2", "safe_to_save with active goal");

// Positive: on track, no goals
const pos = getGuidance(mk({ ...base(), spent: 400, budgetLimit: 1000, isWeekly: false, weeklySpent: null, weeklyRemaining: null }, []));
expect(pos?.scenario === "positive_reinforcement", "positive_reinforcement no goals");

// null: no budget, no near-complete goal
const none = getGuidance(mk({ categoryName: "Food", hasBudget: false, budgetLimit: null, spent: 0, isWeekly: false, weeklySpent: null }, [{
  categoryId: "g3", categoryName: "Vacation", currentAmount: 100, targetAmount: 2000, progress: 0.05, monthlyLimit: 0, monthlyContribution: 0, linkedAccountId: "acc3",
}]));
expect(none === null, "null when no budget & no near goal");

if (failures > 0) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log("ALL CHECKS PASSED");
