import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { 
  calculateSpendingByCategory, 
  calculateUnassignedCash, 
  calculateMonthlyBudgetLeft,
  analyzeTransactionFlow,
  parseAmount,
  AccountMap,
  getFiscalMonthRange,
  getFiscalDateDetails 
} from "./lib/finance";
import { recomputeUserCache } from "./lib/recomputeCache";

async function getHousehold(ctx: QueryCtx, householdId?: Id<"households">, userId?: string) {
    if (householdId) {
        return await ctx.db.get(householdId);
    }
    if (userId) {
        const member = await ctx.db
            .query("householdMembers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        if (member) return await ctx.db.get(member.householdId);
    }
    return null;
}

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

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

    const now = new Date();
    const fiscalDetails = getFiscalDateDetails(now.toISOString(), startDay);
    const currentYear = year ?? fiscalDetails.year;
    const currentMonth = month ?? fiscalDetails.month;
    
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

    // 3. Calculate date range for the month (Using Fiscal Helper)
    const { start: startOfFiscal, end: endOfFiscal } = getFiscalMonthRange(currentYear, currentMonth, startDay);
    const startObj = new Date(startOfFiscal);
    const endObj = new Date(endOfFiscal);

    // 4. Get all transactions (needed for Spending and Unassigned Cash)
    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    const transactionsInMonth = allTransactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= startObj && tDate <= endObj;
    });

    // 5. Get Accounts for Helper Map
    let allAccounts;
    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));
    const categoriesMap = new Map(categories.map(c => [c._id, c]));

    // 6. Calculate Spending using Helper
    const spendingByCategory = calculateSpendingByCategory(transactionsInMonth, accountsMap, categoriesMap);

    // 6.1 Calculate Pending Receivables Per Category (For Visual Arsir)
    const pendingReceivablesByCategory: Record<string, number> = {};
    transactionsInMonth.forEach(t => {
        if (t.isReimbursable && (t.settlementStatus === 'unpaid' || t.settlementStatus === 'partial')) {
            const amountValue = parseAmount(t.amount);
            const paidValue = parseAmount(t.amountPaid);
            const remaining = Math.max(0, amountValue - paidValue);

            const flows = analyzeTransactionFlow(t, accountsMap, categoriesMap);
            flows.forEach(flow => {
                if (flow.type === 'SPENDING') {
                    // Calculate proportional remaining for this flow (important for future split support)
                    const flowRatio = flow.amount / amountValue;
                    const flowRemaining = remaining * flowRatio;
                    pendingReceivablesByCategory[flow.categoryId] = (pendingReceivablesByCategory[flow.categoryId] || 0) + flowRemaining;
                }
            });
        }
    });

    // 7. Calculate Accumulated (All Time) for Savings
    const accumulatedMap = calculateSpendingByCategory(allTransactions, accountsMap, categoriesMap);

    // 8. Calculate Unassigned Cash using Helper
    // Need ALL budgets for this
    let allBudgets;
    if (householdId) {
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", userId)).collect();
    }
    
    const unassignedCash = calculateUnassignedCash(allTransactions, allBudgets, accountsMap, startDay, categoriesMap, currentMonth, currentYear);

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
                
                const cycleMap = calculateSpendingByCategory(relevantTx, accountsMap, categoriesMap);
                accumulated = cycleMap[category._id] || 0;
            }
            
            return {
                category,
                budget,
                spent,
                accumulated,
                pendingReceivables: pendingReceivablesByCategory[category._id] || 0,
            };
    });

    const budgetSummary = calculateMonthlyBudgetLeft(budgets, categories, spendingByCategory);

    // Breakdown for UI
    const thisMonthIncome = allTransactions
        .filter(t => {
            const isDateMatch = t.date >= startOfFiscal && t.date <= endOfFiscal;
            if (!isDateMatch || t.type !== 'income') return false;
            
            // Only count as income if category is of type income (not settlement)
            const category = t.categoryId ? categoriesMap.get(t.categoryId) : null;
            return category?.type === 'income';
        })
        .reduce((acc, t) => acc + parseFloat(t.amount.replace(/,/g, '') || '0'), 0);

    const thisMonthBudgeted = budgets.reduce((acc, b) => {
        const allocated = parseFloat(b.amount.replace(/,/g, '') || '0');
        const swept = parseFloat(b.sweptAmount?.replace(/,/g, '') || '0');
        const carryover = parseFloat(b.carryoverAmount?.replace(/,/g, '') || '0');
        return acc + (allocated + carryover - swept);
    }, 0);
    
    const pastSurplus = unassignedCash - (thisMonthIncome - thisMonthBudgeted);

    const breakdown = {
        thisMonthIncome,
        thisMonthBudgeted,
        pastSurplus,
        totalIncome: 0,
        totalBudgeted: 0 
    };

    // 10. Check for Month-End Processing (Sweep & Rollover)
    const monthEndProposals: { 
        type: 'sweep' | 'rollover', 
        categoryId: Id<"categories">, 
        categoryName: string, 
        amount: number 
    }[] = [];

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
         const { start: startOfPrev, end: endOfPrev } = getFiscalMonthRange(prevYear, prevMonth, startDay);
         const startOfPrevObj = new Date(startOfPrev);
         const endOfPrevObj = new Date(endOfPrev);
         
         const prevTransactions = allTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startOfPrevObj && tDate <= endOfPrevObj;
         });
         
         const prevSpending = calculateSpendingByCategory(prevTransactions, accountsMap, categoriesMap);

         for (const b of prevBudgets) {
             const category = categories.find(c => c._id === b.categoryId);
             const spent = prevSpending[b.categoryId] || 0;
             const allocated = parseFloat(b.amount.replace(/,/g, '') || '0');
             const swept = parseFloat(b.sweptAmount?.replace(/,/g, '') || '0');
             const carryover = parseFloat(b.carryoverAmount?.replace(/,/g, '') || '0');
             
             // The effective remaining amount from the previous month
             const sisa = (allocated + carryover - swept) - spent;

             // Case 1: Standard Sweepable Leftover (Positive balance, no pacing)
             if (!category?.enablePacing && sisa > 0) {
                 monthEndProposals.push({
                     type: 'sweep',
                     categoryId: b.categoryId,
                     categoryName: category?.name || 'Unknown',
                     amount: sisa
                 });
             }

             // Case 2: Smart Rollover (Positive or Negative balance, with pacing)
             if (category?.enablePacing && sisa !== 0) {
                 // Check if it's already rolled over accurately to the current month
                 let targetBudget;
                 if (householdId) {
                     targetBudget = await ctx.db.query("budgets")
                         .withIndex("by_householdId_category_year_month", q => 
                             q.eq("householdId", householdId)
                              .eq("categoryId", b.categoryId)
                              .eq("year", currentYear)
                              .eq("month", currentMonth)
                         ).first();
                 } else {
                     targetBudget = await ctx.db.query("budgets")
                         .withIndex("by_user_category_year_month", q => 
                             q.eq("userId", userId)
                              .eq("categoryId", b.categoryId)
                              .eq("year", currentYear)
                              .eq("month", currentMonth)
                         ).first();
                 }

                 // If not yet rolled over, OR if the carryover amount in target doesn't match the actual 'sisa'
                 const targetCarryoverValue = targetBudget ? parseFloat(targetBudget.carryoverAmount?.replace(/,/g, '') || '0') : 0;
                 
                 if (!targetBudget || Math.abs(targetCarryoverValue - sisa) > 0.01) {
                     monthEndProposals.push({
                         type: 'rollover',
                         categoryId: b.categoryId,
                         categoryName: category?.name || 'Unknown',
                         amount: sisa
                     });
                 }
             }
         }
    }

    return { data, unassignedCash, monthEndProposals, breakdown, budgetSummary };
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

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

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
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));

    // Fetch categories for accurate flow analysis
    let allCategories;
    if (householdId) {
        allCategories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allCategories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", userId)).collect();
    }
    const categoriesMap = new Map(allCategories.map(c => [c._id, c]));

    // 2. Calculate Unassigned Cash (Helper)
    const unassignedCash = calculateUnassignedCash(allTransactions, allBudgets, accountsMap, startDay, categoriesMap, targetMonth, targetYear);

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
    const { start: startOfPrevMonth, end: endOfPrevMonth } = getFiscalMonthRange(prevYear, prevMonth, startDay);
    const startOfPrevObj = new Date(startOfPrevMonth);
    const endOfPrevObj = new Date(endOfPrevMonth);

    const prevMonthTransactions = allTransactions.filter(t => {
       const tDate = new Date(t.date);
       return tDate >= startOfPrevObj && tDate <= endOfPrevObj;
    });

    const prevMonthSpendingMap = calculateSpendingByCategory(prevMonthTransactions, accountsMap, categoriesMap);
    const prevMonthSpent = prevMonthSpendingMap[categoryId] || 0;

    // 5. Average Spending (Last 3 months)
    let totalSpent3Months = 0;
    let monthsWithData = 0;

    for (let i = 1; i <= 3; i++) {
        let m = targetMonth - i;
        let y = targetYear;
        while (m < 0) { m += 12; y--; }
        
        const { start, end } = getFiscalMonthRange(y, m, startDay);
        const startObj = new Date(start);
        const endObj = new Date(end);
        
        const monthTx = allTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startObj && tDate <= endObj;
        });
        
        const monthSpendingMap = calculateSpendingByCategory(monthTx, accountsMap, categoriesMap);
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

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

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
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));

    let allCategories;
    if (householdId) {
        allCategories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allCategories = await ctx.db.query("categories").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const categoriesMap = new Map(allCategories.map(c => [c._id, c]));

    const unassignedCash = calculateUnassignedCash(allTransactions, allBudgets, accountsMap, startDay, categoriesMap, args.month, args.year);

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
      // Always update both amount and initialAmount when editing existing budget via "Set Limit"
      await ctx.db.patch(currentBudget._id, { 
        amount: args.amount,
        initialAmount: args.amount 
      });
    } else {
      await ctx.db.insert("budgets", {
        userId: identity.subject,
        householdId,
        categoryId: args.categoryId,
        amount: args.amount,
        year: args.year,
        month: args.month,
        initialAmount: args.amount,
        totalAdjustments: "0",
      });
    }

    await recomputeUserCache(ctx, userId, householdId);
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
    await recomputeUserCache(ctx, identity.subject, budget.householdId);
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

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

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
        
        // Debug: Log if budget not found
        if (!sourceBudget) {
            throw new Error(`Budget not found for category ${fromCategoryId} in period ${year}-${month}. Please ensure the category has a budget set first.`);
        }
        
        const sourceLimit = parseFloat(sourceBudget.amount.replace(/,/g, '') || '0');
        
        // We must check if source has enough *Remaining* (Limit - Spent)
        // Fetch spending for validation
        const { start: startOfMonth, end: endOfMonth } = getFiscalMonthRange(year, month, startDay);
        
        // Fetch all transactions for this household first
        let allTransactions;
        if (householdId) {
            allTransactions = await ctx.db.query("transactions")
                .withIndex("by_householdId_date", q => q.eq("householdId", householdId))
                .collect();
        } else {
            allTransactions = await ctx.db.query("transactions")
                .withIndex("by_userId_date", q => q.eq("userId", userId))
                .collect();
        }
        
        // Filter transactions within the fiscal month using Date objects
        const startDateObj = new Date(startOfMonth);
        const endDateObj = new Date(endOfMonth);
        const transactions = allTransactions.filter(t => {
            const txDate = new Date(t.date);
            return txDate >= startDateObj && txDate <= endDateObj;
        });

        // Get Account Map for accurate spending calculation
        let allAccounts;
        if (householdId) {
            allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        } else {
            allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
        }
        const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));

        let allCategories;
        if (householdId) {
            allCategories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        } else {
            allCategories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", userId)).collect();
        }
        const categoriesMap = new Map(allCategories.map(c => [c._id, c]));

        const spendingMap = calculateSpendingByCategory(transactions, accountsMap, categoriesMap);
        const sourceSpent = spendingMap[fromCategoryId] || 0;
        // Allow negative adjustments - user can move funds even if overspent
        // This will result in negative totalAdjustments
        const sourceAvailable = sourceLimit - sourceSpent;

        // No validation needed - adjustments can go negative
        // User responsibility to manage their budget

        // Reduce Source Budget and track adjustment
        if (sourceBudget) {
            const newSourceAmount = sourceLimit - moveAmount;
            const currentSourceAdjustments = parseFloat(sourceBudget.totalAdjustments?.replace(/,/g, '') || '0');
            await ctx.db.patch(sourceBudget._id, { 
                amount: newSourceAmount.toString(),
                totalAdjustments: (currentSourceAdjustments - moveAmount).toString()
            });
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
        
        let allCategories;
        if (householdId) {
            allCategories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        } else {
            allCategories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", userId)).collect();
        }
        const categoriesMap = new Map(allCategories.map(c => [c._id, c]));

        const unassigned = calculateUnassignedCash(allTx, allBudgetsGlobal, accMap, startDay, categoriesMap, month, year);

        if (moveAmount > unassigned) {
             throw new Error(`Insufficient Unassigned Cash. Available: ${unassigned.toLocaleString()}`);
        }
        // Unassigned reduces automatically when we increase a budget limit. No manual patch needed for "Unassigned" entity.
    }

    // 3. Increase Destination Budget and track adjustment
    const destBudget = allBudgets.find(b => b.categoryId === toCategoryId);
    if (destBudget) {
        const currentDest = parseFloat(destBudget.amount.replace(/,/g, '') || '0');
        const currentDestAdjustments = parseFloat(destBudget.totalAdjustments?.replace(/,/g, '') || '0');
        await ctx.db.patch(destBudget._id, { 
            amount: (currentDest + moveAmount).toString(),
            totalAdjustments: (currentDestAdjustments + moveAmount).toString()
        });
    } else {
        // New budget created via move funds - set as initial with adjustments
        await ctx.db.insert("budgets", {
            userId,
            householdId,
            categoryId: toCategoryId,
            amount: moveAmount.toString(),
            year,
            month,
            initialAmount: "0",
            totalAdjustments: moveAmount.toString(),
        });
    }

    await recomputeUserCache(ctx, userId, householdId);
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
    const userId = identity.subject;
    
    if (householdId) {
       if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

    // 1. Get Budgets for the target month
    let budgets;
    if (householdId) {
        budgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", year).eq("month", month)).collect();
    } else {
        budgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", identity.subject).eq("year", year).eq("month", month)).collect();
    }

    // 2. Calculate Spending using Helper
    const { start: startOfFiscal, end: endOfFiscal } = getFiscalMonthRange(year, month, startDay);
    const startObj = new Date(startOfFiscal);
    const endObj = new Date(endOfFiscal);

    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }

    const monthTransactions = allTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= startObj && tDate <= endObj;
    });

    // Accounts for helper
    let allAccounts;
    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", identity.subject)).collect();
    }
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));

    let allCategories;
    if (householdId) {
        allCategories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allCategories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }
    const categoriesMap = new Map(allCategories.map(c => [c._id, c]));

    const spendingByCategory = calculateSpendingByCategory(monthTransactions, accountsMap, categoriesMap);

    // 3. Update budgets where Remaining Balance > 0
    let sweptCount = 0;
    for (const budget of budgets) {
        const category = categoriesMap.get(budget.categoryId);
        // Only sweep if it's NOT a rollover category (Standard categories only)
        if (!category?.enablePacing) {
            const spent = spendingByCategory[budget.categoryId] || 0;
            const allocated = parseFloat(budget.amount.replace(/,/g, '') || '0');
            const carryover = parseFloat(budget.carryoverAmount?.replace(/,/g, '') || '0');
            const currentSwept = parseFloat(budget.sweptAmount?.replace(/,/g, '') || '0');
            
            // Total effective funds available this month
            const totalAvailable = allocated + carryover;
            const remaining = totalAvailable - spent;

            // Only update if there is something to sweep and it's different from the current sweep
            if (remaining > 0 && Math.abs(remaining - currentSwept) > 0.01) {
                await ctx.db.patch(budget._id, { sweptAmount: remaining.toString() });
                sweptCount++;
            }
        }
    }

    await recomputeUserCache(ctx, userId, householdId);
    return sweptCount;
  }
});

