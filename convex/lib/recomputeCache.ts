import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import {
  calculateSpendingByCategory,
  calculateUnassignedCash,
  AccountMap,
  getFiscalDateDetails,
  analyzeTransactionFlow,
} from "./finance";

export async function recomputeUserCache(
  ctx: MutationCtx,
  userId: string,
  householdId?: Id<"households">
): Promise<void> {
  // 1. Fetch all data in parallel
  let startDay = 1;

  let transactionsPromise, accountsPromise, categoriesPromise, budgetsPromise;

  if (householdId) {
    transactionsPromise = ctx.db
      .query("transactions")
      .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
      .collect();
    accountsPromise = ctx.db
      .query("accounts")
      .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
      .collect();
    categoriesPromise = ctx.db
      .query("categories")
      .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
      .collect();
    budgetsPromise = ctx.db
      .query("budgets")
      .withIndex("by_householdId_year_month", (q) => q.eq("householdId", householdId))
      .collect();

  } else {
    transactionsPromise = ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    accountsPromise = ctx.db
      .query("accounts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    categoriesPromise = ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    budgetsPromise = ctx.db
      .query("budgets")
      .withIndex("by_userId_year_month", (q) => q.eq("userId", userId))
      .collect();
  }

  const [allTransactions, allAccounts, allCategories, allBudgets] = await Promise.all([
    transactionsPromise,
    accountsPromise,
    categoriesPromise,
    budgetsPromise,
  ]);

  if (householdId) {
    const household = await ctx.db.get(householdId);
    startDay = household?.budgetStartDay || 1;
  }

  const accountsMap: AccountMap = new Map(allAccounts.map((a) => [String(a._id), a]));
  const categoriesMap = new Map(allCategories.map((c) => [String(c._id), c]));

  // 2. Accumulated (all-time spending per category)
  const accumulatedByCategory = Object.entries(
    calculateSpendingByCategory(allTransactions, accountsMap, categoriesMap)
  ).map(([categoryId, amount]) => ({ categoryId, amount }));

  // 3. Monthly spending (for trends)
  const monthlyMap = new Map<string, Map<string, number>>();
  for (const tx of allTransactions) {
    const flows = analyzeTransactionFlow(tx, accountsMap, categoriesMap);
    const { year, month } = getFiscalDateDetails(tx.date, startDay);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!monthlyMap.has(key)) monthlyMap.set(key, new Map());
    const catMap = monthlyMap.get(key)!;
    for (const flow of flows) {
      if (flow.type === "SPENDING") {
        catMap.set(flow.categoryId, (catMap.get(flow.categoryId) || 0) + flow.amount);
      }
    }
  }
  const monthlySpending = Array.from(monthlyMap.entries())
    .map(([key, spending]) => {
      const [yearStr, monthStr] = key.split("-");
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const entries = Array.from(spending.entries()).map(([categoryId, amount]) => ({
        categoryId,
        amount,
      }));
      const totalSpent = entries.reduce((sum, e) => sum + e.amount, 0);
      return { year, month, spending: entries, totalSpent };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);

  // 4. Unassigned cash
  const unassignedCash = calculateUnassignedCash(
    allTransactions,
    allBudgets,
    accountsMap,
    startDay,
    categoriesMap
  );

  // 5. Upsert cache
  const existing = householdId
    ? await ctx.db
        .query("userCaches")
        .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
        .first()
    : await ctx.db
        .query("userCaches")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();

  const cacheData = {
    userId,
    householdId,
    accumulatedByCategory,
    unassignedCash,
    monthlySpending,
    lastUpdatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, cacheData);
  } else {
    await ctx.db.insert("userCaches", cacheData);
  }
}

export async function getCache(
  ctx: QueryCtx,
  userId: string,
  householdId?: Id<"households">
): Promise<Doc<"userCaches"> | null> {
  const existing = householdId
    ? await ctx.db
        .query("userCaches")
        .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
        .first()
    : await ctx.db
        .query("userCaches")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();

  return existing ?? null;
}
