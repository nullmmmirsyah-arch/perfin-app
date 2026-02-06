import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { checkHouseholdAccess, ensureHouseholdAccess } from "./lib/auth";
import { CATEGORY_TYPES, GOAL_TYPES, GOAL_STATUS, ACCOUNT_TYPES } from "./lib/constants";
import { getFiscalDateDetails, getFiscalMonthRange } from "./lib/finance";
import { calculateSpendingByCategory, AccountMap } from "./lib/finance";

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

    if (householdId) {
        transactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        transactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
        accounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }

    const accountsMap: AccountMap = new Map(accounts.map(a => [String(a._id), a]));
    // const spendingMap = calculateSpendingByCategory(transactions, accountsMap); // Unused variable removed
    
    // Find the linked account ID for this goal (Critical for Deposit/Withdraw features)
    const linkedAccount = accounts.find(a => a.linkedCategoryId === id);
    const linkedAccountId = linkedAccount?._id;
    
    // For Goal Details, we prefer the Linked Account Balance as the single source of truth.
    // This solves the "Rollover" issue for Sinking Funds: even if we reset the cycle date,
    // the money already in the account is still there and counts towards the goal.
    
    let currentAmount = 0;
    
    if (linkedAccount) {
        // PURE BALANCE STRATEGY
        // If there is a dedicated account, its balance is the absolute truth.
        currentAmount = parseFloat(linkedAccount.balance.replace(/,/g, '') || '0');
    } else {
        // FALLBACK: VIRTUAL CALCULATION
        // If no dedicated account, calculate based on transaction tagging history.
        // Here we must respect the reset date to avoid counting old cycles.
        if (category.type === CATEGORY_TYPES.SAVING && category.lastResetDate) {
            const resetTime = new Date(category.lastResetDate).getTime();
            
            // Filter transactions AFTER reset date
            const currentCycleTransactions = transactions.filter(t => new Date(t.date).getTime() > resetTime);
            const cycleSpending = calculateSpendingByCategory(currentCycleTransactions, accountsMap);
            currentAmount = cycleSpending[id] || 0;
        } else {
            // Fallback to standard calculation
            const spendingMap = calculateSpendingByCategory(transactions, accountsMap);
            currentAmount = spendingMap[id] || 0;
        }
    }

    // Fetch History (Past Cycles)
    const pastCycles = await ctx.db
        .query("goalHistory")
        .withIndex("by_categoryId", q => q.eq("categoryId", id))
        .order("desc")
        .collect();
    
    // Fetch Current Month Budget (for UI "Met" status)
    const now = new Date();
    let currentBudget;
    if (householdId) {
        currentBudget = await ctx.db.query("budgets")
            .withIndex("by_householdId_category_year_month", q => 
                q.eq("householdId", householdId)
                 .eq("categoryId", id)
                 .eq("year", now.getFullYear())
                 .eq("month", now.getMonth())
            ).first();
    } else {
        currentBudget = await ctx.db.query("budgets")
            .withIndex("by_user_category_year_month", q => 
                q.eq("userId", identity.subject)
                 .eq("categoryId", id)
                 .eq("year", now.getFullYear())
                 .eq("month", now.getMonth())
            ).first();
    }

    // Filter for transaction history list (Last 10)
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

    // Calculate This Month Contribution (Net Flow)
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    
    const thisMonthContribution = transactions
        .filter(t => new Date(t.date).getTime() >= startOfThisMonth)
        .reduce((acc, t) => {
            const amt = parseFloat(t.amount.replace(/,/g, '') || '0');
            
            // Check Direction if linkedAccount is known
            if (linkedAccountId) {
                if (t.toAccountId === linkedAccountId) {
                    return acc + amt; // Deposit
                }
                if (t.accountId === linkedAccountId) {
                    // Withdraw / Reversal
                    if (t.isGoalDisbursement) return acc; // Netral
                    return acc - amt; // Negative Contribution
                }
            }

            // Fallback (Only if we can't identify direction via Account ID)
            if (t.categoryId === id) return acc + amt;
            if (t.isSplit && t.splits?.some(s => s.categoryId === id)) {
                 const s = t.splits.find(s => s.categoryId === id);
                 return acc + (s ? parseFloat(s.amount.replace(/,/g, '') || '0') : 0);
            }
            
            return acc;
        }, 0);

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

    // 1. Fetch Context (Transactions & Budgets & Accounts)
    // We need data for the last 12 months for trends.
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Calculate start date (12 months ago)
    const startDate = new Date(currentYear, currentMonth - 11, 1);

    let allTransactions;
    let allBudgets;
    let accounts;

    if (householdId) {
        allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        allBudgets = await ctx.db.query("budgets").withIndex("by_householdId_year_month", q => q.eq("householdId", householdId)).collect();
        accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        allTransactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
        allBudgets = await ctx.db.query("budgets").withIndex("by_userId_year_month", q => q.eq("userId", identity.subject)).collect();
        accounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }

    const accountsMap: AccountMap = new Map(accounts.map(a => [String(a._id), a]));

    // 2. Build Historical Data (Last 12 Months)
    const historyData = [];
    
    // Get Budget Start Day FIRST
    let startDay = 1;
    
    // 1. Priority: Category's own household (The authoritative source)
    if (category.householdId) {
        const h = await ctx.db.get(category.householdId);
        if (h?.budgetStartDay) startDay = h.budgetStartDay;
    } 
    // 2. Priority: Context household (If viewing in household context)
    else if (householdId) {
        const h = await ctx.db.get(householdId);
        if (h?.budgetStartDay) startDay = h.budgetStartDay;
    }
    // 3. Priority: Fallback for Personal Categories - Find ANY household with a config
    else {
        const members = await ctx.db.query("householdMembers").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
        const households = await Promise.all(members.map(m => ctx.db.get(m.householdId)));
        
        // Find first one with a custom start day
        const configuredHousehold = households.find(h => h && h.budgetStartDay && h.budgetStartDay > 1);
        if (configuredHousehold) {
            startDay = configuredHousehold.budgetStartDay!;
        }
    }
    
    // We iterate backwards from current FISCAL month
    for (let i = 11; i >= 0; i--) {
        let m = currentMonth - i;
        let y = currentYear;
        while (m < 0) { m += 12; y--; }
        
        // Find Budget - Ensure strict ID comparison
        const budget = allBudgets.find(b => String(b.categoryId) === String(id) && b.year === y && b.month === m);
        
        // Calculate Spending using Fiscal Logic
        const { start, end } = getFiscalMonthRange(y, m, startDay);
        
        const monthTx = allTransactions.filter(t => {
            const d = new Date(t.date);
            return d >= new Date(start) && d <= new Date(end);
        });
        
        const spendingMap = calculateSpendingByCategory(monthTx, accountsMap);
        const spent = spendingMap[String(id)] || 0;

        // Label Formatter: "Dec" or "Dec - Jan" depending on startDay
        const labelDate = new Date(y, m, startDay);
        // If mid-month start, maybe show 'Dec-Jan' or just 'Dec' (fiscal name)
        // Standard in app seems to be just the Month Name of the start date
        const label = labelDate.toLocaleDateString('en-US', { month: 'short' });

        historyData.push({
            year: y,
            month: m,
            label,
            budgetAmount: budget ? parseFloat(budget.amount.replace(/,/g, '') || '0') : 0,
            sweptAmount: budget?.sweptAmount ? parseFloat(budget.sweptAmount.replace(/,/g, '') || '0') : 0,
            carryoverAmount: budget?.carryoverAmount ? parseFloat(budget.carryoverAmount.replace(/,/g, '') || '0') : 0,
            spent,
        });
    }

    // 3. Recent Transactions
    let filteredTransactions = allTransactions
        .filter(t => {
            const isMain = t.categoryId === id;
            const isSplit = t.isSplit && t.splits?.some(s => s.categoryId === id);
            return isMain || isSplit;
        });

    if (dateRange?.start) {
        filteredTransactions = filteredTransactions.filter(t => t.date >= dateRange.start!);
    }
    if (dateRange?.end) {
        filteredTransactions = filteredTransactions.filter(t => t.date <= dateRange.end!);
    }

    if (accountIds && accountIds.length > 0) {
        filteredTransactions = filteredTransactions.filter(t => 
            accountIds.includes(String(t.accountId)) || 
            (t.toAccountId && accountIds.includes(String(t.toAccountId)))
        );
    }

    const sortedTransactions = filteredTransactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 50);

    // Batch Fetch Related Entities for Recent Transactions (MATCH DASHBOARD LOGIC)
    const txAccountIds = new Set<Id<"accounts">>();
    const txCategoryIds = new Set<Id<"categories">>();
    const txLabelIds = new Set<Id<"labels">>();

    sortedTransactions.forEach(t => {
        txAccountIds.add(t.accountId);
        if (t.toAccountId) txAccountIds.add(t.toAccountId);
        if (t.categoryId) txCategoryIds.add(t.categoryId);
        if (t.labelId) txLabelIds.add(t.labelId);

        t.splits?.forEach(s => {
            txCategoryIds.add(s.categoryId);
            if (s.labelId) txLabelIds.add(s.labelId);
        });
    });

    const [txAccounts, txCategories, txLabels] = await Promise.all([
        Promise.all(Array.from(txAccountIds).map(id => ctx.db.get(id))),
        Promise.all(Array.from(txCategoryIds).map(id => ctx.db.get(id))),
        Promise.all(Array.from(txLabelIds).map(id => ctx.db.get(id))),
    ]);

    const txAccountMap = new Map(txAccounts.filter(Boolean).map(a => [a!._id, a!]));
    const txCategoryMap = new Map(txCategories.filter(Boolean).map(c => [c!._id, c!]));
    const txLabelMap = new Map(txLabels.filter(Boolean).map(l => [l!._id, l!]));

    const recentTransactions = sortedTransactions.map((t) => {
            const fromAccount = txAccountMap.get(t.accountId);
            const toAccount = t.toAccountId ? txAccountMap.get(t.toAccountId) : null;
            const category = t.categoryId ? txCategoryMap.get(t.categoryId) : null;
            const label = t.labelId ? txLabelMap.get(t.labelId) : null;

            let displayAmount = t.amount;
            let displayDescription = t.description;

            // Contextual handling for Split Transactions
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
                    const splitLabel = split.labelId ? txLabelMap.get(split.labelId) : null;
                    return {
                        ...split,
                        categoryName: splitCategory?.name,
                        labelName: splitLabel?.name,
                        labelColor: splitLabel?.color,
                    };
                });

            return {
                ...t,
                amount: displayAmount,
                description: displayDescription,
                fromAccountName: fromAccount?.name,
                toAccountName: toAccount?.name,
                categoryName: category?.name,
                label,
                splits: splitsWithDetails,
            };
    });

    return {
        category,
        historyData,
        recentTransactions
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

    // If fetching savings, calculate current balance for each (CONSIDERING CYCLES)
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
        const accountsMap: AccountMap = new Map(accounts.map(a => [String(a._id), a]));
        
        // --- BATCH FETCH BUDGETS ---
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const startOfThisMonth = new Date(year, month, 1).getTime();

        // Optimized: Fetch all budgets for the current month for this user/household
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

        const baseSpendingMap = calculateSpendingByCategory(transactions, accountsMap);

        return filtered.map(c => {
            let amount = 0;
            
            // 1. Try to find linked account balance (Single Source of Truth)
            const cLinkedAccount = accounts.find(a => a.linkedCategoryId === c._id);
            const cLinkedAccountId = cLinkedAccount?._id;

            if (cLinkedAccount) {
                 amount = parseFloat(cLinkedAccount.balance.replace(/,/g, '') || '0');
            } else {
                // 2. Fallback: Calculation based on transactions
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
                    const cycleMap = calculateSpendingByCategory(relevantTx, accountsMap);
                    amount = cycleMap[c._id] || 0;
                }
            }

            // Calculate This Month Contribution for THIS specific goal
            // (cLinkedAccount and cLinkedAccountId are already defined above)

            const thisMonthContribution = transactions
                .filter(t => new Date(t.date).getTime() >= startOfThisMonth)
                .reduce((acc, t) => {
                    const amt = parseFloat(t.amount.replace(/,/g, '') || '0');
                    
                    if (cLinkedAccountId) {
                        if (t.toAccountId === cLinkedAccountId) return acc + amt;
                        if (t.accountId === cLinkedAccountId) {
                            if (t.isGoalDisbursement) return acc;
                            return acc - amt;
                        }
                    }

                    if (t.categoryId === c._id) return acc + amt;
                    if (t.isSplit && t.splits) {
                        const s = t.splits.find(s => s.categoryId === c._id);
                        if (s) return acc + parseFloat(s.amount.replace(/,/g, '') || '0');
                    }
                    return acc;
                }, 0);

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
    goalType: v.optional(v.string()),
    monthlyBudget: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (args.householdId) {
        await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
    }

    const { monthlyBudget, ...rest } = args;

    const categoryId = await ctx.db.insert("categories", {
      ...rest,
      userId: identity.subject,
      status: GOAL_STATUS.ACTIVE,
      goalType: args.goalType as any,
    });

    // AUTO-CREATE ACCOUNT for Saving type
    if (args.type === CATEGORY_TYPES.SAVING) {
        await ctx.db.insert("accounts", {
            userId: identity.subject,
            householdId: args.householdId,
            name: args.name,
            balance: "0",
            type: ACCOUNT_TYPES.SAVING,
            linkedCategoryId: categoryId
        });

        // AUTO-CREATE BUDGET if monthlyBudget provided
        if (args.monthlyBudget) {
            // Get Budget Start Day
            let startDay = 1;
            if (args.householdId) {
                const household = await ctx.db.get(args.householdId);
                startDay = household?.budgetStartDay || 1;
            } else {
                // For personal, get default household
                const member = await ctx.db.query("householdMembers").withIndex("by_userId", q => q.eq("userId", identity.subject)).first();
                if (member) {
                    const household = await ctx.db.get(member.householdId);
                    startDay = household?.budgetStartDay || 1;
                }
            }

            const now = new Date();
            const { year, month } = getFiscalDateDetails(now.toISOString(), startDay);

            // Check existing budget first (Paranoid Check)
            const existingBudget = await ctx.db.query("budgets")
                .withIndex(args.householdId ? "by_householdId_category_year_month" : "by_user_category_year_month", q => {
                    let builder = q.eq(args.householdId ? "householdId" : "userId", args.householdId || identity.subject)
                                   .eq("categoryId", categoryId)
                                   .eq("year", year)
                                   .eq("month", month);
                    return builder;
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
    goalType: v.optional(v.string()),
    monthlyBudget: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { id, goalType, monthlyBudget, ...rest } = args;
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");

    if (category.householdId) {
        await ensureHouseholdAccess(ctx, category.householdId, identity.subject);
    } else {
        if (category.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.patch(id, { ...rest, goalType: goalType as any });

    // Handle Budget Update
    if (monthlyBudget !== undefined) {
        // Fetch household for Fiscal Logic
        let startDay = 1;
        if (category.householdId) {
            const household = await ctx.db.get(category.householdId);
            startDay = household?.budgetStartDay || 1;
        } else {
            const member = await ctx.db.query("householdMembers").withIndex("by_userId", q => q.eq("userId", identity.subject)).first();
            if (member) {
                const household = await ctx.db.get(member.householdId);
                startDay = household?.budgetStartDay || 1;
            }
        }

        const now = new Date();
        const { year, month } = getFiscalDateDetails(now.toISOString(), startDay);

        console.log(`[DEBUG] Category ID: ${category._id}, HouseholdId: ${category.householdId}`);
        if (category.householdId) {
             const h = await ctx.db.get(category.householdId);
             console.log(`[DEBUG] Household Found: ${h?.name}, BudgetStartDay: ${h?.budgetStartDay}`);
        } else {
             console.log(`[DEBUG] No HouseholdId on Category. Fallback to Personal.`);
        }
        
        console.log(`[DEBUG] Update Category Budget: StartDay=${startDay}, Now=${now.toISOString()}, Result=${year}-${month}`);

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

    // Sync Name to linked Account if category name changed
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

    // 1. Check for Transactions
    const transactions = await ctx.db.query("transactions")
        .withIndex("by_userId", q => q.eq("userId", identity.subject)) // Global check
        .collect();
    
    const hasTransactions = transactions.some(t => 
        t.categoryId === args.id || 
        (t.isSplit && t.splits?.some(s => s.categoryId === args.id))
    );

    if (hasTransactions) {
        throw new Error("Cannot delete category with transaction history. Please use Archive instead to keep your data safe.");
    }

    // 2. Check for Budgets (Auto-Cleanup)
    const budgets = await ctx.db.query("budgets")
        .withIndex("by_user_category_year_month", q => q.eq("userId", identity.subject).eq("categoryId", args.id))
        .collect();
    
    // Instead of blocking, we delete the budgets to release funds to Unassigned Cash
    for (const budget of budgets) {
        await ctx.db.delete(budget._id);
    }

    // 4. Finally, delete the category
    await ctx.db.delete(args.id);

    // 5. Delete paired account if exists
    const linkedAccount = await ctx.db
        .query("accounts")
        .withIndex("by_userId", q => q.eq("userId", identity.subject))
        .filter(q => q.eq(q.field("linkedCategoryId"), args.id))
        .first();
    
    if (linkedAccount) {
        await ctx.db.delete(linkedAccount._id);
    }

    // 6. Delete linked automation schedule if exists
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

    // Also disable any automation linked to this goal
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

    // Only allow reset for Sinking Funds (BILL)
    if (category.goalType !== GOAL_TYPES.BILL) {
        throw new Error("Only Sinking Funds (Bill) can be reset.");
    }

    // 1. Calculate Final Amount for History
    // We need to fetch transactions to know how much was collected in this cycle
    // Note: This might be heavy if history is long, but it's a rare action.
    let transactions;
    if (category.householdId) {
        transactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", category.householdId)).collect();
    } else {
        transactions = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }
    
    // Filter by previous reset date
    const resetTime = category.lastResetDate ? new Date(category.lastResetDate).getTime() : 0;
    const relevantTx = transactions.filter(t => new Date(t.date).getTime() > resetTime);
    
    // Get Accounts to pass to helper
    // (A bit redundant to fetch all accounts again but safer for accurate helper logic)
    const accounts = await ctx.db.query("accounts").collect(); 
    // Optimization: we could filter accounts by user, but helper needs all involved in txs.
    // Let's filter by user/household for safety.
    const userAccounts = accounts.filter(a => 
        (category.householdId && a.householdId === category.householdId) || 
        (!category.householdId && a.userId === identity.subject)
    );
    const accountsMap: AccountMap = new Map(userAccounts.map(a => [String(a._id), a]));

    const spendingMap = calculateSpendingByCategory(relevantTx, accountsMap);
    const finalAmount = spendingMap[category._id] || 0;

    // 2. Save to History
    await ctx.db.insert("goalHistory", {
        userId: identity.subject,
        householdId: category.householdId,
        categoryId: category._id,
        completedDate: new Date().toISOString(),
        finalAmount,
        targetAmount: parseFloat(category.targetAmount?.replace(/,/g, '') || '0'),
    });

    // 3. Reset Cycle
    await ctx.db.patch(args.id, { 
        status: GOAL_STATUS.ACTIVE,
        targetDate: args.newTargetDate,
        lastResetDate: new Date().toISOString() 
    });
  },
});

export const fixStuckCycleTemp = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.categoryId, {
        lastResetDate: new Date().toISOString(),
        goalType: GOAL_TYPES.BILL,
        status: GOAL_STATUS.ACTIVE
    });
    return "Done";
  },
});