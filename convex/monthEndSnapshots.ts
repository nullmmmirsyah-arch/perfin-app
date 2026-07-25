import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { ensureHouseholdAccess } from "./lib/auth";
import { recomputeUserCache } from "./lib/recomputeCache";

type SnapshotArgs = {
  householdId?: Id<"households">;
  month: number;
  year: number;
  sweptBudgets: { budgetId: Id<"budgets">; previousSweptAmount: string }[];
  rolledOverBudgets: { budgetId: Id<"budgets">; previousCarryoverAmount: string }[];
  insertedBudgets: Id<"budgets">[];
};

export async function saveSnapshotInternal(
  ctx: MutationCtx,
  userId: string,
  args: SnapshotArgs
) {
  const existing = args.householdId
    ? await ctx.db
        .query("monthEndSnapshots")
        .withIndex("by_householdId_year_month", (q) =>
          q.eq("householdId", args.householdId!).eq("year", args.year).eq("month", args.month)
        )
        .first()
    : await ctx.db
        .query("monthEndSnapshots")
        .withIndex("by_userId_year_month", (q) =>
          q.eq("userId", userId).eq("year", args.year).eq("month", args.month)
        )
        .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      sweptBudgets: args.sweptBudgets,
      rolledOverBudgets: args.rolledOverBudgets,
      insertedBudgets: args.insertedBudgets,
      createdAt: Date.now(),
    });
    return existing._id;
  }

  return await ctx.db.insert("monthEndSnapshots", {
    userId,
    householdId: args.householdId,
    month: args.month,
    year: args.year,
    sweptBudgets: args.sweptBudgets,
    rolledOverBudgets: args.rolledOverBudgets,
    insertedBudgets: args.insertedBudgets,
    createdAt: Date.now(),
  });
}

export const getLatest = query({
  args: {
    householdId: v.optional(v.id("households")),
  },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    let snapshot;
    if (householdId) {
      await ensureHouseholdAccess(ctx, householdId, userId);
      snapshot = await ctx.db
        .query("monthEndSnapshots")
        .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
        .order("desc")
        .first();
    } else {
      snapshot = await ctx.db
        .query("monthEndSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .order("desc")
        .first();
    }
    return snapshot;
  },
});

export const save = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    month: v.number(),
    year: v.number(),
    sweptBudgets: v.array(v.object({
      budgetId: v.id("budgets"),
      previousSweptAmount: v.string(),
    })),
    rolledOverBudgets: v.array(v.object({
      budgetId: v.id("budgets"),
      previousCarryoverAmount: v.string(),
    })),
    insertedBudgets: v.array(v.id("budgets")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    if (args.householdId) {
      await ensureHouseholdAccess(ctx, args.householdId, userId);
    }

    return await saveSnapshotInternal(ctx, userId, args);
  },
});

export const rollback = mutation({
  args: {
    householdId: v.optional(v.id("households")),
  },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    if (householdId) {
      await ensureHouseholdAccess(ctx, householdId, userId);
    }

    // Find latest snapshot
    const snapshot = householdId
      ? await ctx.db
          .query("monthEndSnapshots")
          .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
          .order("desc")
          .first()
      : await ctx.db
          .query("monthEndSnapshots")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .order("desc")
          .first();

    if (!snapshot) {
      throw new Error("No snapshot found for rollback");
    }

    // Restore swept budgets
    for (const { budgetId, previousSweptAmount } of snapshot.sweptBudgets) {
      await ctx.db.patch(budgetId, { sweptAmount: previousSweptAmount });
    }

    // Restore rolled over budgets
    for (const { budgetId, previousCarryoverAmount } of snapshot.rolledOverBudgets) {
      await ctx.db.patch(budgetId, { carryoverAmount: previousCarryoverAmount });
    }

    // Delete inserted budgets
    for (const budgetId of snapshot.insertedBudgets) {
      await ctx.db.delete(budgetId);
    }

    // Delete snapshot
    await ctx.db.delete(snapshot._id);

    // Recompute cache
    await recomputeUserCache(ctx, userId, householdId);

    return { rolledBack: true };
  },
});
