import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { checkHouseholdAccess, ensureHouseholdAccess } from "./lib/auth";

export const get = query({
  args: { householdId: v.optional(v.id("households")) },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (householdId) {
        if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) return [];
        return await ctx.db.query("labels").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        return await ctx.db.query("labels").withIndex("by_userId", q => q.eq("userId", identity.subject)).collect();
    }
  },
});

export const create = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    if (args.householdId) {
        await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
    }

    const label = await ctx.db.insert("labels", {
      ...args,
      userId: identity.subject,
    });
    return label;
  },
});

export const update = mutation({
  args: {
    id: v.id("labels"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const { id, ...rest } = args;
    const label = await ctx.db.get(id);
    if (!label) throw new Error("Label not found");

    if (label.householdId) {
        await ensureHouseholdAccess(ctx, label.householdId, identity.subject);
    } else {
        if (label.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.patch(id, rest);
    return await ctx.db.get(id);
  },
});

export const deleteLabel = mutation({
  args: { id: v.id("labels") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const label = await ctx.db.get(args.id);
    if (!label) throw new Error("Label not found");

    if (label.householdId) {
        await ensureHouseholdAccess(ctx, label.householdId, identity.subject);
    } else {
        if (label.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});