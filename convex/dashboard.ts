import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper for Auth Check
async function ensureHouseholdAccess(ctx: QueryCtx, householdId: Id<"households">, userId: string) {
    const member = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", (q) =>
            q.eq("householdId", householdId).eq("userId", userId)
        )
        .first();
    return !!member;
}

export const getTotals = query({
  args: {
    householdId: v.optional(v.id("households")),
    dateRange: v.optional(v.object({
      start: v.string(),
      end: v.string(),
    })),
  },
  handler: async (ctx, { householdId, dateRange }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let transactions;
    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) return { income: 0, expense: 0 };
        let q = ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId));
        if (dateRange) {
             q = q.filter((q) => q.and(q.gte(q.field("date"), dateRange.start), q.lte(q.field("date"), dateRange.end)));
        }
        transactions = await q.collect();
    } else {
        let q = ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", identity.subject));
        if (dateRange) {
            q = q.filter((q) => q.and(q.gte(q.field("date"), dateRange.start), q.lte(q.field("date"), dateRange.end)));
        }
        transactions = await q.collect();
    }

    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => acc + parseFloat(t.amount.replace(/,/g, '')), 0);

    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => acc + parseFloat(t.amount.replace(/,/g, '')), 0);

    return { income, expense };
  },
});

export const getSpendingByCategory = query({
  args: {
    householdId: v.optional(v.id("households")),
    dateRange: v.optional(v.object({
      start: v.string(),
      end: v.string(),
    })),
  },
  handler: async (ctx, { householdId, dateRange }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let transactions;
    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) return [];
        let q = ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId));
        if (dateRange) {
             q = q.filter((q) => q.and(q.gte(q.field("date"), dateRange.start), q.lte(q.field("date"), dateRange.end)));
        }
        transactions = await q.collect();
    } else {
        let q = ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", identity.subject));
        if (dateRange) {
            q = q.filter((q) => q.and(q.gte(q.field("date"), dateRange.start), q.lte(q.field("date"), dateRange.end)));
        }
        transactions = await q.collect();
    }

    const expenseTransactions = transactions.filter((t) => t.type === "expense");

    let categories;
    if (householdId) {
        categories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        categories = await ctx.db.query("categories").withIndex("by_userId", (q) => q.eq("userId", identity.subject)).collect();
    }

    const spendingByCategory = categories.map(category => {
      const categorySpending = expenseTransactions
        .filter(t => t.categoryId === category._id)
        .reduce((acc, t) => acc + parseFloat(t.amount.replace(/,/g, '')), 0);
      return { name: category.name, value: categorySpending };
    }).filter(c => c.value > 0);

    return spendingByCategory;
  },
});

