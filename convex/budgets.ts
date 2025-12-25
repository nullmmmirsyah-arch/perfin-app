import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

async function ensureHouseholdAccess(ctx: QueryCtx, householdId: Id<"households">, userId: string) {
    const member = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", (q) =>
            q.eq("householdId", householdId).eq("userId", userId)
        )
        .first();
    return !!member;
}

export const get = query({
  args: { householdId: v.optional(v.id("households")) },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) return [];
        return await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
        return await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", identity.subject)).collect();
    }
  },
});

export const getBudgetStatus = query({
  args: {
    householdId: v.optional(v.id("households")),
    month: v.optional(v.number()), // 0-11
    year: v.optional(v.number()),
  },
  handler: async (ctx, { householdId, month, year }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) return [];
    }

    const now = new Date();
    const currentYear = year ?? now.getFullYear();
    const currentMonth = month ?? now.getMonth();
    
    // 1. Get all categories
    let categories;
    if (householdId) {
        categories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        categories = await ctx.db.query("categories").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    // 2. Get budgets for THIS SPECIFIC PERIOD
    let budgets;
    if (householdId) {
        budgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", currentYear).eq("month", currentMonth)).collect();
    } else {
        budgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => 
            q.eq("userId", userId).eq("year", currentYear).eq("month", currentMonth)
        ).collect();
    }

    // 3. Calculate date range for the month
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // 4. Get transactions for the month
    let transactions;
    if (householdId) {
        transactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        transactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    const transactionsInMonth = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= startOfMonth && tDate <= endOfMonth;
    });

    // 4b. Get Previous Month Data
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }
    const startOfPrevMonth = new Date(prevYear, prevMonth, 1);
    const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);

    let prevBudgets;
    if (householdId) {
        prevBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", prevYear).eq("month", prevMonth)).collect();
    } else {
        prevBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => 
            q.eq("userId", userId).eq("year", prevYear).eq("month", prevMonth)
        ).collect();
    }

    const prevBudgetMap = new Map(prevBudgets.map(b => [b.categoryId, b]));
    
    const prevTransactionsInMonth = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= startOfPrevMonth && tDate <= endOfPrevMonth;
    });

    const prevSpendingByCategory: Record<string, number> = {};
    prevTransactionsInMonth.forEach((t) => {
      if (t.type !== 'expense') return;
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


    // 5. Aggregate spending by category
    const spendingByCategory: Record<string, number> = {};
    transactionsInMonth.forEach((t) => {
      if (t.type !== 'expense') return;

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

    // 6. Combine data
    const budgetMap = new Map(budgets.map(b => [b.categoryId, b]));

    return categories
        .filter(c => c.type === 'expense')
        .map((category) => {
            const budget = budgetMap.get(category._id);
            const spent = spendingByCategory[category._id] || 0;
            
            const prevBudget = prevBudgetMap.get(category._id);
            const prevSpent = prevSpendingByCategory[category._id] || 0;
            const lastMonthStatus = prevBudget ? {
                amount: parseFloat(prevBudget.amount),
                spent: prevSpent
            } : null;

            return {
                category,
                budget,
                spent,
                lastMonthStatus
            };
    });
  },
});

export const getBudgetAssistance = query({
  args: {
    householdId: v.optional(v.id("households")),
    categoryId: v.id("categories"),
    targetMonth: v.number(),
    targetYear: v.number(),
  },
  handler: async (ctx, { householdId, categoryId, targetMonth, targetYear }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    // 1. Previous Month's Budget
    let prevMonth = targetMonth - 1;
    let prevYear = targetYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }

    let prevBudget;
    if (householdId) {
        prevBudget = await ctx.db.query("budgets")
            .withIndex("by_householdId_category_year_month", q => q.eq("householdId", householdId).eq("categoryId", categoryId).eq("year", prevYear).eq("month", prevMonth))
            .first();
    } else {
        prevBudget = await ctx.db
            .query("budgets")
            .withIndex("by_user_category_year_month", (q) => 
                q.eq("userId", userId)
                .eq("categoryId", categoryId)
                .eq("year", prevYear)
                .eq("month", prevMonth)
            )
            .first();
    }

    // 2. Previous Month's Spending
    const startOfPrevMonth = new Date(prevYear, prevMonth, 1);
    const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);

    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    let prevMonthSpent = 0;
    
    const addAmount = (t: Doc<"transactions">, amountStr: string, catId: string) => {
       if (catId === categoryId) {
         const val = parseFloat(amountStr.replace(/,/g, ''));
         if (!isNaN(val)) prevMonthSpent += val;
       }
    };

    allTransactions.forEach(t => {
       const tDate = new Date(t.date);
       if (t.type === 'expense' && tDate >= startOfPrevMonth && tDate <= endOfPrevMonth) {
          if (t.isSplit && t.splits) {
            t.splits.forEach(s => addAmount(t, s.amount, s.categoryId));
          } else if (t.categoryId) {
             addAmount(t, t.amount, t.categoryId);
          }
       }
    });

    // 3. Average Spending (Last 3 months with data)
    let totalSpent3Months = 0;
    let monthsWithData = 0;

    for (let i = 1; i <= 3; i++) {
        let m = targetMonth - i;
        let y = targetYear;
        while (m < 0) { m += 12; y--; }
        
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
        
        let monthSum = 0;
        let hasData = false;

        allTransactions.forEach(t => {
          const tDate = new Date(t.date);
          if (t.type === 'expense' && tDate >= start && tDate <= end) {
              if (t.isSplit && t.splits) {
                t.splits.forEach(s => {
                    if(s.categoryId === categoryId) {
                        monthSum += parseFloat(s.amount.replace(/,/g, '') || '0');
                        hasData = true;
                    }
                });
              } else if (t.categoryId === categoryId) {
                 monthSum += parseFloat(t.amount.replace(/,/g, '') || '0');
                 hasData = true;
              }
          }
        });

        if (hasData) {
            totalSpent3Months += monthSum;
            monthsWithData++;
        }
    }

    const averageSpent = monthsWithData > 0 ? totalSpent3Months / monthsWithData : 0;

    return {
      lastMonthBudget: prevBudget?.amount,
      lastMonthSpent: prevMonthSpent,
      averageSpent: averageSpent,
    };
  }
});

