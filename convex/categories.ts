import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkHouseholdAccess, ensureHouseholdAccess } from "./lib/auth";
import { GOAL_STATUS, GOAL_TYPES, ACCOUNT_TYPES, CATEGORY_TYPES } from "./lib/constants";
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

    const accountsMap: AccountMap = new Map(accounts.map(a => [a._id, a]));
    const spendingMap = calculateSpendingByCategory(transactions, accountsMap);
    
    // For Goal Details, we need to manually filter transactions if lastResetDate exists
    // to calculate the accurate 'Current Cycle Amount', because calculateSpendingByCategory
    // aggregates everything by default.
    
    let currentAmount = 0;
    
    if (category.type === CATEGORY_TYPES.SAVING && category.lastResetDate) {
        const resetTime = new Date(category.lastResetDate).getTime();
        
        // Filter transactions AFTER reset date
        const currentCycleTransactions = transactions.filter(t => new Date(t.date).getTime() > resetTime);
        const cycleSpending = calculateSpendingByCategory(currentCycleTransactions, accountsMap);
        currentAmount = cycleSpending[id] || 0;
    } else {
        currentAmount = spendingMap[id] || 0;
    }

    // Fetch History (Past Cycles)
    const pastCycles = await ctx.db
        .query("goalHistory")
        .withIndex("by_categoryId", q => q.eq("categoryId", id))
        .order("desc")
        .collect();

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

    return {
        category,
        currentAmount,
        history,
        pastCycles
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

    let filtered = showArchived 
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
        const accountsMap: AccountMap = new Map(accounts.map(a => [a._id, a]));
        
        // We calculate global spending map first for optimization
        // BUT, we need to handle per-category reset date.
        // Optimization: 
        // 1. Calculate base map (all time)
        // 2. Iterate categories. If no reset date -> use base map.
        // 3. If reset date -> filter transactions specific to that cat and recalc.
        
        const baseSpendingMap = calculateSpendingByCategory(transactions, accountsMap);

        return filtered.map(c => {
            let amount = baseSpendingMap[c._id] || 0;
            
            if (c.lastResetDate) {
                const resetTime = new Date(c.lastResetDate).getTime();
                // Filter transactions relevant to THIS category only to save perf
                // We only care about transactions that contribute to this category
                const relevantTx = transactions.filter(t => {
                    const isAfter = new Date(t.date).getTime() > resetTime;
                    if (!isAfter) return false;
                    
                    // Is this transaction related to this category?
                    // Note: calculateSpendingByCategory handles the logic of "is related".
                    // But here we need to filter list before passing to it.
                    // Simple check:
                    if (t.categoryId === c._id) return true;
                    if (t.isSplit && t.splits?.some(s => s.categoryId === c._id)) return true;
                    return false;
                });
                
                const cycleMap = calculateSpendingByCategory(relevantTx, accountsMap);
                amount = cycleMap[c._id] || 0;
            }

            return {
                ...c,
                currentAmount: amount
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (args.householdId) {
        await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
    }

    const categoryId = await ctx.db.insert("categories", {
      ...args,
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { id, goalType, ...rest } = args;
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");

    if (category.householdId) {
        await ensureHouseholdAccess(ctx, category.householdId, identity.subject);
    } else {
        if (category.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.patch(id, { ...rest, goalType: goalType as any });

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

    // 2. Check for Budgets with allocated amount > 0
    const budgets = await ctx.db.query("budgets")
        .withIndex("by_user_category_year_month", q => q.eq("userId", identity.subject).eq("categoryId", args.id))
        .collect();
    
    const hasActiveBudgets = budgets.some(b => parseFloat(b.amount.replace(/,/g, '') || '0') > 0);

    if (hasActiveBudgets) {
        throw new Error("This category has active budget allocations. Please remove the budgets or archive the category instead.");
    }

    // 3. Cleanup: Delete any associated budget records (orphans or zero-budgets)
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
    const accountsMap: AccountMap = new Map(userAccounts.map(a => [a._id, a]));

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