async function performRollover(
  ctx: MutationCtx,
  userId: string,
  householdId: Id<"households"> | undefined,
  year: number,
  month: number,
  startDay: number
): Promise<number> {
  let sourceBudgets;
  if (householdId) {
    sourceBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", year).eq("month", month)).collect();
  } else {
    sourceBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", userId).eq("year", year).eq("month", month)).collect();
  }

  let targetMonth = month + 1;
  let targetYear = year;
  if (targetMonth > 11) {
    targetMonth = 0;
    targetYear++;
  }

  const { start: startOfFiscal, end: endOfFiscal } = getFiscalMonthRange(year, month, startDay);
  const startObj = new Date(startOfFiscal);
  const endObj = new Date(endOfFiscal);

  let allTransactions;
  if (householdId) {
    allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
  } else {
    allTransactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", userId)).collect();
  }

  const sourceTransactions = allTransactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate >= startObj && tDate <= endObj;
  });

  let allAccounts;
  if (householdId) {
    allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
  } else {
    allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
  }
  const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));

  let allCategories;
  if (householdId) {
    allCategories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
  } else {
    allCategories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", userId)).collect();
  }
  const categoriesMap = new Map(allCategories.map(c => [c._id, c]));

  const spendingMap = calculateSpendingByCategory(sourceTransactions, accountsMap, categoriesMap);

  let rolloverCount = 0;
  for (const b of sourceBudgets) {
    const category = categoriesMap.get(b.categoryId);
    if (category?.enablePacing) {
      const allocated = parseFloat(b.amount.replace(/,/g, '') || '0');
      const swept = parseFloat(b.sweptAmount?.replace(/,/g, '') || '0');
      const carryover = parseFloat(b.carryoverAmount?.replace(/,/g, '') || '0');
      const spent = spendingMap[b.categoryId] || 0;
      const sisa = (allocated + carryover - swept) - spent;

      if (sisa !== 0) {
        let targetBudget;
        if (householdId) {
          targetBudget = await ctx.db.query("budgets")
            .withIndex("by_householdId_category_year_month", q => 
              q.eq("householdId", householdId)
               .eq("categoryId", b.categoryId)
               .eq("year", targetYear)
               .eq("month", targetMonth)
            ).first();
        } else {
          targetBudget = await ctx.db.query("budgets")
            .withIndex("by_user_category_year_month", q => 
              q.eq("userId", userId)
               .eq("categoryId", b.categoryId)
               .eq("year", targetYear)
               .eq("month", targetMonth)
            ).first();
        }

        if (targetBudget) {
          const targetCarryover = parseFloat(targetBudget.carryoverAmount?.replace(/,/g, '') || '0');
          if (Math.abs(targetCarryover - sisa) > 0.01) {
            await ctx.db.patch(targetBudget._id, { carryoverAmount: sisa.toString() });
            rolloverCount++;
          }
        } else {
          await ctx.db.insert("budgets", {
            userId,
            householdId,
            categoryId: b.categoryId,
            amount: "0",
            year: targetYear,
            month: targetMonth,
            carryoverAmount: sisa.toString()
          });
          rolloverCount++;
        }
      }
    }
  }

  return rolloverCount;
}