export const upsertBudget = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    categoryId: v.id("categories"),
    amount: v.string(),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, { householdId, ...args }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    // 1. Calculate Total Available Cash
    let accounts;
    if (householdId) {
        accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        accounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    const totalCash = accounts
      .filter(a => a.type !== 'ASSET')
      .reduce((acc, a) => acc + parseFloat(a.balance.replace(/,/g, '') || '0'), 0);

    // 2. Calculate Total Budgeted Amount for this Period
    let currentPeriodBudgets;
    if (householdId) {
        currentPeriodBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", args.year).eq("month", args.month)).collect();
    } else {
        currentPeriodBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => 
            q.eq("userId", userId).eq("year", args.year).eq("month", args.month)
        ).collect();
    }
    
    const otherBudgetsTotal = currentPeriodBudgets
        .filter(b => b.categoryId !== args.categoryId)
        .reduce((acc, b) => acc + parseFloat(b.amount.replace(/,/g, '') || '0'), 0);
    
    const newBudgetAmount = parseFloat(args.amount.replace(/,/g, '') || '0');
    
    if (otherBudgetsTotal + newBudgetAmount > totalCash) {
        throw new Error(`Insufficient funds. Available: ${totalCash.toLocaleString()}, Required: ${(otherBudgetsTotal + newBudgetAmount).toLocaleString()}.`);
    }

    let existingBudget;
    if (householdId) {
        existingBudget = await ctx.db.query("budgets").withIndex("by_householdId_category_year_month", q => q.eq("householdId", householdId).eq("categoryId", args.categoryId).eq("year", args.year).eq("month", args.month)).first();
    } else {
        existingBudget = await ctx.db.query("budgets").withIndex("by_user_category_year_month", (q) => 
            q.eq("userId", identity.subject)
             .eq("categoryId", args.categoryId)
             .eq("year", args.year)
             .eq("month", args.month)
        ).first();
    }

    if (existingBudget) {
      await ctx.db.patch(existingBudget._id, { amount: args.amount });
    } else {
      await ctx.db.insert("budgets", {
        userId: identity.subject,
        householdId,
        categoryId: args.categoryId,
        amount: args.amount,
        year: args.year,
        month: args.month,
      });
    }
  },
});

export const deleteBudget = mutation({
  args: {
    id: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const budget = await ctx.db.get(args.id);
    if (!budget) throw new Error("Budget not found");

    if (budget.householdId) {
        if (!await ensureHouseholdAccess(ctx, budget.householdId, identity.subject)) throw new Error("Unauthorized");
    } else {
        if (budget.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});
