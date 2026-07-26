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
  getFiscalDateDetails,
  getServerNow,
  getFiscalConfig
} from "./lib/finance";
import { recomputeUserCache, getCache } from "./lib/recomputeCache";
import { saveSnapshotInternal } from "./monthEndSnapshots";

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

function getCurrentFiscalMonth(household?: { budgetStartDay?: number; timezone?: string } | null): { year: number; month: number } {
    const startDay = household?.budgetStartDay || 1;
    const now = getServerNow(household?.timezone);
    return getFiscalDateDetails(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
        startDay
    );
}

async function getUnassignedCash(
    ctx: MutationCtx | QueryCtx,
    userId: string,
    householdId: Id<"households"> | undefined,
    targetMonth: number,
    targetYear: number,
    household?: { budgetStartDay?: number; timezone?: string } | null
): Promise<number> {
    const { year: currentYear, month: currentMonth } = getCurrentFiscalMonth(household);

    if (targetMonth === currentMonth && targetYear === currentYear) {
        const cache = await getCache(ctx, userId, householdId ?? undefined);
        if (cache) return cache.unassignedCash;
    }

    // Non-current month: calculate directly with spending data
    let allBudgets, allAcc;
    if (householdId) {
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
        allAcc = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", userId)).collect();
        allAcc = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", userId)).collect();
    }
    const accMap = new Map(allAcc.map(a => [a._id, a]));

    const startDay = household?.budgetStartDay || 1;
    const { start: startOfMonth, end: endOfMonth } = getFiscalMonthRange(targetYear, targetMonth, startDay);
    let transactions;
    if (householdId) {
        transactions = await ctx.db.query("transactions")
            .withIndex("by_householdId_date", q => q.eq("householdId", householdId).gte("date", startOfMonth).lte("date", endOfMonth))
            .collect();
    } else {
        transactions = await ctx.db.query("transactions")
            .withIndex("by_userId_date", q => q.eq("userId", userId).gte("date", startOfMonth).lte("date", endOfMonth))
            .collect();
    }

    let allCategories;
    if (householdId) {
        allCategories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allCategories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", userId)).collect();
    }
    const categoriesMap = new Map(allCategories.map(c => [c._id, c]));
    const spendingMap = calculateSpendingByCategory(transactions, accMap, categoriesMap);

    return calculateUnassignedCash(allBudgets, accMap, targetMonth, targetYear, spendingMap);
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
    const { startDay, timezone } = getFiscalConfig(household);

    const now = getServerNow(timezone);
    const fiscalDetails = getFiscalDateDetails(now.toISOString(), startDay);
    const currentYear = year ?? fiscalDetails.year;
    const currentMonth = month ?? fiscalDetails.month;
    
    // 1. Fetch cache
    const cache = await getCache(ctx, userId, householdId ?? undefined);

    // 2. Get all categories
    let categories;
    if (householdId) {
        categories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        categories = await ctx.db.query("categories").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    // 3. Get budgets for THIS SPECIFIC PERIOD
    let budgets;
    if (householdId) {
        budgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", currentYear).eq("month", currentMonth)).collect();
    } else {
        budgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => 
            q.eq("userId", userId).eq("year", currentYear).eq("month", currentMonth)
        ).collect();
    }

    // 4. Calculate date range for the month (Using Fiscal Helper)
    const { start: startOfFiscal, end: endOfFiscal } = getFiscalMonthRange(currentYear, currentMonth, startDay);

    // 5. Get current month transactions ONLY (date-range filter on index, MUCH cheaper)
    let currentMonthTransactions;
    if (householdId) {
        currentMonthTransactions = await ctx.db.query("transactions")
            .withIndex("by_householdId_date", (q) =>
                q.eq("householdId", householdId).gte("date", startOfFiscal).lte("date", endOfFiscal)
            )
            .collect();
    } else {
        currentMonthTransactions = await ctx.db.query("transactions")
            .withIndex("by_userId_date", (q) =>
                q.eq("userId", userId).gte("date", startOfFiscal).lte("date", endOfFiscal)
            )
            .collect();
    }

    // 6. Get Accounts for Helper Map
    let allAccounts;
    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));
    const categoriesMap = new Map(categories.map(c => [c._id, c]));

    // 7. Calculate Spending using Helper
    const spendingByCategory = calculateSpendingByCategory(currentMonthTransactions, accountsMap, categoriesMap);

    // 7.1 Calculate Pending Receivables Per Category (For Visual Arsir)
    const pendingReceivablesByCategory: Record<string, number> = {};
    currentMonthTransactions.forEach(t => {
        if (t.isReimbursable && (t.settlementStatus === 'unpaid' || t.settlementStatus === 'partial')) {
            const amountValue = parseAmount(t.amount);
            const paidValue = parseAmount(t.amountPaid);
            const remaining = Math.max(0, amountValue - paidValue);

            const flows = analyzeTransactionFlow(t, accountsMap, categoriesMap);
            flows.forEach(flow => {
                if (flow.type === 'SPENDING') {
                    const flowRatio = flow.amount / amountValue;
                    const flowRemaining = remaining * flowRatio;
                    pendingReceivablesByCategory[flow.categoryId] = (pendingReceivablesByCategory[flow.categoryId] || 0) + flowRemaining;
                }
            });
        }
    });

    // 8. Accumulated from cache (all-time per category, no full scan)
    const accumulatedByCategoryMap = new Map(
        (cache?.accumulatedByCategory ?? []).map((item) => [item.categoryId, item.amount])
    );

    // 9. Unassigned cash — compute from current month data (cache stores all-time value)
    const unassignedCash = calculateUnassignedCash(
      budgets,
      accountsMap,
      currentMonth,
      currentYear,
      spendingByCategory
    );

    // 10. Combine data for Response
    const budgetMap = new Map(budgets.map(b => [b.categoryId, b]));

    // Batch-fetch saving category reset transactions (avoid N+1)
    const savingResetCategories = categories.filter(c => c.type === 'saving' && c.lastResetDate);
    let allResetTxns: any[] = [];
    let earliestResetDate: string | null = null;
    if (savingResetCategories.length > 0) {
        earliestResetDate = savingResetCategories.reduce((min, c) => !min || c.lastResetDate! < min ? c.lastResetDate! : min, null as string | null);
        if (householdId) {
            allResetTxns = await ctx.db.query("transactions")
                .withIndex("by_householdId_date", (q) => q.eq("householdId", householdId).gte("date", earliestResetDate!))
                .collect();
        } else {
            allResetTxns = await ctx.db.query("transactions")
                .withIndex("by_userId_date", (q) => q.eq("userId", userId).gte("date", earliestResetDate!))
                .collect();
        }
    }
    const savingResetDateMap = new Map(savingResetCategories.map(c => [c._id, c.lastResetDate!]));

    const data = await Promise.all(
        categories
            .filter(c => (c.type === 'expense' || c.type === 'saving') && c.status !== 'achieved' && c.status !== 'archived' && !c.isArchived)
            .map(async (category) => {
                const budget = budgetMap.get(category._id);
                const spent = spendingByCategory[category._id] || 0;
                
                let accumulated = accumulatedByCategoryMap.get(category._id) || 0;
                
                const lastResetDate = savingResetDateMap.get(category._id);
                if (lastResetDate && allResetTxns.length > 0) {
                    const categoryResetTxns = allResetTxns.filter(t => t.date >= lastResetDate);
                    const resetSpending = calculateSpendingByCategory(categoryResetTxns, accountsMap, categoriesMap);
                    accumulated = resetSpending[category._id] ?? 0;
                }
                
                return {
                    category,
                    budget,
                    spent,
                    accumulated,
                    pendingReceivables: pendingReceivablesByCategory[category._id] || 0,
                };
        })
    );

    const budgetSummary = calculateMonthlyBudgetLeft(budgets, categories, spendingByCategory);

    // Breakdown for UI — pastSurplus is a residual so the breakdown adds up to unassignedCash
    const thisMonthIncome = currentMonthTransactions
        .filter(t => {
            if (t.type !== 'income') return false;
            const category = t.categoryId ? categoriesMap.get(t.categoryId) : null;
            return category?.type === 'income';
        })
        .reduce((acc, t) => acc + parseFloat(t.amount.replace(/,/g, '') || '0'), 0);

    const thisMonthBudgeted = budgets.reduce((acc, b) => {
        return acc + parseFloat(b.amount.replace(/,/g, '') || '0');
    }, 0);

    const pastSurplus = unassignedCash - (thisMonthIncome - thisMonthBudgeted);

    const breakdown = {
        thisMonthIncome,
        thisMonthBudgeted,
        pastSurplus,
        totalIncome: 0,
        totalBudgeted: 0 
    };

    return { data, unassignedCash, breakdown, budgetSummary };
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

    // Fetch reference data (small tables)
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

    // 1. Previous Month's Budget — indexed query (1 doc)
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

    // 2. Previous Month's Spending — indexed date range query
    const { start: prevStart, end: prevEnd } = getFiscalMonthRange(prevYear, prevMonth, startDay);
    let prevTransactions;
    if (householdId) {
        prevTransactions = await ctx.db.query("transactions")
            .withIndex("by_householdId_date", (q) => q.eq("householdId", householdId).gte("date", prevStart).lte("date", prevEnd))
            .collect();
    } else {
        prevTransactions = await ctx.db.query("transactions")
            .withIndex("by_userId_date", (q) => q.eq("userId", userId).gte("date", prevStart).lte("date", prevEnd))
            .collect();
    }
    const prevSpending = calculateSpendingByCategory(prevTransactions, accountsMap, categoriesMap);
    const lastMonthSpent = prevSpending[categoryId] || 0;

    // 3. Average Spending (Last 3 months) — single range query + in-memory partition
    let totalSpent3Months = 0;
    let monthsWithData = 0;

    let firstM = targetMonth - 3, firstY = targetYear;
    while (firstM < 0) { firstM += 12; firstY--; }
    let lastM = targetMonth - 1, lastY = targetYear;
    while (lastM < 0) { lastM += 12; lastY--; }

    const { start: rangeStart } = getFiscalMonthRange(firstY, firstM, startDay);
    const { end: rangeEnd } = getFiscalMonthRange(lastY, lastM, startDay);

    let rangeTransactions;
    if (householdId) {
        rangeTransactions = await ctx.db.query("transactions")
            .withIndex("by_householdId_date", (q) => q.eq("householdId", householdId).gte("date", rangeStart).lte("date", rangeEnd))
            .collect();
    } else {
        rangeTransactions = await ctx.db.query("transactions")
            .withIndex("by_userId_date", (q) => q.eq("userId", userId).gte("date", rangeStart).lte("date", rangeEnd))
            .collect();
    }

    for (let i = 1; i <= 3; i++) {
        let m = targetMonth - i;
        let y = targetYear;
        while (m < 0) { m += 12; y--; }

        const { start, end } = getFiscalMonthRange(y, m, startDay);
        const monthTx = rangeTransactions.filter(t => t.date >= start && t.date <= end);
        const spending = calculateSpendingByCategory(monthTx, accountsMap, categoriesMap);
        const val = spending[categoryId] || 0;

        if (val > 0) {
            totalSpent3Months += val;
            monthsWithData++;
        }
    }
    const averageSpent = monthsWithData > 0 ? totalSpent3Months / monthsWithData : 0;

    // 4. Unassigned Cash (scoped to target month)
    const unassignedCash = await getUnassignedCash(ctx, userId, householdId, targetMonth, targetYear, household);

    return {
      lastMonthBudget: prevBudget?.amount,
      lastMonthSpent,
      averageSpent,
      unassignedCash,
    };
  }
});

