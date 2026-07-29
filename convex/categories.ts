import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { checkHouseholdAccess, ensureHouseholdAccess, ensureAdminAccess } from "./lib/auth";
import { CATEGORY_TYPES, GOAL_TYPES, GOAL_STATUS, ACCOUNT_TYPES } from "./lib/constants";
import { 
  getFiscalDateDetails, 
  getFiscalMonthRange, 
  calculateSpendingByCategory, 
  AccountMap, 
  parseAmount, 
  analyzeTransactionFlow,
  getServerNow
} from "./lib/finance";

function calculateThisMonthContribution(
  transactions: Doc<"transactions">[],
  categoryId: Id<"categories">,
  linkedAccountId: Id<"accounts"> | undefined,
  startOfThisMonth: number
): number {
  return transactions
    .filter(t => new Date(t.date).getTime() >= startOfThisMonth)
    .reduce((acc, t) => {
      const amt = parseFloat(t.amount.replace(/,/g, '') || '0');
      if (linkedAccountId) {
        if (t.toAccountId === linkedAccountId) return acc + amt;
        if (t.accountId === linkedAccountId) {
          if (t.isGoalDisbursement) return acc;
          return acc - amt;
        }
      }
      if (t.categoryId === categoryId) return acc + amt;
      if (t.isSplit && t.splits?.some(s => s.categoryId === categoryId)) {
        const s = t.splits.find(s => s.categoryId === categoryId);
        return acc + (s ? parseFloat(s.amount.replace(/,/g, '') || '0') : 0);
      }
      return acc;
    }, 0);
}

