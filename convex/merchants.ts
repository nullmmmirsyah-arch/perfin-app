import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkHouseholdAccess, ensureHouseholdAccess, ensureAdminAccess } from "./lib/auth";

export const get = query({
  args: { householdId: v.optional(v.id("households")) },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (householdId) {
        if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) return [];
        return await ctx.db.query("merchants").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        return await ctx.db.query("merchants").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }
  },
});

export const create = mutation({
  args: {
    householdId: v.id("households"),
    name: v.string(),
    icon: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
    await ensureAdminAccess(ctx, args.householdId, identity.subject);

    // Check for duplicate name within household
    const existingMerchant = await ctx.db.query("merchants")
      .withIndex("by_householdId_name", q => 
        q.eq("householdId", args.householdId)
         .eq("name", args.name)
      )
      .first();
    
    if (existingMerchant) {
      throw new Error("A merchant with this name already exists");
    }

    const merchant = await ctx.db.insert("merchants", {
      ...args,
      userId: identity.subject,
    });
    return merchant;
  },
});

export const update = mutation({
  args: {
    id: v.id("merchants"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { id, ...rest } = args;
    const merchant = await ctx.db.get(id);
    if (!merchant) throw new Error("Merchant not found");

    await ensureHouseholdAccess(ctx, merchant.householdId, identity.subject);

    // Check for duplicate name if name is being changed
    if (rest.name && rest.name !== merchant.name) {
      const existingMerchant = await ctx.db.query("merchants")
        .withIndex("by_householdId_name", q => 
          q.eq("householdId", merchant.householdId)
           .eq("name", rest.name!)
        )
        .first();
      
      if (existingMerchant) {
        throw new Error("A merchant with this name already exists");
      }
    }

    await ctx.db.patch(id, rest);
    return await ctx.db.get(id);
  },
});

export const deleteMerchant = mutation({
  args: { id: v.id("merchants") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const merchant = await ctx.db.get(args.id);
    if (!merchant) throw new Error("Merchant not found");

    await ensureHouseholdAccess(ctx, merchant.householdId, identity.subject);
    await ensureAdminAccess(ctx, merchant.householdId, identity.subject);

    // Check if merchant is used in any transactions
    const transactionsUsingMerchant = await ctx.db.query("transactions")
      .withIndex("by_merchantId", q => q.eq("merchantId", args.id))
      .first();
    
    if (transactionsUsingMerchant) {
      throw new Error("Cannot delete merchant that is used in transactions");
    }

    await ctx.db.delete(args.id);
  },
});