export const getDashboardSummary = query({
  args: { householdId: v.optional(v.id("households")) },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    if (householdId && !(await ensureHouseholdAccess(ctx, householdId, userId))) {
        return null;
    }

    // 1. Total Account Cash Balance
    let accounts;
    if (householdId) {
        accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        accounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    
    const totalCash = accounts
      .filter(a => a.type !== 'ASSET')
      .reduce((acc, a) => acc + parseFloat(a.balance.replace(/,/g, '') || '0'), 0);

    const accountBreakdown = accounts
      .filter(a => a.type !== 'ASSET')
      .map(a => ({
        name: a.name,
        balance: parseFloat(a.balance.replace(/,/g, '') || '0')
      }));

    // 2. Remaining Budget
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).toISOString();

    let budgets;
    if (householdId) {
        budgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", currentYear).eq("month", currentMonth)).collect();
    } else {
        budgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => 
            q.eq("userId", userId).eq("year", currentYear).eq("month", currentMonth)
        ).collect();
    }

    let transactions;
    if (householdId) {
        transactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        transactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    const currentMonthExpenses = transactions.filter(t => 
      t.type === 'expense' && t.date >= startOfMonth && t.date <= endOfMonth
    );

    const spendingByCategory: Record<string, number> = {};
    currentMonthExpenses.forEach((t) => {
      if (t.isSplit && t.splits) {
        t.splits.forEach((split) => {
          if (split.categoryId && split.amount) {
            const amount = parseFloat(split.amount.replace(/,/g, ''));
            if (!isNaN(amount)) {
              spendingByCategory[split.categoryId] = (spendingByCategory[split.categoryId] || 0) + amount;
            }
          }
        });
      } else if (t.categoryId && t.amount) {
        const amount = parseFloat(t.amount.replace(/,/g, ''));
        if (!isNaN(amount)) {
          spendingByCategory[t.categoryId] = (spendingByCategory[t.categoryId] || 0) + amount;
        }
      }
    });

    let totalBudgetLimit = 0;
    let totalBudgetSpent = 0;

    budgets.forEach(b => {
      totalBudgetLimit += parseFloat(b.amount.replace(/,/g, '') || '0');
      totalBudgetSpent += spendingByCategory[b.categoryId] || 0;
    });

    const remainingBudget = Math.max(0, totalBudgetLimit - totalBudgetSpent);

    // 2.1 Budget Breakdown
    let categories;
    if (householdId) {
        categories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        categories = await ctx.db.query("categories").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    
    const categoryMap = new Map(categories.map(c => [c._id, c.name]));

    // 2.2 Get Previous Month Data for Dashboard
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }
    const startOfPrevMonth = new Date(prevYear, prevMonth, 1).toISOString();
    const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999).toISOString();

    let prevBudgets;
    if (householdId) {
        prevBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", prevYear).eq("month", prevMonth)).collect();
    } else {
        prevBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => 
            q.eq("userId", userId).eq("year", prevYear).eq("month", prevMonth)
        ).collect();
    }

    const prevMonthExpenses = transactions.filter(t => 
      t.type === 'expense' && t.date >= startOfPrevMonth && t.date <= endOfPrevMonth
    );

    const prevSpendingByCategory: Record<string, number> = {};
    prevMonthExpenses.forEach((t) => {
      if (t.isSplit && t.splits) {
        t.splits.forEach((split) => {
          if (split.categoryId && split.amount) {
            const amount = parseFloat(split.amount.replace(/,/g, ''));
            if (!isNaN(amount)) {
              prevSpendingByCategory[split.categoryId] = (prevSpendingByCategory[split.categoryId] || 0) + amount;
            }
          }
        });
      } else if (t.categoryId && t.amount) {
        const amount = parseFloat(t.amount.replace(/,/g, ''));
        if (!isNaN(amount)) {
          prevSpendingByCategory[t.categoryId] = (prevSpendingByCategory[t.categoryId] || 0) + amount;
        }
      }
    });

    const prevBudgetMap = new Map(prevBudgets.map(b => [b.categoryId, b]));

    const budgetBreakdown = budgets.map(b => {
      const limit = parseFloat(b.amount.replace(/,/g, '') || '0');
      const spent = spendingByCategory[b.categoryId] || 0;
      
      const prevBudget = prevBudgetMap.get(b.categoryId);
      const prevSpent = prevSpendingByCategory[b.categoryId] || 0;
      let lastMonthPerformance = null;
      if (prevBudget) {
          lastMonthPerformance = parseFloat(prevBudget.amount) - prevSpent;
      }

      return {
        categoryName: categoryMap.get(b.categoryId) || 'Unknown',
        limit,
        spent,
        remaining: Math.max(0, limit - spent),
        lastMonthPerformance
      };
    });

    // 3. Recent 7 Transactions
    // Sorting by date desc in memory since no date index
    const sortedTransactions = transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 7);

    const recentTransactions = await Promise.all(
        sortedTransactions.map(async (t) => {
            const fromAccount = await ctx.db.get(t.accountId);
            const toAccount = t.toAccountId ? await ctx.db.get(t.toAccountId) : null;
            const category = t.categoryId ? await ctx.db.get(t.categoryId) : null;
            const label = t.labelId ? await ctx.db.get(t.labelId) : null;

            // Join category names for splits if they exist
            const splitsWithDetails = t.splits 
              ? await Promise.all(t.splits.map(async (split) => {
                  const splitCategory = await ctx.db.get(split.categoryId);
                  return {
                    ...split,
                    categoryName: splitCategory?.name,
                  };
                }))
              : undefined;

            return {
                ...t,
                fromAccountName: fromAccount?.name,
                toAccountName: toAccount?.name,
                categoryName: category?.name,
                label,
                splits: splitsWithDetails,
            };
        })
    );

    return {
      totalCash,
      accountBreakdown,
      remainingBudget,
      budgetBreakdown,
      recentTransactions,
    };
  },
});