export const getGoalDetails = query({
  args: {
    id: v.id("categories"),
    householdId: v.optional(v.id("households")),
  },
  handler: async (ctx, { id, householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");

    if (householdId) {
        if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    } else {
        if (category.userId !== identity.subject) throw new Error("Unauthorized");
    }

    // Fetch context for calculation
    let transactions;
    let accounts;
    let categories;

    if (householdId) {
        transactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        categories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        transactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
        accounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
        categories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }

    const accountsMap: AccountMap = new Map(accounts.map((a: Doc<"accounts">) => [String(a._id), a]));
    const categoriesMap = new Map(categories.map((c: Doc<"categories">) => [String(c._id), c]));
    
    const linkedAccount = accounts.find((a: Doc<"accounts">) => a.linkedCategoryId === id);
    const linkedAccountId = linkedAccount?._id;
    
    let currentAmount = 0;
    
    if (linkedAccount) {
        currentAmount = Math.max(0, parseFloat(linkedAccount.balance.replace(/,/g, '') || '0'));
    } else {
        if (category.type === CATEGORY_TYPES.SAVING && category.lastResetDate) {
            const resetTime = new Date(category.lastResetDate).getTime();
            const currentCycleTransactions = transactions.filter(t => new Date(t.date).getTime() > resetTime);
            const cycleSpending = calculateSpendingByCategory(currentCycleTransactions, accountsMap, categoriesMap);
            currentAmount = cycleSpending[String(id)] || 0;
        } else {
            const spendingMap = calculateSpendingByCategory(transactions, accountsMap, categoriesMap);
            currentAmount = spendingMap[String(id)] || 0;
        }
    }

    const pastCycles = await ctx.db
        .query("goalHistory")
        .withIndex("by_categoryId", q => q.eq("categoryId", id))
        .order("desc")
        .collect();
    
    let startDay = 1;
    let timezone: string | null = null;
    if (householdId) {
        const household = await ctx.db.get(householdId);
        startDay = household?.budgetStartDay || 1;
        timezone = household?.timezone ?? null;
    }
    const now = getServerNow(timezone);
    const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);
    let currentBudget;
    if (householdId) {
        currentBudget = await ctx.db.query("budgets")
            .withIndex("by_householdId_category_year_month", q => 
                q.eq("householdId", householdId)
                 .eq("categoryId", id)
                 .eq("year", currentYear)
                 .eq("month", currentMonth)
            ).first();
    } else {
        currentBudget = await ctx.db.query("budgets")
            .withIndex("by_user_category_year_month", q => 
                q.eq("userId", identity.subject)
                 .eq("categoryId", id)
                 .eq("year", currentYear)
                 .eq("month", currentMonth)
            ).first();
    }

    const history = transactions
        .filter(t => {
            const isMain = t.categoryId === id;
            const isSplit = t.isSplit && t.splits?.some(s => s.categoryId === id);
            return isMain || isSplit;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
        .map(t => ({
            _id: t._id,
            date: t.date,
            amount: t.amount, 
            description: t.description,
            type: t.type
        }));

    const { start } = getFiscalMonthRange(currentYear, currentMonth, startDay);
    const startOfThisMonth = new Date(start).getTime();
    const thisMonthContribution = calculateThisMonthContribution(transactions, id, linkedAccountId, startOfThisMonth);

    return {
        category,
        currentAmount,
        history,
        pastCycles,
        currentBudget,
        thisMonthContribution,
        linkedAccountId
    };
  }
});

export const getCategoryDetails = query({
  args: {
    id: v.id("categories"),
    householdId: v.optional(v.id("households")),
    dateRange: v.optional(v.object({
      start: v.string(),
      end: v.string(),
    })),
    accountIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, householdId, dateRange, accountIds }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");

    if (householdId) {
        if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) throw new Error("Unauthorized");
    } else {
        if (category.userId !== identity.subject) throw new Error("Unauthorized");
    }

    let startDay = 1;
    let timezone: string | null = null;
    if (category.householdId) {
        const h = await ctx.db.get(category.householdId);
        if (h?.budgetStartDay) startDay = h.budgetStartDay;
        timezone = h?.timezone ?? null;
    } else if (householdId) {
        const h = await ctx.db.get(householdId);
        if (h?.budgetStartDay) startDay = h.budgetStartDay;
        timezone = h?.timezone ?? null;
    } else {
        const members = await ctx.db.query("householdMembers").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
        const households = await Promise.all(members.map(m => ctx.db.get(m.householdId)));
        const configuredHousehold = households.find(h => h && h.budgetStartDay && h.budgetStartDay > 1);
        if (configuredHousehold) {
            startDay = configuredHousehold.budgetStartDay!;
            timezone = configuredHousehold.timezone ?? null;
        }
    }

    const now = getServerNow(timezone);
    const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);
    
    let allTransactions;
    let allBudgets;
    let accounts;
    let categories;

    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
        accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        categories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", identity.subject)).collect();
        accounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
        categories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }

    const accountsMap: AccountMap = new Map(accounts.map((a: Doc<"accounts">) => [String(a._id), a]));
    const categoriesMap = new Map(categories.map((c: Doc<"categories">) => [String(c._id), c]));

    // Compute weeklySpent for this category (if weekly allowance)
    let weeklySpent = 0;
    if (category.allowanceType === "weekly") {
        const resetDay = category.weeklyResetDay ?? 1;
        const dayOfWeek = now.getDay();
        let weekStart = new Date(now);
        const daysSinceReset = (dayOfWeek - resetDay + 7) % 7;
        weekStart.setDate(weekStart.getDate() - daysSinceReset);
        weekStart.setHours(0, 0, 0, 0);
        const weekStartStr = weekStart.toISOString();
        const nowStr = now.toISOString();

        // Get fiscal period date range (same as getDashboardSummary)
        const { start: fiscalStart, end: fiscalEnd } = getFiscalMonthRange(currentYear, currentMonth, startDay);

        // Filter current fiscal period transactions within the current week
        const weekTransactions = allTransactions.filter((t: any) => {
            return t.date >= weekStartStr && t.date <= nowStr && t.date >= fiscalStart && t.date <= fiscalEnd;
        });
        const weekSpending = calculateSpendingByCategory(weekTransactions, accountsMap, categoriesMap);
        weeklySpent = weekSpending[String(id)] || 0;
    }

    const historyData = [];
    
    for (let i = 11; i >= 0; i--) {
        let m = currentMonth - i;
        let y = currentYear;
        while (m < 0) { m += 12; y--; }
        
        const budget = allBudgets.find(b => String(b.categoryId) === String(id) && b.year === y && b.month === m);
        const { start, end } = getFiscalMonthRange(y, m, startDay);
        
        const monthTx = allTransactions.filter(t => {
            const d = new Date(t.date);
            return d >= new Date(start) && d <= new Date(end);
        });
        
        const spendingMap = calculateSpendingByCategory(monthTx, accountsMap, categoriesMap);
        const spent = spendingMap[String(id)] || 0;

        let pendingReceivables = 0;
        monthTx.forEach(t => {
            if (t.isReimbursable && (t.settlementStatus === 'unpaid' || t.settlementStatus === 'partial')) {
                const amountValue = parseAmount(t.amount);
                const paidValue = parseAmount(t.amountPaid);
                const remaining = Math.max(0, amountValue - paidValue);

                const flows = analyzeTransactionFlow(t, accountsMap, categoriesMap);
                flows.forEach(flow => {
                    if (flow.type === 'SPENDING' && String(flow.categoryId) === String(id)) {
                        const flowRatio = flow.amount / amountValue;
                        pendingReceivables += (remaining * flowRatio);
                    }
                });
            }
        });

        const labelDate = new Date(y, m, startDay);
        const label = labelDate.toLocaleDateString('en-US', { month: 'short' });

        historyData.push({
            year: y,
            month: m,
            label,
            budgetAmount: budget ? parseFloat(budget.amount.replace(/,/g, '') || '0') : 0,
            sweptAmount: budget?.sweptAmount ? parseFloat(budget.sweptAmount.replace(/,/g, '') || '0') : 0,
            carryoverAmount: budget?.carryoverAmount ? parseFloat(budget.carryoverAmount.replace(/,/g, '') || '0') : 0,
            spent,
            pendingReceivables,
        });
    }

    let filteredTransactions = allTransactions
        .filter(t => {
            const isMain = t.categoryId === id;
            const isSplit = t.isSplit && t.splits?.some(s => s.categoryId === id);
            return isMain || isSplit;
        });

    if (dateRange?.start) filteredTransactions = filteredTransactions.filter(t => t.date >= dateRange.start!);
    if (dateRange?.end) filteredTransactions = filteredTransactions.filter(t => t.date <= dateRange.end!);

    if (accountIds && accountIds.length > 0) {
        filteredTransactions = filteredTransactions.filter(t => 
            accountIds.includes(String(t.accountId)) || 
            (t.toAccountId && accountIds.includes(String(t.toAccountId)))
        );
    }

    const sortedTransactions = filteredTransactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 50);

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

    const categoryHideAmount = category?.hideAmount ?? false;

    const recentTransactions = sortedTransactions.map((t) => {
            const fromAccount = txAccountMap.get(t.accountId);
            const toAccount = t.toAccountId ? txAccountMap.get(t.toAccountId) : null;
            const category = t.categoryId ? txCategoryMap.get(t.categoryId) : null;
            const labels = t.labelIds
              ? t.labelIds.map(id => txLabelMap.get(id)).filter(Boolean)
              : [];
            const merchant = t.merchantId ? txMerchantMap.get(t.merchantId) : null;

            let displayAmount = t.amount;
            let displayDescription = t.description;

            if (t.isSplit && t.splits) {
                const matchingSplits = t.splits.filter(s => String(s.categoryId) === String(id));
                if (matchingSplits.length > 0) {
                    const totalSplitAmt = matchingSplits.reduce((acc, s) => acc + parseFloat(s.amount.replace(/,/g, '') || '0'), 0);
                    displayAmount = totalSplitAmt.toString();
                    const specificDesc = matchingSplits.find(s => s.description)?.description;
                    if (specificDesc) displayDescription = specificDesc;
                }
            }

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

            return {
                ...t,
                amount: displayAmount,
                description: displayDescription,
                fromAccountName: fromAccount?.name,
                toAccountName: toAccount?.name,
                categoryName: category?.name,
                hideAmount: categoryHideAmount,
                labels,
                merchant: merchant || null,
                splits: splitsWithDetails,
            };
    });

    return {
        category,
        historyData,
        recentTransactions,
        weeklySpent,
    };
  }
});

