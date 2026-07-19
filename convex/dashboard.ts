import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  calculateSpendingByCategory,
  calculateMonthlyBudgetLeft,
  calculateUnassignedCash,
  AccountMap,
  isLiquidAccount,
  getFiscalMonthRange,
  getFiscalDateDetails,
  analyzeTransactionFlow,
  parseAmount
} from "./lib/finance";
import { TRANSACTION_TYPES, ACCOUNT_TYPES } from "./lib/constants";
import { getCache } from "./lib/recomputeCache";

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

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

    const cache = await getCache(ctx, userId, householdId ?? undefined);

    // 0. Fetch Accounts
    let allAccounts;

    if (householdId) {
        allAccounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allAccounts = await ctx.db.query("accounts").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    
    const accounts = allAccounts.filter(a => !a.isArchived && (a.visibility !== "private" || a.userId === userId));
    const accountsMap: AccountMap = new Map(allAccounts.map(a => [String(a._id), a]));

    // Pre-compute fiscal month details
    const now = new Date();
    const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);
    const { start: startOfFiscal, end: endOfFiscal } = getFiscalMonthRange(currentYear, currentMonth, startDay);

    let currentMonthTransactions;
    if (householdId) {
        currentMonthTransactions = await ctx.db.query("transactions")
            .withIndex("by_householdId_date", (q) => q.eq("householdId", householdId).gte("date", startOfFiscal).lte("date", endOfFiscal))
            .collect();
    } else {
        currentMonthTransactions = await ctx.db.query("transactions")
            .withIndex("by_userId_date", (q) => q.eq("userId", userId).gte("date", startOfFiscal).lte("date", endOfFiscal))
            .collect();
    }

    // 1. Split Balances & Funds Allocation
    const liquidCash = accounts
      .filter((a: Doc<"accounts">) => isLiquidAccount(a))
      .reduce((acc: number, a: Doc<"accounts">) => acc + parseFloat(a.balance.replace(/,/g, '') || '0'), 0);

    const totalSavingsOnly = accounts
      .filter((a: Doc<"accounts">) => a.type === 'SAVING')
      .reduce((acc: number, a: Doc<"accounts">) => acc + parseFloat(a.balance.replace(/,/g, '') || '0'), 0);

    const totalAssetsOnly = accounts
      .filter((a: Doc<"accounts">) => a.type === 'ASSET')
      .reduce((acc: number, a: Doc<"accounts">) => acc + parseFloat(a.balance.replace(/,/g, '') || '0'), 0);

    // --- FUNDS ALLOCATION LOGIC (In-Memory) ---
    const allocationMap = new Map<string, { name: string, amount: number }[]>();
    const transfers = currentMonthTransactions.filter(t => t.type === TRANSACTION_TYPES.TRANSFER && t.toAccountId);
    
    const specialAccountIds = new Set(
        accounts
            .filter(a => a.type === ACCOUNT_TYPES.SAVING || a.type === ACCOUNT_TYPES.ASSET)
            .map(a => a._id)
    );

    transfers.forEach(t => {
        const amount = parseFloat(t.amount.replace(/,/g, '') || '0');
        
        // Outgoing: Liquid -> Special
        if (t.accountId && specialAccountIds.has(t.toAccountId!) && accountsMap.has(t.accountId)) {
            if (isLiquidAccount(accountsMap.get(t.accountId))) {
                const list = allocationMap.get(t.accountId) || [];
                const destName = accountsMap.get(t.toAccountId!)?.name || "Unknown Goal";
                
                const existingItem = list.find(i => i.name === destName);
                if (existingItem) {
                    existingItem.amount += amount;
                } else {
                    list.push({ name: destName, amount });
                }
                allocationMap.set(t.accountId, list);
            }
        }

        // Incoming: Special -> Liquid
        if (t.toAccountId && specialAccountIds.has(t.accountId) && accountsMap.has(t.toAccountId)) {
             if (isLiquidAccount(accountsMap.get(t.toAccountId!))) {
                const list = allocationMap.get(t.toAccountId!) || [];
                const sourceName = accountsMap.get(t.accountId)?.name || "Unknown Goal";
                
                const existingItem = list.find(i => i.name === sourceName);
                if (existingItem) {
                    existingItem.amount -= amount;
                } else {
                    list.push({ name: sourceName, amount: -amount });
                }
                allocationMap.set(t.toAccountId!, list);
             }
        }
    });

    const cashAccounts = accounts
      .filter((a: Doc<"accounts">) => isLiquidAccount(a))
      .map((a: Doc<"accounts">) => {
        const rawAllocations = allocationMap.get(a._id) || [];
        const allocations = rawAllocations.filter(i => i.amount > 0);
        const totalAllocated = allocations.reduce((sum, i) => sum + i.amount, 0);
        const balance = parseFloat(a.balance.replace(/,/g, '') || '0');

        return {
            name: a.name,
            balance: balance,
            allocations,
            // Reconciled Balance: DB Balance (Available) + Allocated Funds
            bankBalance: balance + totalAllocated
        };
      });

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
    let budgets;
    if (householdId) {
        budgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", currentYear).eq("month", currentMonth)).collect();
    } else {
        budgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => 
            q.eq("userId", userId).eq("year", currentYear).eq("month", currentMonth)
        ).collect();
    }

    let categories;
    if (householdId) {
        categories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        categories = await ctx.db.query("categories").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }
    const categoriesMap = new Map(categories.map(c => [c._id, c]));

    const spendingByCategory = calculateSpendingByCategory(currentMonthTransactions, accountsMap, categoriesMap);
    const accumulatedByCategoryMap = new Map(
      (cache?.accumulatedByCategory ?? []).map((item) => [item.categoryId, item.amount])
    );

    // 2.0.1 Calculate Pending Receivables Per Category (For Visual Arsir)
    const pendingReceivablesByCategory: Record<string, number> = {};
    currentMonthTransactions.forEach(t => {
        if (t.isReimbursable && (t.settlementStatus === 'unpaid' || t.settlementStatus === 'partial')) {
            const amountValue = parseAmount(t.amount);
            const paidValue = parseAmount(t.amountPaid);
            const remaining = Math.max(0, amountValue - paidValue);

            const flows = analyzeTransactionFlow(t, accountsMap, categoriesMap);
            flows.forEach(flow => {
                if (flow.type === 'SPENDING') {
                    // Proportional remaining
                    const flowRatio = flow.amount / amountValue;
                    const flowRemaining = remaining * flowRatio;
                    pendingReceivablesByCategory[flow.categoryId] = (pendingReceivablesByCategory[flow.categoryId] || 0) + flowRemaining;
                }
            });
        }
    });

    // 2.1 Categories Info
    // Categories already fetched above
    const budgetMap = new Map(budgets.map(b => [b.categoryId, b]));

    const budgetBreakdown = categories
        .filter(cat => {
            // Include if it has a budget THIS month OR if it's a saving/goal type that is active
            const hasBudget = budgetMap.has(cat._id);
            const isGoal = cat.type === 'saving';
            const isActive = cat.status !== 'achieved' && cat.status !== 'archived' && !cat.isArchived;
            return (hasBudget || isGoal) && isActive;
        })
        .map(cat => {
            const b = budgetMap.get(cat._id);
            const allocated = b ? parseFloat(b.amount.replace(/,/g, '') || '0') : 0;
            const carryover = b ? parseFloat(b.carryoverAmount?.replace(/,/g, '') || '0') : 0;
            const limit = allocated + carryover;
            
            const spent = spendingByCategory[cat._id] || 0;
            const accumulated = accumulatedByCategoryMap.get(String(cat._id)) ?? 0;
            
            return {
                categoryId: cat._id,
                categoryName: cat?.name || 'Unknown',
                categoryType: cat?.type || 'expense',
                targetAmount: cat?.targetAmount ? parseFloat(cat.targetAmount.replace(/,/g, '')) : undefined,
                targetDate: cat?.targetDate,
                enablePacing: cat?.enablePacing,
                goalType: cat?.goalType,
                accumulated,
                limit,
                carryover,
                spent,
                remaining: Math.max(0, limit - spent),
                pendingReceivables: pendingReceivablesByCategory[cat._id] || 0,
            };
    });

    const budgetSummary = calculateMonthlyBudgetLeft(budgets, categories, spendingByCategory);
    const remainingBudget = budgetSummary.totalRemaining;

    // 2.2 Calculate Unassigned Cash & Obligation Breakdown (Using Helper logic but split)
    let allBudgets;
    if (householdId) {
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
    } else {
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", (q) => q.eq("userId", userId)).collect();
    }
    
    // We need category types to split obligations
    const catMap = new Map(categories.map(c => [c._id, c]));
    
    // Group all transactions by month/category for historical obligation check
    const monthlySpendingAll = cache?.monthlySpending ?? [];

    let totalExpenseObligations = 0;
    let totalSavingObligations = 0;
    let totalDebtCovered = 0;

    allBudgets.forEach(b => {
        const monthData = monthlySpendingAll.find(m => m.year === b.year && m.month === b.month);
        const spent = monthData?.spending.find(s => s.categoryId === String(b.categoryId))?.amount ?? 0;
        const allocated = parseAmount(b.amount);
        const carryover = parseAmount(b.carryoverAmount);
        const swept = parseAmount(b.sweptAmount);
        
        const cat = catMap.get(b.categoryId);
        const baseObligation = (allocated + carryover) - swept;
        const remaining = Math.max(0, baseObligation - spent);

        if (cat?.type === 'expense') {
            totalExpenseObligations += remaining;
            if (carryover < 0) totalDebtCovered += Math.abs(carryover);
        } else if (cat?.type === 'saving') {
            totalSavingObligations += remaining;
        }
    });

    const unassignedCash = calculateUnassignedCash(
      currentMonthTransactions,
      budgets,
      accountsMap,
      startDay,
      categoriesMap,
      currentMonth,
      currentYear
    );

    // 2.3 Calculate Receivables (Pending & Partial Only)
    const rawReceivables = householdId
        ? await ctx.db.query("transactions")
            .withIndex("by_receivables_status", q => q.eq("householdId", householdId).eq("isReimbursable", true).eq("reimbursementStatus", "pending"))
            .collect()
        : await ctx.db.query("transactions")
            .withIndex("by_userId_reimbursable_status", q => q.eq("userId", userId).eq("isReimbursable", true).eq("reimbursementStatus", "pending"))
            .collect();

    const pendingReceivablesList = rawReceivables
        .filter(t => t.settlementStatus === 'unpaid' || t.settlementStatus === 'partial')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalReceivables = pendingReceivablesList.reduce((acc, t) => {
        const remaining = parseAmount(t.amount) - parseAmount(t.amountPaid);
        return acc + remaining;
    }, 0);

    // 3. Recent Transactions
    const sortedTransactions = householdId
      ? await ctx.db.query("transactions")
          .withIndex("by_householdId_date", (q) => q.eq("householdId", householdId))
          .order("desc")
          .take(10)
      : await ctx.db.query("transactions")
          .withIndex("by_userId_date", (q) => q.eq("userId", userId))
          .order("desc")
          .take(10);

    // Batch Fetch Related Entities for Recent Transactions
    const txAccountIds = new Set<Id<"accounts">>();
    const txCategoryIds = new Set<Id<"categories">>();
    const txLabelIds = new Set<Id<"labels">>();
    const txMerchantIds = new Set<Id<"merchants">>();

    sortedTransactions.forEach(t => {
        txAccountIds.add(t.accountId);
        if (t.toAccountId) txAccountIds.add(t.toAccountId);
        if (t.categoryId) txCategoryIds.add(t.categoryId);
        if (t.labelIds) t.labelIds.forEach(id => txLabelIds.add(id));
        if (t.merchantId) txMerchantIds.add(t.merchantId);

        t.splits?.forEach(s => {
            txCategoryIds.add(s.categoryId);
            if (s.labelIds) s.labelIds.forEach(id => txLabelIds.add(id));
        });
    });

    const [txAccounts, txCategories, txLabels, txMerchants] = await Promise.all([
        Promise.all(Array.from(txAccountIds).map(id => ctx.db.get(id))),
        Promise.all(Array.from(txCategoryIds).map(id => ctx.db.get(id))),
        Promise.all(Array.from(txLabelIds).map(id => ctx.db.get(id))),
        Promise.all(Array.from(txMerchantIds).map(id => ctx.db.get(id))),
    ]);

    const txAccountMap = new Map(txAccounts.filter(Boolean).map(a => [a!._id, a!]));
    const txCategoryMap = new Map(txCategories.filter(Boolean).map(c => [c!._id, c!]));
    const txLabelMap = new Map(txLabels.filter(Boolean).map(l => [l!._id, l!]));
    const txMerchantMap = new Map(txMerchants.filter(Boolean).map(m => [m!._id, m!]));

    const recentTransactions = sortedTransactions.map((t) => {
            const fromAccount = txAccountMap.get(t.accountId);
            const toAccount = t.toAccountId ? txAccountMap.get(t.toAccountId) : null;
            const category = t.categoryId ? txCategoryMap.get(t.categoryId) : null;
            const labels = t.labelIds
              ? t.labelIds.map(id => txLabelMap.get(id)).filter(Boolean)
              : [];
            const merchant = t.merchantId ? txMerchantMap.get(t.merchantId) : null;

            const splitsWithDetails = t.splits?.map((split) => {
                    const splitCategory = txCategoryMap.get(split.categoryId);
                    const splitLabels = split.labelIds
                      ? split.labelIds.map(id => txLabelMap.get(id)).filter(Boolean)
                      : [];
                    return {
                        ...split,
                        categoryName: splitCategory?.name,
                        labelNames: splitLabels.map(l => l!.name),
                        labelColors: splitLabels.map(l => l!.color),
                    };
                });

            const hideAmount = t.isSplit && t.splits && t.splits.length > 0
                ? t.splits.some(s => txCategoryMap.get(s.categoryId)?.hideAmount === true)
                : (category?.hideAmount ?? false);

            return {
                ...t,
                fromAccountName: fromAccount?.name,
                toAccountName: toAccount?.name,
                categoryName: category?.name,
                hideAmount,
                labels,
                merchant: merchant || null,
                splits: splitsWithDetails,
            };
    });

    const pendingReceivables = pendingReceivablesList.map(t => {
        const fromAccount = accountsMap.get(String(t.accountId));
        const category = t.categoryId ? catMap.get(t.categoryId) : null;
        return {
            ...t,
            fromAccountName: fromAccount?.name,
            categoryName: category?.name,
        };
    });

    return {
      liquidCash,
      totalSavingsOnly,
      totalAssetsOnly,
      cashAccounts,
      savingAccounts,
      assetAccounts,
      remainingBudget,
      unassignedCash,
      totalExpenseObligations,
      totalSavingObligations,
      totalDebtCovered,
      budgetBreakdown,
      recentTransactions,
      // NEW
      totalReceivables,
      pendingReceivables,
    };
  },
});