export const getMonthEndProposals = query({
  args: {
    householdId: v.optional(v.id("households")),
  },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const household = await getHousehold(ctx, householdId, userId);
    const { startDay, timezone } = getFiscalConfig(household);

    const now = getServerNow(timezone);
    const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);

    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 0) { prevMonth = 11; prevYear--; }

    let prevBudgets;
    if (householdId) {
        prevBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", prevYear).eq("month", prevMonth)).collect();
    } else {
        prevBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", userId).eq("year", prevYear).eq("month", prevMonth)).collect();
    }

    if (prevBudgets.length === 0) return [];

    const { start: startOfPrev, end: endOfPrev } = getFiscalMonthRange(prevYear, prevMonth, startDay);

    let [prevTransactions, allAccounts, allCategories] = await Promise.all([
        householdId
            ? ctx.db.query("transactions").withIndex("by_householdId_date", q => q.eq("householdId", householdId).gte("date", startOfPrev).lte("date", endOfPrev)).collect()
            : ctx.db.query("transactions").withIndex("by_userId_date", q => q.eq("userId", userId).gte("date", startOfPrev).lte("date", endOfPrev)).collect(),
        householdId
            ? ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect()
            : ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", userId)).collect(),
        householdId
            ? ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect()
            : ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", userId)).collect(),
    ]);

    const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));
    const categoriesMap = new Map(allCategories.map(c => [c._id, c]));
    const prevSpending = calculateSpendingByCategory(prevTransactions, accountsMap, categoriesMap);

    // Pre-fetch current-month budgets once for O(1) lookup (avoid N+1)
    let currentBudgets;
    if (householdId) {
        currentBudgets = await ctx.db.query("budgets")
            .withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", currentYear).eq("month", currentMonth))
            .collect();
    } else {
        currentBudgets = await ctx.db.query("budgets")
            .withIndex("by_userId_year_month", q => q.eq("userId", userId).eq("year", currentYear).eq("month", currentMonth))
            .collect();
    }
    const currentBudgetMap = new Map(currentBudgets.map(b => [b.categoryId, b]));

    const proposals: { type: 'sweep' | 'rollover', categoryId: Id<"categories">, categoryName: string, amount: number }[] = [];

    for (const b of prevBudgets) {
        const category = allCategories.find(c => c._id === b.categoryId);
        const spent = prevSpending[b.categoryId] || 0;
        const allocated = parseFloat(b.amount.replace(/,/g, '') || '0');
        const swept = parseFloat(b.sweptAmount?.replace(/,/g, '') || '0');
        const carryover = parseFloat(b.carryoverAmount?.replace(/,/g, '') || '0');

        const sisa = (allocated + carryover - swept) - spent;

        if (!category?.enablePacing && sisa > 0) {
            proposals.push({
                type: 'sweep',
                categoryId: b.categoryId,
                categoryName: category?.name || 'Unknown',
                amount: sisa
            });
        }

        if (category?.enablePacing && sisa !== 0) {
            const targetBudget = currentBudgetMap.get(b.categoryId);
            const targetCarryoverValue = targetBudget ? parseFloat(targetBudget.carryoverAmount?.replace(/,/g, '') || '0') : 0;

            if (!targetBudget || Math.abs(targetCarryoverValue - sisa) > 0.01) {
                proposals.push({
                    type: 'rollover',
                    categoryId: b.categoryId,
                    categoryName: category?.name || 'Unknown',
                    amount: sisa
                });
            }
        }
    }

    return proposals;
  },
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

    // 1. Validate Funds (Unassigned Check)
    const allBudgets = await (householdId
        ? ctx.db.query("budgets").withIndex("by_householdId_year_month", (q) => q.eq("householdId", householdId).eq("year", args.year).eq("month", args.month)).collect()
        : ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", userId).eq("year", args.year).eq("month", args.month)).collect());

    const unassignedCash = await getUnassignedCash(ctx, userId, householdId, args.month, args.year, household);

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
    toCategoryId: v.optional(v.id("categories")), // null = Return to Unassigned
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
    if (!fromCategoryId && !toCategoryId) throw new Error("Specify source or destination");
    if (fromCategoryId && toCategoryId && fromCategoryId === toCategoryId) throw new Error("Source and destination cannot be the same");

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
        
        // Fetch transactions scoped to fiscal month via indexed date range
        let transactions;
        if (householdId) {
            transactions = await ctx.db.query("transactions")
                .withIndex("by_householdId_date", q => q.eq("householdId", householdId).gte("date", startOfMonth).lte("date", endOfMonth))
                .collect();
        } else {
            transactions = await ctx.db.query("transactions")
                .withIndex("by_userId_date", q => q.eq("userId", userId).gte("date", startOfMonth).lte("date", endOfMonth))
                .collect();
        }

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
        const unassigned = await getUnassignedCash(ctx, userId, householdId, month, year, household);

        if (moveAmount > unassigned) {
             throw new Error(`Insufficient Unassigned Cash. Available: ${unassigned.toLocaleString()}`);
        }
        // Unassigned reduces automatically when we increase a budget limit. No manual patch needed for "Unassigned" entity.
    }

    // 3. Increase Destination Budget and track adjustment (skip if returning to Unassigned)
    if (toCategoryId) {
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
        budgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", userId).eq("year", year).eq("month", month)).collect();
    }

    // 2. Calculate Spending using Helper
    const { start: startOfFiscal, end: endOfFiscal } = getFiscalMonthRange(year, month, startDay);

    let monthTransactions;
    if (householdId) {
        monthTransactions = await ctx.db.query("transactions")
            .withIndex("by_householdId_date", q => q.eq("householdId", householdId).gte("date", startOfFiscal).lte("date", endOfFiscal))
            .collect();
    } else {
        monthTransactions = await ctx.db.query("transactions")
            .withIndex("by_userId_date", q => q.eq("userId", userId).gte("date", startOfFiscal).lte("date", endOfFiscal))
            .collect();
    }

    // Accounts for helper
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

  // Batch collect next-month budgets for O(1) target lookups
  let allTargetBudgets;
  if (householdId) {
    allTargetBudgets = await ctx.db.query("budgets")
      .withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", targetYear).eq("month", targetMonth))
      .collect();
  } else {
    allTargetBudgets = await ctx.db.query("budgets")
      .withIndex("by_userId_year_month", q => q.eq("userId", userId).eq("year", targetYear).eq("month", targetMonth))
      .collect();
  }
  const targetBudgetByCategory = new Map(allTargetBudgets.map(b => [b.categoryId, b]));

  const { start: startOfFiscal, end: endOfFiscal } = getFiscalMonthRange(year, month, startDay);

  // Query transactions with date range instead of full scan
  let sourceTransactions;
  if (householdId) {
    sourceTransactions = await ctx.db.query("transactions")
      .withIndex("by_householdId_date", q => q.eq("householdId", householdId).gte("date", startOfFiscal))
      .filter(q => q.lte(q.field("date"), endOfFiscal))
      .collect();
  } else {
    sourceTransactions = await ctx.db.query("transactions")
      .withIndex("by_userId_date", q => q.eq("userId", userId).gte("date", startOfFiscal))
      .filter(q => q.lte(q.field("date"), endOfFiscal))
      .collect();
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
        const targetBudget = targetBudgetByCategory.get(b.categoryId);

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

export const processMonthEnd = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    month: v.number(),
    year: v.number(),
    actions: v.optional(v.array(v.object({
      categoryId: v.id("categories"),
      type: v.union(v.literal("sweep"), v.literal("rollover")),
    }))),
  },
  handler: async (ctx, { householdId, month, year, actions }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    if (householdId) {
      if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    }

    // If actions provided, build lookup maps; otherwise process all
    const actionMap = actions
      ? new Map(actions.map(a => [String(a.categoryId), a.type]))
      : null;

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

    // --- SWEEP LOGIC ---
    let budgets;
    if (householdId) {
      budgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", year).eq("month", month)).collect();
    } else {
      budgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", userId).eq("year", year).eq("month", month)).collect();
    }

    const { start: startOfFiscal, end: endOfFiscal } = getFiscalMonthRange(year, month, startDay);

    let monthTransactions;
    if (householdId) {
      monthTransactions = await ctx.db.query("transactions")
        .withIndex("by_householdId_date", q => q.eq("householdId", householdId).gte("date", startOfFiscal).lte("date", endOfFiscal))
        .collect();
    } else {
      monthTransactions = await ctx.db.query("transactions")
        .withIndex("by_userId_date", q => q.eq("userId", userId).gte("date", startOfFiscal).lte("date", endOfFiscal))
        .collect();
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
      allCategories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", userId)).collect();
    }
    const categoriesMap = new Map(allCategories.map(c => [c._id, c]));

    const spendingByCategory = calculateSpendingByCategory(monthTransactions, accountsMap, categoriesMap);

    // Snapshot arrays for rollback
    const sweptSnapshot: { budgetId: typeof budgets[number]["_id"]; previousSweptAmount: string }[] = [];
    const rolloverSnapshot: { budgetId: typeof budgets[number]["_id"]; previousCarryoverAmount: string }[] = [];
    const insertedBudgetIds: typeof budgets[number]["_id"][] = [];

    let sweptCount = 0;
    for (const budget of budgets) {
      const catId = String(budget.categoryId);

      // If actions provided, only sweep categories explicitly marked as 'sweep'
      if (actionMap) {
        if (actionMap.get(catId) !== "sweep") continue;
      } else {
        // Default behavior: skip pacing categories
        const category = categoriesMap.get(budget.categoryId);
        if (category?.enablePacing) continue;
      }

      const spent = spendingByCategory[budget.categoryId] || 0;
      const allocated = parseFloat(budget.amount.replace(/,/g, '') || '0');
      const carryover = parseFloat(budget.carryoverAmount?.replace(/,/g, '') || '0');
      const currentSwept = parseFloat(budget.sweptAmount?.replace(/,/g, '') || '0');
      const totalAvailable = allocated + carryover;
      const remaining = totalAvailable - spent;

      if (remaining > 0 && Math.abs(remaining - currentSwept) > 0.01) {
        sweptSnapshot.push({ budgetId: budget._id, previousSweptAmount: budget.sweptAmount ?? "0" });
        await ctx.db.patch(budget._id, { sweptAmount: remaining.toString() });
        sweptCount++;
      }
    }

    // --- ROLLOVER LOGIC ---
    let targetMonth = month + 1;
    let targetYear = year;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear++;
    }

    let allTargetBudgets;
    if (householdId) {
      allTargetBudgets = await ctx.db.query("budgets")
        .withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", targetYear).eq("month", targetMonth))
        .collect();
    } else {
      allTargetBudgets = await ctx.db.query("budgets")
        .withIndex("by_userId_year_month", q => q.eq("userId", userId).eq("year", targetYear).eq("month", targetMonth))
        .collect();
    }
    const targetBudgetByCategory = new Map(allTargetBudgets.map(b => [b.categoryId, b]));

    let rolloverCount = 0;
    for (const b of budgets) {
      const catId = String(b.categoryId);

      // If actions provided, only rollover categories explicitly marked as 'rollover'
      if (actionMap) {
        if (actionMap.get(catId) !== "rollover") continue;
      } else {
        // Default behavior: only pacing categories
        const category = categoriesMap.get(b.categoryId);
        if (!category?.enablePacing) continue;
      }

      const allocated = parseFloat(b.amount.replace(/,/g, '') || '0');
      const swept = parseFloat(b.sweptAmount?.replace(/,/g, '') || '0');
      const carryover = parseFloat(b.carryoverAmount?.replace(/,/g, '') || '0');
      const spent = spendingByCategory[b.categoryId] || 0;
      const sisa = (allocated + carryover - swept) - spent;

      if (sisa !== 0) {
        const targetBudget = targetBudgetByCategory.get(b.categoryId);

        if (targetBudget) {
          const targetCarryover = parseFloat(targetBudget.carryoverAmount?.replace(/,/g, '') || '0');
          if (Math.abs(targetCarryover - sisa) > 0.01) {
            rolloverSnapshot.push({ budgetId: targetBudget._id, previousCarryoverAmount: targetBudget.carryoverAmount ?? "0" });
            await ctx.db.patch(targetBudget._id, { carryoverAmount: sisa.toString() });
            rolloverCount++;
          }
        } else {
          const newBudget = await ctx.db.insert("budgets", {
            userId,
            householdId,
            categoryId: b.categoryId,
            amount: "0",
            year: targetYear,
            month: targetMonth,
            carryoverAmount: sisa.toString()
          });
          rolloverSnapshot.push({ budgetId: newBudget, previousCarryoverAmount: "0" });
          insertedBudgetIds.push(newBudget);
          rolloverCount++;
        }
      }
    }

    // Save snapshot for rollback
    if (sweptSnapshot.length > 0 || rolloverSnapshot.length > 0) {
      await saveSnapshotInternal(ctx, userId, {
        householdId: householdId ?? undefined,
        month,
        year,
        sweptBudgets: sweptSnapshot,
        rolledOverBudgets: rolloverSnapshot,
        insertedBudgets: insertedBudgetIds,
      });
    }

    await recomputeUserCache(ctx, userId, householdId);
    return { sweptCount, rolloverCount };
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
    const { startDay, timezone } = getFiscalConfig(household);

    const now = getServerNow(timezone);
    const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);

    // Batch collect all budgets once — index by month and by category key for O(1) lookups
    let allBudgets;
    if (householdId) {
      allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
      allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", userId)).collect();
    }
    const budgetsByMonth = new Map<number, typeof allBudgets>();
    const budgetByKey = new Map<string, typeof allBudgets[number]>();
    for (const b of allBudgets) {
      if (!budgetsByMonth.has(b.month)) budgetsByMonth.set(b.month, []);
      budgetsByMonth.get(b.month)!.push(b);
      budgetByKey.set(`${b.categoryId}_${b.year}_${b.month}`, b);
    }

    // Collect accounts and categories (small tables, unchanged)
    let allAccounts;
    let allCategories;
    if (householdId) {
      allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
      allCategories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
      allAccounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", userId)).collect();
      allCategories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", userId)).collect();
    }
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));
    const categoriesMap = new Map(allCategories.map(c => [c._id, c]));

    // Lazy-load fiscal year transactions once (only if any month has budgets)
    let allTransactions: Doc<"transactions">[] | undefined;

    const correctedCarryover = new Map<string, number>();
    let totalRollovers = 0;

    for (let m = 0; m <= currentMonth; m++) {
      const sourceBudgets = budgetsByMonth.get(m) ?? [];
      if (sourceBudgets.length === 0) continue;

      let targetMonth = m + 1;
      let targetYear = currentYear;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear++;
      }

      // Single efficient range query for all fiscal year transactions
      const { start: monthStart, end: monthEnd } = getFiscalMonthRange(currentYear, m, startDay);

      if (!allTransactions) {
        const { start: fiscalStart } = getFiscalMonthRange(currentYear, 0, startDay);
        const { end: fiscalEnd } = getFiscalMonthRange(currentYear, currentMonth, startDay);
        if (householdId) {
          allTransactions = await ctx.db.query("transactions")
            .withIndex("by_householdId_date", q => q.eq("householdId", householdId).gte("date", fiscalStart))
            .filter(q => q.lte(q.field("date"), fiscalEnd))
            .collect();
        } else {
          allTransactions = await ctx.db.query("transactions")
            .withIndex("by_userId_date", q => q.eq("userId", userId).gte("date", fiscalStart))
            .filter(q => q.lte(q.field("date"), fiscalEnd))
            .collect();
        }
      }

      const sourceTransactions = allTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= new Date(monthStart) && tDate <= new Date(monthEnd);
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
          const targetKey = `${b.categoryId}_${targetYear}_${targetMonth}`;
          const targetBudget = budgetByKey.get(targetKey);

          if (targetBudget) {
            const targetCarryover = parseFloat(targetBudget.carryoverAmount?.replace(/,/g, '') || '0');
            if (Math.abs(targetCarryover - sisa) > 0.01) {
              await ctx.db.patch(targetBudget._id, { carryoverAmount: sisa.toString() });
              totalRollovers++;
              budgetByKey.set(targetKey, { ...targetBudget, carryoverAmount: sisa.toString() });
            }
          } else {
            const newId = await ctx.db.insert("budgets", {
              userId,
              householdId,
              categoryId: b.categoryId,
              amount: "0",
              year: targetYear,
              month: targetMonth,
              carryoverAmount: sisa.toString()
            });
            totalRollovers++;

            // Add to in-memory maps for subsequent month iterations
            const newEntry = {
              _id: newId,
              _creationTime: Date.now(),
              userId,
              householdId,
              categoryId: b.categoryId,
              amount: "0" as const,
              year: targetYear,
              month: targetMonth,
              carryoverAmount: sisa.toString(),
            };
            budgetByKey.set(targetKey, newEntry as typeof allBudgets[number]);
            if (!budgetsByMonth.has(targetMonth)) budgetsByMonth.set(targetMonth, []);
            budgetsByMonth.get(targetMonth)!.push(newEntry as typeof allBudgets[number]);
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
    const { startDay, timezone } = getFiscalConfig(household);

    const now = getServerNow(timezone);
    const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);

    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }

    const rolloverCount = await performRollover(ctx, userId, householdId, prevYear, prevMonth, startDay);
    if (rolloverCount > 0) {
      await recomputeUserCache(ctx, userId, householdId);
    }
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
    const { startDay, timezone } = getFiscalConfig(household);

    const now = getServerNow(timezone);
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

    // 2. Calculate date range for the report period
    let earliestYear = currentYear, earliestMonth = currentMonth, latestYear = currentYear, latestMonth = currentMonth;
    for (let i = months - 1; i >= 0; i--) {
        let m = currentMonth - i;
        let y = currentYear;
        while (m < 0) { m += 12; y--; }
        while (m > 11) { m -= 12; y++; }
        if (i === months - 1) { earliestYear = y; earliestMonth = m; }
        if (i === 0) { latestYear = y; latestMonth = m; }
    }
    const { start: reportStart } = getFiscalMonthRange(earliestYear, earliestMonth, startDay);
    const { end: reportEnd } = getFiscalMonthRange(latestYear, latestMonth, startDay);

    let allTransactions;
    if (householdId) {
        allTransactions = await ctx.db.query("transactions")
            .withIndex("by_householdId_date", q => q.eq("householdId", householdId).gte("date", reportStart).lte("date", reportEnd))
            .collect();
    } else {
        allTransactions = await ctx.db.query("transactions")
            .withIndex("by_userId_date", q => q.eq("userId", userId).gte("date", reportStart).lte("date", reportEnd))
            .collect();
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