export const get = query({
  args: {
    householdId: v.optional(v.id("households")),
    type: v.optional(v.string()),
    showArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, { householdId, type, showArchived }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let query;
    if (householdId) {
        if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) return [];
        query = ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", householdId));
    } else {
        query = ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", identity.subject));
    }

    if (type) {
      query = query.filter((q) => q.eq(q.field("type"), type));
    }

    const categories = await query.collect();

    const filtered = showArchived 
        ? categories 
        : categories.filter(c => !c.isArchived && c.status !== GOAL_STATUS.ARCHIVED);

    if (type === 'saving') {
        let transactions;
        let accounts;
        if (householdId) {
            transactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
            accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        } else {
            transactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
            accounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
        }
    const accountsMap: AccountMap = new Map(accounts.map((a: Doc<"accounts">) => [String(a._id), a]));
    const categoriesMap = new Map(categories.map((c: Doc<"categories">) => [String(c._id), c]));
        
        let startDay = 1;
        let timezone: string | null = null;
        if (householdId) {
            const household = await ctx.db.get(householdId);
            startDay = household?.budgetStartDay || 1;
            timezone = household?.timezone ?? null;
        }
        const now = getServerNow(timezone);
        const { year, month } = getFiscalDateDetails(now.toISOString(), startDay);
        const { start } = getFiscalMonthRange(year, month, startDay);
        const startOfThisMonth = new Date(start).getTime();

        let monthlyBudgets;
        if (householdId) {
            monthlyBudgets = await ctx.db.query("budgets")
                .withIndex("by_householdId_year_month", q => q.eq("householdId", householdId).eq("year", year).eq("month", month))
                .collect();
        } else {
            monthlyBudgets = await ctx.db.query("budgets")
                .withIndex("by_userId_year_month", q => q.eq("userId", identity.subject).eq("year", year).eq("month", month))
                .collect();
        }
        const budgetMap = new Map(monthlyBudgets.map(b => [b.categoryId, b]));

        const baseSpendingMap = calculateSpendingByCategory(transactions, accountsMap, categoriesMap);

        return filtered.map(c => {
            let amount = 0;
            const cLinkedAccount = accounts.find((a: Doc<"accounts">) => a.linkedCategoryId === c._id);
            const cLinkedAccountId = cLinkedAccount?._id;

            if (cLinkedAccount) {
                 amount = Math.max(0, parseFloat(cLinkedAccount.balance.replace(/,/g, '') || '0'));
            } else {
                amount = baseSpendingMap[c._id] || 0;
                if (c.lastResetDate) {
                    const resetTime = new Date(c.lastResetDate).getTime();
                    const relevantTx = transactions.filter(t => {
                        const isAfter = new Date(t.date).getTime() > resetTime;
                        if (!isAfter) return false;
                        if (t.categoryId === c._id) return true;
                        if (t.isSplit && t.splits?.some(s => s.categoryId === c._id)) return true;
                        return false;
                    });
                    const cycleMap = calculateSpendingByCategory(relevantTx, accountsMap, categoriesMap);
                    amount = cycleMap[c._id] || 0;
                }
            }

            const thisMonthContribution = calculateThisMonthContribution(transactions, c._id, cLinkedAccountId, startOfThisMonth);

            return {
                ...c,
                currentAmount: amount,
                currentBudget: budgetMap.get(c._id),
                thisMonthContribution
            };
        });
    }

    return filtered;
  },
});

