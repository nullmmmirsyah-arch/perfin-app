import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { checkHouseholdAccess, ensureHouseholdAccess } from "./lib/auth";
import { ACCOUNT_TYPES, CATEGORY_TYPES, TRANSACTION_TYPES, GOAL_STATUS } from "./lib/constants";

export const get = query({
  args: { 
    householdId: v.optional(v.id("households")),
    showArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, { householdId, showArchived }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let accounts;
    if (householdId) {
        if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) return [];
        accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        accounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }

    if (showArchived) {
      return accounts;
    }
    return accounts.filter(a => !a.isArchived);
  },
});

export const create = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    name: v.string(),
    balance: v.string(),
    type: v.optional(v.string()),
    initialQuantity: v.optional(v.string()),
    unit: v.optional(v.string()),
    targetAmount: v.optional(v.string()),
    targetDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (args.householdId) {
        await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
    }

    let linkedCategoryId: Id<"categories"> | undefined;

    // Auto-create linked category for Savings/Assets
    if (args.type === ACCOUNT_TYPES.SAVING || args.type === ACCOUNT_TYPES.ASSET) {
        linkedCategoryId = await ctx.db.insert("categories", {
            userId: identity.subject,
            householdId: args.householdId,
            name: args.name,
            type: CATEGORY_TYPES.SAVING,
            targetAmount: args.targetAmount,
            targetDate: args.targetDate,
        });
    }

    const accountId = await ctx.db.insert("accounts", {
      householdId: args.householdId,
      name: args.name,
      balance: args.balance,
      type: args.type,
      initialQuantity: args.initialQuantity,
      unit: args.unit,
      userId: identity.subject,
      linkedCategoryId,
    });

    // Create Initial Balance Transaction if balance > 0
    const initialBalance = parseFloat(args.balance.replace(/,/g, ''));
    if (initialBalance > 0 && args.type !== ACCOUNT_TYPES.ASSET) {
        // 1. Find or Create "Initial Balance" Category
        let categoryId;
        const existingCategory = await ctx.db
            .query("categories")
            .withIndex("by_userId", q => q.eq("userId", identity.subject))
            .filter(q => q.eq(q.field("name"), "Initial Balance"))
            .first();
        
        if (existingCategory) {
            categoryId = existingCategory._id;
        } else {
            categoryId = await ctx.db.insert("categories", {
                userId: identity.subject,
                householdId: args.householdId,
                name: "Initial Balance",
                type: CATEGORY_TYPES.INCOME
            });
        }

        // 2. Create Transaction
        await ctx.db.insert("transactions", {
            userId: identity.subject,
            householdId: args.householdId,
            accountId,
            categoryId,
            type: TRANSACTION_TYPES.INCOME,
            amount: args.balance,
            date: new Date().toISOString(),
            description: "Initial Balance",
        });
    }

    return accountId;
  },
});

export const update = mutation({
  args: {
    id: v.id("accounts"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    initialQuantity: v.optional(v.string()),
    unit: v.optional(v.string()),
    targetAmount: v.optional(v.string()),
    targetDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { id, targetAmount, targetDate, ...rest } = args;
    const account = await ctx.db.get(id);
    if (!account) throw new Error("Account not found");

    if (account.householdId) {
        await ensureHouseholdAccess(ctx, account.householdId, identity.subject);
    } else {
        if (account.userId !== identity.subject) throw new Error("Unauthorized");
    }

    if (args.name && account.linkedCategoryId) {
        await ctx.db.patch(account.linkedCategoryId, { 
            name: args.name,
            targetAmount: targetAmount ?? undefined, // Only update if provided
            targetDate: targetDate ?? undefined
        });
    } else if (account.linkedCategoryId && (targetAmount !== undefined || targetDate !== undefined)) {
         await ctx.db.patch(account.linkedCategoryId, { 
            targetAmount: targetAmount ?? undefined,
            targetDate: targetDate ?? undefined
        });
    }

    // If type changed to SAVING/ASSET and no category linked yet, create it
    let newLinkedCategoryId = account.linkedCategoryId;
    const newType = args.type || account.type;
    if (!newLinkedCategoryId && (newType === ACCOUNT_TYPES.SAVING || newType === ACCOUNT_TYPES.ASSET)) {
        newLinkedCategoryId = await ctx.db.insert("categories", {
            userId: identity.subject,
            householdId: account.householdId,
            name: args.name || account.name,
            type: CATEGORY_TYPES.SAVING,
            targetAmount: targetAmount,
            targetDate: targetDate,
        });
    }

    await ctx.db.patch(id, { ...rest, linkedCategoryId: newLinkedCategoryId });
  },
});

export const deleteAccount = mutation({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const account = await ctx.db.get(args.id);
    if (!account) throw new Error("Account not found");

    if (account.householdId) {
        await ensureHouseholdAccess(ctx, account.householdId, identity.subject);
    } else {
        if (account.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});

export const archiveAccount = mutation({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const account = await ctx.db.get(args.id);
    if (!account) throw new Error("Account not found");

    if (account.householdId) {
        await ensureHouseholdAccess(ctx, account.householdId, identity.subject);
    } else {
        if (account.userId !== identity.subject) throw new Error("Unauthorized");
    }

    // Check Balance
    const balance = parseFloat(account.balance.replace(/,/g, '') || '0');
    if (Math.abs(balance) > 0) {
        throw new Error("Cannot archive account with non-zero balance. Please transfer funds first.");
    }

    await ctx.db.patch(args.id, { isArchived: true });

    if (account.linkedCategoryId) {
        await ctx.db.patch(account.linkedCategoryId, { isArchived: true, status: GOAL_STATUS.ARCHIVED });
    }
  },
});