export const getMonthlyTrends = query({
  args: { householdId: v.optional(v.id("households")), months: v.optional(v.number()) },
  handler: async (ctx, { householdId, months = 3 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    if (householdId && !(await ensureHouseholdAccess(ctx, householdId, userId))) {
      return [];
    }

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

    const cache = await getCache(ctx, userId, householdId ?? undefined);
    if (!cache) return [];

    const numMonths = months;

    // Calculate fiscal start date
    const now = new Date();
    const { year: currentYear, month: currentMonth } = getFiscalDateDetails(
      now.toISOString(),
      startDay
    );

    // Filter cached monthlySpending to last N months
    const monthKeys = new Set<string>();
    for (let i = 0; i < numMonths; i++) {
      let y = currentYear;
      let m = currentMonth - i;
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      monthKeys.add(`${y}-${String(m).padStart(2, "0")}`);
    }

    const filteredMonths = cache.monthlySpending.filter((ms) =>
      monthKeys.has(`${ms.year}-${String(ms.month).padStart(2, "0")}`)
    );

    // Resolve category names - one bulk query instead of per-category point reads
    const allCategories = householdId
      ? await ctx.db
          .query("categories")
          .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
          .collect()
      : await ctx.db
          .query("categories")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .collect();

    const categoryNameMap = new Map(
      allCategories.map((c) => [String(c._id), c.name])
    );

    // Build output — ensure all N months are present (fill zeros for missing months)
    const monthArray = Array.from(monthKeys)
      .map((key) => {
        const [y, m] = key.split("-").map(Number);
        const cached = filteredMonths.find((ms) => ms.year === y && ms.month === m);
        if (cached) {
          const categories = cached.spending
            .map((s) => ({
              categoryId: s.categoryId,
              categoryName: categoryNameMap.get(s.categoryId) ?? "Unknown",
              spent: s.amount,
            }))
            .sort((a, b) => b.spent - a.spent);

          return {
            year: cached.year,
            month: cached.month,
            totalSpent: cached.totalSpent,
            categories,
          };
        }
        return {
          year: y,
          month: m,
          totalSpent: 0,
          categories: [],
        };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month);

    return monthArray;
  },
});