export const create = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    name: v.string(),
    type: v.string(),
    targetAmount: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    enablePacing: v.optional(v.boolean()),
    goalType: v.optional(v.union(v.literal("investment"), v.literal("bill"), v.literal("purchase"))),
    monthlyBudget: v.optional(v.string()),
    hideAmount: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (args.householdId) {
        await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
        await ensureAdminAccess(ctx, args.householdId, identity.subject);
    }

    const { monthlyBudget, hideAmount, ...rest } = args;

    const categoryId = await ctx.db.insert("categories", {
      ...rest,
      userId: identity.subject,
      status: GOAL_STATUS.ACTIVE,
      goalType: args.goalType,
      hideAmount: hideAmount ?? false,
    });

    if (args.type === CATEGORY_TYPES.SAVING) {
        await ctx.db.insert("accounts", {
            userId: identity.subject,
            householdId: args.householdId,
            name: args.name,
            balance: "0",
            type: ACCOUNT_TYPES.SAVING,
            linkedCategoryId: categoryId
        });

        if (args.monthlyBudget) {
            let startDay = 1;
            let timezone: string | null = null;
            if (args.householdId) {
                const household = await ctx.db.get(args.householdId);
                startDay = household?.budgetStartDay || 1;
                timezone = household?.timezone ?? null;
            } else {
                const member = await ctx.db.query("householdMembers").withIndex("by_userId", q => q.eq("userId", identity.subject)).first();
                if (member) {
                    const household = await ctx.db.get(member.householdId);
                    startDay = household?.budgetStartDay || 1;
                    timezone = household?.timezone ?? null;
                }
            }

            const now = getServerNow(timezone);
            const { year, month } = getFiscalDateDetails(now.toISOString(), startDay);

            const existingBudget = await ctx.db.query("budgets")
                .withIndex(args.householdId ? "by_householdId_category_year_month" : "by_user_category_year_month", q => {
                    return q.eq(args.householdId ? "householdId" : "userId", args.householdId || identity.subject)
                                   .eq("categoryId", categoryId)
                                   .eq("year", year)
                                   .eq("month", month);
                }).first();

            if (existingBudget) {
                await ctx.db.patch(existingBudget._id, { amount: args.monthlyBudget });
            } else {
                await ctx.db.insert("budgets", {
                    userId: identity.subject,
                    householdId: args.householdId,
                    categoryId: categoryId,
                    amount: args.monthlyBudget,
                    year: year,
                    month: month,
                });
            }
        }
    }

    return categoryId;
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    targetAmount: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    enablePacing: v.optional(v.boolean()),
    goalType: v.optional(v.union(v.literal("investment"), v.literal("bill"), v.literal("purchase"))),
    monthlyBudget: v.optional(v.string()),
    hideAmount: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { id, goalType, monthlyBudget, hideAmount, ...rest } = args;
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");

    if (category.householdId) {
        await ensureHouseholdAccess(ctx, category.householdId, identity.subject);
    } else {
        if (category.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.patch(id, { ...rest, goalType, hideAmount: hideAmount ?? undefined });

    if (monthlyBudget !== undefined) {
        let startDay = 1;
        let timezone: string | null = null;
        if (category.householdId) {
            const household = await ctx.db.get(category.householdId);
            startDay = household?.budgetStartDay || 1;
            timezone = household?.timezone ?? null;
        } else {
            const member = await ctx.db.query("householdMembers").withIndex("by_userId", q => q.eq("userId", identity.subject)).first();
            if (member) {
                const household = await ctx.db.get(member.householdId);
                startDay = household?.budgetStartDay || 1;
                timezone = household?.timezone ?? null;
            }
        }

        const now = getServerNow(timezone);
        const { year, month } = getFiscalDateDetails(now.toISOString(), startDay);

        let existingBudget;
        if (category.householdId) {
            existingBudget = await ctx.db.query("budgets")
                .withIndex("by_householdId_category_year_month", q => 
                    q.eq("householdId", category.householdId!)
                     .eq("categoryId", id)
                     .eq("year", year)
                     .eq("month", month)
                ).first();
        } else {
            existingBudget = await ctx.db.query("budgets")
                .withIndex("by_user_category_year_month", q => 
                    q.eq("userId", identity.subject)
                     .eq("categoryId", id)
                     .eq("year", year)
                     .eq("month", month)
                ).first();
        }

        if (existingBudget) {
            await ctx.db.patch(existingBudget._id, { amount: monthlyBudget });
        } else if (monthlyBudget) {
            await ctx.db.insert("budgets", {
                userId: identity.subject,
                householdId: category.householdId,
                categoryId: id,
                amount: monthlyBudget,
                year,
                month,
            });
        }
    }

    if (args.name) {
        const linkedAccount = await ctx.db
            .query("accounts")
            .withIndex("by_userId", q => q.eq("userId", identity.subject))
            .filter(q => q.eq(q.field("linkedCategoryId"), id))
            .first();
        
        if (linkedAccount) {
            await ctx.db.patch(linkedAccount._id, { name: args.name });
        }
    }

    return await ctx.db.get(id);
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Category not found");

    if (category.householdId) {
        await ensureHouseholdAccess(ctx, category.householdId, identity.subject);
    } else {
        if (category.userId !== identity.subject) throw new Error("Unauthorized");
    }

    const transactions = await ctx.db.query("transactions")
        .withIndex("by_userId", q => q.eq("userId", identity.subject)) 
        .collect();
    
    const hasTransactions = transactions.some(t => 
        t.categoryId === args.id || 
        (t.isSplit && t.splits?.some(s => s.categoryId === args.id))
    );

    if (hasTransactions) {
        throw new Error("Cannot delete category with transaction history. Please use Archive instead to keep your data safe.");
    }

    const budgets = await ctx.db.query("budgets")
        .withIndex("by_user_category_year_month", q => q.eq("userId", identity.subject).eq("categoryId", args.id))
        .collect();
    
    for (const budget of budgets) {
        await ctx.db.delete(budget._id);
    }

    await ctx.db.delete(args.id);

    const linkedAccount = await ctx.db
        .query("accounts")
        .withIndex("by_userId", q => q.eq("userId", identity.subject))
        .filter(q => q.eq(q.field("linkedCategoryId"), args.id))
        .first();
    
    if (linkedAccount) {
        await ctx.db.delete(linkedAccount._id);
    }

    const automation = await ctx.db
        .query("scheduledTransactions")
        .withIndex("by_linkedEntityId", q => q.eq("linkedEntityId", args.id))
        .first();
    
    if (automation) {
        await ctx.db.delete(automation._id);
    }
  },
});

