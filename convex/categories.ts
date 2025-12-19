import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: {
    type: v.optional(v.string()),
  },
  handler: async (ctx, { type }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    let query = ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject));

    if (type) {
      query = query.filter((q) => q.eq(q.field("type"), type));
    }

    return await query.collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const category = await ctx.db.insert("categories", {
      ...args,
      userId: identity.subject,
    });
    return category;
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const { id, ...rest } = args;
    const category = await ctx.db.patch(id, rest);
    return category;
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    await ctx.db.delete(args.id);
  },
});