export const rolloverBudgets = mutation({
    args: {
        householdId: v.optional(v.id("households")),
        month: v.number(), // The month to rollover FROM (e.g. Last Month)
        year: v.number(),
    },
    handler: async (ctx, { householdId, month, year }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");
        const userId = identity.subject;

        if (householdId) {
            if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
        }

        const household = await getHousehold(ctx, householdId, userId);
        const startDay = household?.budgetStartDay || 1;

        const rolloverCount = await performRollover(ctx, userId, householdId, year, month, startDay);
        await recomputeUserCache(ctx, userId, householdId);
        return rolloverCount;
    }
});

export const fixAllCarryovers = mutation({
  args: {
    householdId: v.optional(v.id("households")),
  },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    if (householdId) {
      if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

    const now = new Date();
    const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);

    let allTransactions;
    let allAccounts;
    let allCategories;
    if (householdId) {
      allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
      allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
      allCategories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
      allTransactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", userId)).collect();
      allAccounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", userId)).collect();
      allCategories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", userId)).collect();
    }
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));
    const categoriesMap = new Map(allCategories.map(c => [c._id, c]));

    const correctedCarryover = new Map<string, number>();
    let totalRollovers = 0;

    for (let m = 0; m <= currentMonth; m++) {
      let sourceBudgets;
      if (householdId) {
        sourceBudgets = await ctx.db.query("budgets")
          .withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", currentYear).eq("month", m))
          .collect();
      } else {
        sourceBudgets = await ctx.db.query("budgets")
          .withIndex("by_userId_year_month", q => q.eq("userId", userId).eq("year", currentYear).eq("month", m))
          .collect();
      }

      if (sourceBudgets.length === 0) continue;

      let targetMonth = m + 1;
      let targetYear = currentYear;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear++;
      }

      const { start: startOfFiscal, end: endOfFiscal } = getFiscalMonthRange(currentYear, m, startDay);
      const sourceTransactions = allTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= new Date(startOfFiscal) && tDate <= new Date(endOfFiscal);
      });

      const spendingMap = calculateSpendingByCategory(sourceTransactions, accountsMap, categoriesMap);

      for (const b of sourceBudgets) {
        const category = categoriesMap.get(b.categoryId);
        if (!category?.enablePacing) continue;

        const allocated = parseFloat(b.amount.replace(/,/g, '') || '0');
        const swept = parseFloat(b.sweptAmount?.replace(/,/g, '') || '0');
        const storedCarryover = parseFloat(b.carryoverAmount?.replace(/,/g, '') || '0');
        const effectiveCarryover = correctedCarryover.get(b.categoryId) ?? storedCarryover;
        const spent = spendingMap[b.categoryId] || 0;
        const sisa = (allocated + effectiveCarryover - swept) - spent;

        correctedCarryover.set(b.categoryId, sisa);

        if (sisa !== 0) {
          let targetBudget;
          if (householdId) {
            targetBudget = await ctx.db.query("budgets")
              .withIndex("by_householdId_category_year_month", q =>
                q.eq("householdId", householdId)
                 .eq("categoryId", b.categoryId)
                 .eq("year", targetYear)
                 .eq("month", targetMonth)
              ).first();
          } else {
            targetBudget = await ctx.db.query("budgets")
              .withIndex("by_user_category_year_month", q =>
                q.eq("userId", userId)
                 .eq("categoryId", b.categoryId)
                 .eq("year", targetYear)
                 .eq("month", targetMonth)
              ).first();
          }

          if (targetBudget) {
            const targetCarryover = parseFloat(targetBudget.carryoverAmount?.replace(/,/g, '') || '0');
            if (Math.abs(targetCarryover - sisa) > 0.01) {
              await ctx.db.patch(targetBudget._id, { carryoverAmount: sisa.toString() });
              totalRollovers++;
            }
          } else {
            await ctx.db.insert("budgets", {
              userId,
              householdId,
              categoryId: b.categoryId,
              amount: "0",
              year: targetYear,
              month: targetMonth,
              carryoverAmount: sisa.toString()
            });
            totalRollovers++;
          }
        }
      }
    }

    await recomputeUserCache(ctx, userId, householdId);
    return { processedMonths: currentMonth + 1, totalRollovers };
  }
});