export const archiveCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Category not found");

    if (category.householdId) {
        await ensureHouseholdAccess(ctx, category.householdId, identity.subject);
    } else {
        if (category.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.id, { isArchived: true, status: GOAL_STATUS.ARCHIVED });

    const automation = await ctx.db
        .query("scheduledTransactions")
        .withIndex("by_linkedEntityId", q => q.eq("linkedEntityId", args.id))
        .first();
    
    if (automation) {
        await ctx.db.patch(automation._id, { isEnabled: false });
    }
  },
});

export const unarchiveCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Category not found");

    if (category.householdId) {
        await ensureHouseholdAccess(ctx, category.householdId, identity.subject);
    } else {
        if (category.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.id, { isArchived: false, status: GOAL_STATUS.ACTIVE });
  },
});

export const markAsAchieved = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Category not found");

    if (category.householdId) {
        await ensureHouseholdAccess(ctx, category.householdId, identity.subject);
    } else {
        if (category.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.id, { status: GOAL_STATUS.ACHIEVED });
  },
});

export const resetGoal = mutation({
  args: { 
    id: v.id("categories"),
    newTargetDate: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Category not found");

    if (category.householdId) {
        await ensureHouseholdAccess(ctx, category.householdId, identity.subject);
    } else {
        if (category.userId !== identity.subject) throw new Error("Unauthorized");
    }

    if (category.goalType !== GOAL_TYPES.BILL) {
        throw new Error("Only Sinking Funds (Bill) can be reset.");
    }

    let transactions;
    if (category.householdId) {
        transactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", category.householdId)).collect();
    } else {
        transactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }
    
    const resetTime = category.lastResetDate ? new Date(category.lastResetDate).getTime() : 0;
    const relevantTx = transactions.filter(t => new Date(t.date).getTime() > resetTime);
    
    const accounts = await ctx.db.query("accounts").collect(); 
    const userAccounts = accounts.filter(a => 
        (category.householdId && a.householdId === category.householdId) || 
        (!category.householdId && a.userId === identity.subject)
    );
    const accountsMap: AccountMap = new Map(userAccounts.map(a => [String(a._id), a]));

    let categories;
    if (category.householdId) {
        categories = await ctx.db.query("categories").withIndex("by_householdId", q => q.eq("householdId", category.householdId!)).collect();
    } else {
        categories = await ctx.db.query("categories").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }
    const categoriesMap = new Map(categories.map(c => [String(c._id), c]));

    const spendingMap = calculateSpendingByCategory(relevantTx, accountsMap, categoriesMap);
    const finalAmount = spendingMap[String(category._id)] || 0;

    const goalTimezone = category.householdId
        ? (await ctx.db.get(category.householdId))?.timezone ?? null
        : null;
    const goalNow = getServerNow(goalTimezone);
    const goalNowStr = goalNow.toISOString();

    await ctx.db.insert("goalHistory", {
        userId: identity.subject,
        householdId: category.householdId,
        categoryId: category._id,
        completedDate: goalNowStr,
        finalAmount,
        targetAmount: parseFloat(category.targetAmount?.replace(/,/g, '') || '0'),
    });

    await ctx.db.patch(args.id, { 
        status: GOAL_STATUS.ACTIVE,
        targetDate: args.newTargetDate,
        lastResetDate: goalNowStr
    });
  },
});

