import { query } from "./_generated/server";
import { v } from "convex/values";

export const getTotals = query({
  args: {
    dateRange: v.optional(v.object({
      start: v.string(),
      end: v.string(),
    })),
  },
  handler: async (ctx, { dateRange }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let transactions;
    if (dateRange) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .filter((q) => q.and(q.gte(q.field("date"), dateRange.start), q.lte(q.field("date"), dateRange.end)))
        .collect();
    } else {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .collect();
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
    dateRange: v.optional(v.object({
      start: v.string(),
      end: v.string(),
    })),
  },
  handler: async (ctx, { dateRange }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let transactions;
    if (dateRange) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .filter((q) => q.and(q.gte(q.field("date"), dateRange.start), q.lte(q.field("date"), dateRange.end)))
        .collect();
    } else {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .collect();
    }

    const expenseTransactions = transactions.filter((t) => t.type === "expense");

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

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
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // 1. Total Account Cash Balance
    // Assuming accounts with type !== 'ASSET' are cash/bank accounts
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    
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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

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
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    
    const categoryMap = new Map(categories.map(c => [c._id, c.name]));

    const budgetBreakdown = budgets.map(b => {
      const limit = parseFloat(b.amount.replace(/,/g, '') || '0');
      const spent = spendingByCategory[b.categoryId] || 0;
      return {
        categoryName: categoryMap.get(b.categoryId) || 'Unknown',
        limit,
        spent,
        remaining: Math.max(0, limit - spent)
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
