import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

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

    // 0. Fetch Accounts (Needed for split balance and type checking)
    let accounts;
    if (householdId) {
        accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        accounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    // 1. Split Balances
    const liquidCash = accounts
      .filter((a: Doc<"accounts">) => !a.type || a.type === 'CASH')
      .reduce((acc: number, a: Doc<"accounts">) => acc + parseFloat(a.balance.replace(/,/g, '') || '0'), 0);

    const totalSavingsOnly = accounts
      .filter((a: Doc<"accounts">) => a.type === 'SAVING')
      .reduce((acc: number, a: Doc<"accounts">) => acc + parseFloat(a.balance.replace(/,/g, '') || '0'), 0);

    const totalAssetsOnly = accounts
      .filter((a: Doc<"accounts">) => a.type === 'ASSET')
      .reduce((acc: number, a: Doc<"accounts">) => acc + parseFloat(a.balance.replace(/,/g, '') || '0'), 0);

    const cashAccounts = accounts
      .filter((a: Doc<"accounts">) => !a.type || a.type === 'CASH')
      .map((a: Doc<"accounts">) => ({
        name: a.name,
        balance: parseFloat(a.balance.replace(/,/g, '') || '0')
      }));

    const savingAccounts = accounts
      .filter((a: Doc<"accounts">) => a.type === 'SAVING')
      .map((a: Doc<"accounts">) => ({
        name: a.name,
        balance: parseFloat(a.balance.replace(/,/g, '') || '0')
      }));

    const assetAccounts = accounts
      .filter((a: Doc<"accounts">) => a.type === 'ASSET')
      .map((a: Doc<"accounts">) => ({
        name: a.name,
        balance: parseFloat(a.balance.replace(/,/g, '') || '0')
      }));

    // 2. Remaining Budget Logic (Monthly)
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

    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    const currentMonthExpenses = allTransactions.filter(t => {
      const isDateMatch = t.date >= startOfMonth && t.date <= endOfMonth;
      if (!isDateMatch) return false;

      // Expense & Saving types are always spending
      if (t.type === 'expense' || t.type === 'saving') return true;

      // Transfer logic: Only count as Spending if moving from Liquid (Cash) -> Non-Liquid (Saving/Asset)
      if (t.type === 'transfer' && t.categoryId && t.accountId && t.toAccountId) {
          const accountTypeMap = new Map(accounts.map(a => [a._id, a.type || 'CASH']));
          const isSpecial = (id: string) => {
              const type = accountTypeMap.get(id as Id<"accounts">);
              return type === 'ASSET' || type === 'SAVING';
          };

          const sourceIsSpecial = isSpecial(t.accountId); // e.g. Gold
          const destIsSpecial = isSpecial(t.toAccountId); // e.g. Cash (False)

          // Only count Nabung (Cash -> Goal)
          if (!sourceIsSpecial && destIsSpecial) {
              return true;
          }
      }
      
      return false;
    });

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

    // Calculate Accumulated (All Time) for Savings
    const accumulatedMap = new Map<string, number>();
    const accountTypeMap = new Map(accounts.map(a => [a._id, a.type || 'CASH']));
    const isSpecial = (id: string) => {
        const type = accountTypeMap.get(id as Id<"accounts">);
        return type === 'ASSET' || type === 'SAVING';
    };

    allTransactions.forEach((t: Doc<"transactions">) => {
        const val = Math.abs(parseFloat(t.amount.replace(/,/g, '') || '0'));
        if ((t.type === 'expense' || t.type === 'saving') && t.categoryId) {
            accumulatedMap.set(t.categoryId, (accumulatedMap.get(t.categoryId) || 0) + val);
        }
        if (t.type === 'transfer' && t.categoryId && t.accountId && t.toAccountId) {
            if (!isSpecial(t.accountId) && isSpecial(t.toAccountId)) {
                accumulatedMap.set(t.categoryId, (accumulatedMap.get(t.categoryId) || 0) + val);
            }
            if (isSpecial(t.accountId) && !isSpecial(t.toAccountId)) {
                accumulatedMap.set(t.categoryId, (accumulatedMap.get(t.categoryId) || 0) - val);
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

    // 2.1 Categories Info
    let categories;
    if (householdId) {
        categories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        categories = await ctx.db.query("categories").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const catDetailsMap = new Map(categories.map(c => [c._id, c]));

    const budgetBreakdown = budgets.map(b => {
      const cat = catDetailsMap.get(b.categoryId);
      const limit = parseFloat(b.amount.replace(/,/g, '') || '0');
      const spent = spendingByCategory[b.categoryId] || 0;
      const accumulated = accumulatedMap.get(b.categoryId) || 0;
      
      return {
        categoryName: cat?.name || 'Unknown',
        categoryType: cat?.type || 'expense',
        targetAmount: cat?.targetAmount ? parseFloat(cat.targetAmount.replace(/,/g, '')) : undefined,
        accumulated,
        limit,
        spent,
        remaining: Math.max(0, limit - spent),
      };
    });

    // 3. Recent Transactions
    const sortedTransactions = allTransactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 7);

    const recentTransactions = await Promise.all(
        sortedTransactions.map(async (t) => {
            const fromAccount = await ctx.db.get(t.accountId);
            const toAccount = t.toAccountId ? await ctx.db.get(t.toAccountId) : null;
            const category = t.categoryId ? await ctx.db.get(t.categoryId) : null;
            const label = t.labelId ? await ctx.db.get(t.labelId) : null;

            return {
                ...t,
                fromAccountName: fromAccount?.name,
                toAccountName: toAccount?.name,
                categoryName: category?.name,
                label,
            };
        })
    );

    return {
      liquidCash,
      totalSavingsOnly,
      totalAssetsOnly,
      cashAccounts,
      savingAccounts,
      assetAccounts,
      remainingBudget,
      budgetBreakdown,
      recentTransactions,
    };
  },
});