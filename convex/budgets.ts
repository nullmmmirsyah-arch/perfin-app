import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { 
  calculateSpendingByCategory, 
  calculateUnassignedCash, 
  AccountMap 
} from "./lib/finance";

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
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) {
            return {
                data: [],
                unassignedCash: 0,
                hasLeftoverBudget: false,
                breakdown: {
                    thisMonthIncome: 0,
                    thisMonthBudgeted: 0,
                    pastSurplus: 0,
                    totalIncome: 0,
                    totalBudgeted: 0
                }
            };
        }
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

    // 4. Get all transactions (needed for Spending and Unassigned Cash)
    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    const transactionsInMonth = allTransactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= startOfMonth && tDate <= endOfMonth;
    });

    // 5. Get Accounts for Helper Map
    let allAccounts;
    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [a._id, a]));

    // 6. Calculate Spending using Helper
    const spendingByCategory = calculateSpendingByCategory(transactionsInMonth, accountsMap);

    // 7. Calculate Accumulated (All Time) for Savings
    // We can reuse calculateSpendingByCategory for ALL transactions to get accumulated values
    const accumulatedMap = calculateSpendingByCategory(allTransactions, accountsMap);

    // 8. Calculate Unassigned Cash using Helper
    // Need ALL budgets for this
    let allBudgets;
    if (householdId) {
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", userId)).collect();
    }
    
    const unassignedCash = calculateUnassignedCash(allTransactions, allBudgets, accountsMap);

    // 9. Combine data for Response
    const budgetMap = new Map(budgets.map(b => [b.categoryId, b]));

    const data = categories
        .filter(c => (c.type === 'expense' || c.type === 'saving') && c.status !== 'achieved' && c.status !== 'archived' && !c.isArchived)
        .map((category) => {
            const budget = budgetMap.get(category._id);
            const spent = spendingByCategory[category._id] || 0;
            
            // Fix: Calculate Accumulated with Cycle Reset logic
            let accumulated = accumulatedMap[category._id] || 0;
            
            if (category.type === 'saving' && category.lastResetDate) {
                const resetTime = new Date(category.lastResetDate).getTime();
                // Filter transactions relevant to THIS category only
                const relevantTx = allTransactions.filter(t => {
                    const isAfter = new Date(t.date).getTime() > resetTime;
                    if (!isAfter) return false;
                    
                    if (t.categoryId === category._id) return true;
                    if (t.isSplit && t.splits?.some(s => s.categoryId === category._id)) return true;
                    return false;
                });
                
                const cycleMap = calculateSpendingByCategory(relevantTx, accountsMap);
                accumulated = cycleMap[category._id] || 0;
            }
            
            return {
                category,
                budget,
                spent,
                accumulated,
            };
    });

    // Breakdown for UI (Simplified logic or reuse helpers if needed, but for now specific to this month's stats)
    // Reusing unassignedCash from helper covers the main need.
    // The specific 'breakdown' fields might need manual calculation if they are purely visual specific to month.
    
    const startOfSelectedMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const endOfSelectedMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).toISOString();

    // Simplify Breakdown calc just for UI display if needed, or remove if unused.
    // Current UI uses: thisMonthIncome, thisMonthBudgeted, pastSurplus.
    // Let's keep manual calculation for these specific visual breakdowns as they are time-windowed specific.
    // But ensure logic matches helper philosophy (e.g. Transfers).
    // For now, I'll keep the existing breakdown logic but ensure consistency where possible.
    
    // Note: The helper calculates GLOBAL unassigned.
    // Breakdown is localized.
    
    // ... (Keeping breakdown logic simplified or derived) ...
    const thisMonthIncome = allTransactions
        .filter(t => t.type === 'income' && t.date >= startOfSelectedMonth && t.date <= endOfSelectedMonth)
        .reduce((acc, t) => acc + parseFloat(t.amount.replace(/,/g, '') || '0'), 0); // Simplified for now

    const thisMonthBudgeted = budgets.reduce((acc, b) => acc + parseFloat(b.amount.replace(/,/g, '') || '0'), 0);
    
    // Past Surplus = Total Unassigned - (Income This Month - Budgeted This Month) ???
    // Algebra: Unassigned = PastSurplus + (IncomeThisMonth - BudgetedThisMonth)
    // So: PastSurplus = Unassigned - (IncomeThisMonth - BudgetedThisMonth)
    const pastSurplus = unassignedCash - (thisMonthIncome - thisMonthBudgeted);

    const breakdown = {
        thisMonthIncome,
        thisMonthBudgeted,
        pastSurplus,
        totalIncome: 0, // removed from requirement? or calc from helper
        totalBudgeted: 0 
    };

    // 10. Check for Leftover Budget (Sweep) - Refactored using Helper
    let hasLeftoverBudget = false;
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 0) { prevMonth = 11; prevYear--; }
    
    let prevBudgets;
    if (householdId) {
        prevBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", prevYear).eq("month", prevMonth)).collect();
    } else {
        prevBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", userId).eq("year", prevYear).eq("month", prevMonth)).collect();
    }

    if (prevBudgets.length > 0) {
         const startOfPrev = new Date(prevYear, prevMonth, 1);
         const endOfPrev = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);
         
         const prevTransactions = allTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startOfPrev && tDate <= endOfPrev;
         });
         
         const prevSpending = calculateSpendingByCategory(prevTransactions, accountsMap);

         for (const b of prevBudgets) {
             const spent = prevSpending[b.categoryId] || 0;
             const allocated = parseFloat(b.amount.replace(/,/g, '') || '0');
             if (allocated > spent) {
                 hasLeftoverBudget = true;
                 break;
             }
         }
    }

    return { data, unassignedCash, hasLeftoverBudget, breakdown };
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

    // 1. Fetch Data
    let allBudgets;
    if (householdId) {
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", userId)).collect();
    }

    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    let allAccounts;
    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [a._id, a]));

    // 2. Calculate Unassigned Cash (Helper)
    const unassignedCash = calculateUnassignedCash(allTransactions, allBudgets, accountsMap);

    // 3. Previous Month's Budget
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

    // 4. Previous Month's Spending (Helper)
    const startOfPrevMonth = new Date(prevYear, prevMonth, 1);
    const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);

    const prevMonthTransactions = allTransactions.filter(t => {
       const tDate = new Date(t.date);
       return tDate >= startOfPrevMonth && tDate <= endOfPrevMonth;
    });

    const prevMonthSpendingMap = calculateSpendingByCategory(prevMonthTransactions, accountsMap);
    const prevMonthSpent = prevMonthSpendingMap[categoryId] || 0;

    // 5. Average Spending (Last 3 months)
    let totalSpent3Months = 0;
    let monthsWithData = 0;

    for (let i = 1; i <= 3; i++) {
        let m = targetMonth - i;
        let y = targetYear;
        while (m < 0) { m += 12; y--; }
        
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
        
        const monthTx = allTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= start && tDate <= end;
        });
        
        const monthSpendingMap = calculateSpendingByCategory(monthTx, accountsMap);
        const val = monthSpendingMap[categoryId] || 0;

        if (val > 0) {
            totalSpent3Months += val;
            monthsWithData++;
        }
    }

    const averageSpent = monthsWithData > 0 ? totalSpent3Months / monthsWithData : 0;

    return {
      lastMonthBudget: prevBudget?.amount,
      lastMonthSpent: prevMonthSpent,
      averageSpent: averageSpent,
      unassignedCash,
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
    targetAmount: v.optional(v.string()),
    targetDate: v.optional(v.string()),
  },
  handler: async (ctx, { householdId, targetAmount, targetDate, ...args }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    // 0. Update Category Target
    if (targetAmount !== undefined || targetDate !== undefined) {
        const category = await ctx.db.get(args.categoryId);
        if (category) {
            await ctx.db.patch(args.categoryId, {
                targetAmount: targetAmount ?? category.targetAmount,
                targetDate: targetDate ?? category.targetDate,
            });
        }
    }

    // 1. Validate Funds (Unassigned Check)
    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    let allBudgets;
    if (householdId) {
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", userId)).collect();
    }

    let allAccounts;
    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [a._id, a]));

    const unassignedCash = calculateUnassignedCash(allTransactions, allBudgets, accountsMap);

    // Logic: 
    // We need to check if (Available Unassigned + Old Budget Amount) >= New Budget Amount
    // Because Unassigned already subtracted Old Budget Amount.
    
    // Find current budget amount for this specific slot
    const currentBudget = allBudgets.find(b => 
        b.categoryId === args.categoryId && b.year === args.year && b.month === args.month
    );
    const oldAmount = currentBudget ? parseFloat(currentBudget.amount.replace(/,/g, '') || '0') : 0;
    const newAmount = parseFloat(args.amount.replace(/,/g, '') || '0');

    // Available to Allocate for this specific bucket = Unassigned (Free) + Old Allocation (Returned to pool)
    const availableForBucket = unassignedCash + oldAmount;

    if (newAmount > availableForBucket) {
        throw new Error(`Insufficient funds. Available: ${availableForBucket.toLocaleString()}, Required: ${newAmount.toLocaleString()}.`);
    }

    if (currentBudget) {
      await ctx.db.patch(currentBudget._id, { amount: args.amount });
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

export const moveBudgetFunds = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    fromCategoryId: v.optional(v.id("categories")), // null = Unassigned
    toCategoryId: v.id("categories"),
    amount: v.string(),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, { householdId, fromCategoryId, toCategoryId, amount, month, year }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    const moveAmount = parseFloat(amount.replace(/,/g, '') || '0');
    if (moveAmount <= 0) throw new Error("Amount must be greater than 0");

    // 1. Fetch Budgets
    let allBudgets;
    if (householdId) {
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", year).eq("month", month)).collect();
    } else {
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", userId).eq("year", year).eq("month", month)).collect();
    }

    // 2. Determine Source Availability
    if (fromCategoryId) {
        // Move from another Category
        const sourceBudget = allBudgets.find(b => b.categoryId === fromCategoryId);
        const sourceLimit = sourceBudget ? parseFloat(sourceBudget.amount.replace(/,/g, '') || '0') : 0;
        
        // We must check if source has enough *Remaining* (Limit - Spent)
        // Fetch spending for validation
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
        
        let txQuery;
        if (householdId) {
            txQuery = ctx.db.query("transactions").withIndex("by_householdId_date", q => q.eq("householdId", householdId));
        } else {
            txQuery = ctx.db.query("transactions").withIndex("by_userId_date", q => q.eq("userId", userId));
        }
        
        const transactions = await txQuery
            .filter(q => q.gte(q.field("date"), startOfMonth.toISOString()) && q.lte(q.field("date"), endOfMonth.toISOString()))
            .collect();

        // Get Account Map for accurate spending calculation
        let allAccounts;
        if (householdId) {
            allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        } else {
            allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
        }
        const accountsMap: AccountMap = new Map(allAccounts.map(a => [a._id, a]));

        const spendingMap = calculateSpendingByCategory(transactions, accountsMap);
        const sourceSpent = spendingMap[fromCategoryId] || 0;
        const sourceAvailable = Math.max(0, sourceLimit - sourceSpent);

        if (moveAmount > sourceAvailable) {
            throw new Error(`Insufficient funds in source category. Available: ${sourceAvailable.toLocaleString()}`);
        }

        // Reduce Source Budget
        if (sourceBudget) {
            const newSourceAmount = sourceLimit - moveAmount;
            await ctx.db.patch(sourceBudget._id, { amount: newSourceAmount.toString() });
        }
    } else {
        // Move from Unassigned Cash
        // Re-calculate Unassigned Global
        // (Expensive but safe). Or trust frontend? Better re-calculate.
        
        // Fetch ALL time data for accurate Unassigned Calc
        let allTx, allAcc, allBudgetsGlobal;
        
        if (householdId) {
            allTx = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
            allBudgetsGlobal = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
            allAcc = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        } else {
            allTx = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", userId)).collect();
            allBudgetsGlobal = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", userId)).collect();
            allAcc = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", userId)).collect();
        }
        
        const accMap = new Map(allAcc.map(a => [a._id, a]));
        const unassigned = calculateUnassignedCash(allTx, allBudgetsGlobal, accMap);

        if (moveAmount > unassigned) {
             throw new Error(`Insufficient Unassigned Cash. Available: ${unassigned.toLocaleString()}`);
        }
        // Unassigned reduces automatically when we increase a budget limit. No manual patch needed for "Unassigned" entity.
    }

    // 3. Increase Destination Budget
    const destBudget = allBudgets.find(b => b.categoryId === toCategoryId);
    if (destBudget) {
        const currentDest = parseFloat(destBudget.amount.replace(/,/g, '') || '0');
        await ctx.db.patch(destBudget._id, { amount: (currentDest + moveAmount).toString() });
    } else {
        await ctx.db.insert("budgets", {
            userId,
            householdId,
            categoryId: toCategoryId,
            amount: moveAmount.toString(),
            year,
            month
        });
    }
  }
});

export const sweepBudgets = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    month: v.number(),
    year: v.number(),
  },
  handler: async (ctx, { householdId, month, year }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (householdId) {
       if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    // 1. Get Budgets for the target month
    let budgets;
    if (householdId) {
        budgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", year).eq("month", month)).collect();
    } else {
        budgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", identity.subject).eq("year", year).eq("month", month)).collect();
    }

    // 2. Calculate Spending using Helper
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }

    const monthTransactions = allTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= startOfMonth && tDate <= endOfMonth;
    });

    // Accounts for helper
    let allAccounts;
    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", identity.subject)).collect();
    }
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [a._id, a]));

    const spendingByCategory = calculateSpendingByCategory(monthTransactions, accountsMap);

    // 3. Update budgets where Allocated > Spent
    let sweptCount = 0;
    for (const budget of budgets) {
        const spent = spendingByCategory[budget.categoryId] || 0;
        const allocated = parseFloat(budget.amount.replace(/,/g, '') || '0');
        
        if (allocated > spent) {
            await ctx.db.patch(budget._id, { amount: spent.toString() });
            sweptCount++;
        }
    }

    return sweptCount;
  }
});