export const fixStuckCycleTemp = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const cat = await ctx.db.get(args.categoryId);
    const catTz = cat?.householdId
        ? (await ctx.db.get(cat.householdId))?.timezone ?? null
        : null;
    const catNow = getServerNow(catTz);
    await ctx.db.patch(args.categoryId, {
        lastResetDate: catNow.toISOString(),
        goalType: GOAL_TYPES.BILL,
        status: GOAL_STATUS.ACTIVE
    });
    return "Done";
  },
});

export const resetNegativeGoalBalances = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const accounts = await ctx.db.query("accounts")
      .withIndex("by_userId", q => q.eq("userId", identity.subject))
      .collect();

    const negativeGoalAccounts = accounts.filter(a =>
      a.type === ACCOUNT_TYPES.SAVING &&
      a.linkedCategoryId &&
      parseFloat(a.balance.replace(/,/g, '')) < 0
    );

    for (const acc of negativeGoalAccounts) {
      await ctx.db.patch(acc._id, { balance: "0" });
    }

    return {
      fixed: negativeGoalAccounts.length,
      accounts: negativeGoalAccounts.map(a => ({
        name: a.name,
        previousBalance: a.balance,
        newBalance: "0",
      })),
    };
  },
});

export const updateAllowanceConfig = mutation({
  args: {
    categoryId: v.id("categories"),
    allowanceType: v.union(v.literal("budget_period"), v.literal("weekly")),
    weeklyResetDay: v.optional(v.number()),
  },
  handler: async (ctx, { categoryId, allowanceType, weeklyResetDay }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const category = await ctx.db.get(categoryId);
    if (!category) throw new Error("Category not found");

    // Auth check
    if (category.householdId) {
      const member = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", (q) =>
          q.eq("householdId", category.householdId!).eq("userId", userId)
        )
        .first();
      if (!member) throw new Error("Unauthorized");
    } else {
      if (category.userId !== userId) throw new Error("Unauthorized");
    }

    // Only patch allowance config — never touches budget amounts or spending
    await ctx.db.patch(categoryId, {
      allowanceType,
      weeklyResetDay: allowanceType === "weekly" ? (weeklyResetDay ?? 1) : undefined,
    });
  },
});