export const ensureCurrentRollover = mutation({
  args: {
    householdId: v.optional(v.id("households")),
  },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    if (householdId) {
      if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

    const now = new Date();
    const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);

    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }

    const rolloverCount = await performRollover(ctx, userId, householdId, prevYear, prevMonth, startDay);
    await recomputeUserCache(ctx, userId, householdId);
    return { month: prevMonth, year: prevYear, rolloverCount };
  }
});

export const getBudgetReport = query({
  args: {
    householdId: v.optional(v.id("households")),
    months: v.number(),
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, { householdId, months, categoryId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) {
            return { periods: [], totals: null };
        }
    }

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

    const now = new Date();
    const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);

    // 1. Get all categories (filter by type)
    let categories;
    if (householdId) {
        categories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        categories = await ctx.db.query("categories").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    
    // Filter expense and saving categories
    categories = categories.filter(c => (c.type === 'expense' || c.type === 'saving') && c.status !== 'achieved' && c.status !== 'archived' && !c.isArchived);
    
    // Filter by categoryId if provided
    if (categoryId) {
        categories = categories.filter(c => c._id === categoryId);
    }

    // 2. Get all transactions
    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    // 3. Get all accounts
    let allAccounts;
    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));

    // 4. Get all budgets
    let allBudgets;
    if (householdId) {
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", userId)).collect();
    }

    const categoriesMap = new Map(categories.map(c => [c._id, c]));

    // 5. Calculate periods to fetch (from current - months + 1 to current)
    const periods: { year: number; month: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
        let m = currentMonth - i;
        let y = currentYear;
        while (m < 0) { m += 12; y--; }
        while (m > 11) { m -= 12; y++; }
        periods.push({ year: y, month: m });
    }

    // 6. Build periods data
    const periodsData = periods.map(period => {
        const { start: startOfFiscal, end: endOfFiscal } = getFiscalMonthRange(period.year, period.month, startDay);
        const startObj = new Date(startOfFiscal);
        const endObj = new Date(endOfFiscal);

        // Get budgets for this period
        const periodBudgets = allBudgets.filter(b => b.year === period.year && b.month === period.month);
        const budgetMap = new Map(periodBudgets.map(b => [String(b.categoryId), b]));

        // Get transactions for this period
        const periodTransactions = allTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startObj && tDate <= endObj;
        });

        // Calculate spending
        const spendingByCategory = calculateSpendingByCategory(periodTransactions, accountsMap, categoriesMap);

        // Build category breakdown
        const categoryBreakdown = categories.map(cat => {
            const budget = budgetMap.get(String(cat._id));
            const initial = budget ? parseFloat(budget.initialAmount?.replace(/,/g, '') || '0') : 0;
            const adjustment = budget ? parseFloat(budget.totalAdjustments?.replace(/,/g, '') || '0') : 0;
            const carryover = budget ? parseFloat(budget.carryoverAmount?.replace(/,/g, '') || '0') : 0;
            const total = initial + adjustment + carryover;
            const spent = spendingByCategory[cat._id] || 0;
            const remaining = total - spent;

            return {
                categoryId: cat._id,
                categoryName: cat.name,
                categoryType: cat.type,
                initial,
                adjustment,
                carryover,
                total,
                spent,
                remaining,
                isOverBudget: remaining < 0,
            };
        });

        // Calculate period totals
        const periodTotals = categoryBreakdown.reduce((acc, cat) => ({
            initial: acc.initial + cat.initial,
            adjustment: acc.adjustment + cat.adjustment,
            carryover: acc.carryover + cat.carryover,
            total: acc.total + cat.total,
            spent: acc.spent + cat.spent,
            remaining: acc.remaining + cat.remaining,
        }), { initial: 0, adjustment: 0, carryover: 0, total: 0, spent: 0, remaining: 0 });

        // Format period label
        const periodDate = new Date(period.year, period.month, startDay);
        const periodLabel = periodDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

        return {
            year: period.year,
            month: period.month,
            periodLabel,
            ...periodTotals,
            isOverBudget: periodTotals.remaining < 0,
            byCategory: categoryBreakdown,
        };
    });

    // 7. Calculate grand totals
    const totals = periodsData.reduce((acc, period) => ({
        initial: acc.initial + period.initial,
        adjustment: acc.adjustment + period.adjustment,
        carryover: acc.carryover + period.carryover,
        total: acc.total + period.total,
        spent: acc.spent + period.spent,
        remaining: acc.remaining + period.remaining,
    }), { initial: 0, adjustment: 0, carryover: 0, total: 0, spent: 0, remaining: 0 });

    return {
        periods: periodsData,
        totals,
        meta: {
            months,
            budgetStartDay: startDay,
            currentYear,
            currentMonth,
        },
    };
  }
});