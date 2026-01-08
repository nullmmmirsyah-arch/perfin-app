import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkHouseholdAccess, ensureHouseholdAccess } from "./lib/auth";
import { GOAL_STATUS } from "./lib/constants";
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
    const currentAmount = spendingMap[id] || 0;

    // Filter for history (Last 10 transactions for this goal)
    // We filter manually because we need to check splits too
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
            amount: t.amount, // Note: This might be inaccurate for splits, but OK for simple list. For precise history we need to extract split amount.
            description: t.description,
            type: t.type
        }));

    return {
        category,
        currentAmount,
        history
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

    // If fetching savings, calculate current balance for each
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
        const spendingMap = calculateSpendingByCategory(transactions, accountsMap);

        return filtered.map(c => ({
            ...c,
            currentAmount: spendingMap[c._id] || 0
        }));
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (args.householdId) {
        await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
    }

    const category = await ctx.db.insert("categories", {
      ...args,
      userId: identity.subject,
      status: GOAL_STATUS.ACTIVE,
    });
    return category;
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { id, ...rest } = args;
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");

    if (category.householdId) {
        await ensureHouseholdAccess(ctx, category.householdId, identity.subject);
    } else {
        if (category.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.patch(id, rest);
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

    await ctx.db.delete(args.id);
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