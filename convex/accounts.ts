import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function ensureHouseholdAccess(ctx: any, householdId: Id<"households">, userId: string) {
    const member = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", (q: any) =>
            q.eq("householdId", householdId).eq("userId", userId)
        )
        .first();
    return !!member;
}

export const get = query({
  args: { householdId: v.optional(v.id("households")) },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) return [];
        return await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        return await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (args.householdId) {
        if (!await ensureHouseholdAccess(ctx, args.householdId, identity.subject)) throw new Error("Unauthorized");
    }

    const account = await ctx.db.insert("accounts", {
      ...args,
      userId: identity.subject,
    });
    return account;
  },
});

export const update = mutation({
  args: {
    id: v.id("accounts"),
    name: v.optional(v.string()),
    balance: v.optional(v.string()),
    type: v.optional(v.string()),
    initialQuantity: v.optional(v.string()),
    unit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { id, ...rest } = args;
    const account = await ctx.db.get(id);
    if (!account) throw new Error("Account not found");

    if (account.householdId) {
        if (!await ensureHouseholdAccess(ctx, account.householdId, identity.subject)) throw new Error("Unauthorized");
    } else {
        if (account.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.patch(id, rest);
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
        if (!await ensureHouseholdAccess(ctx, account.householdId, identity.subject)) throw new Error("Unauthorized");
    } else {
        if (account.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});