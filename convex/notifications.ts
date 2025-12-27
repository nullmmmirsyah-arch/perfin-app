import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// Mutation to save or update a subscription
export const saveSubscription = mutation({
  args: {
    endpoint: v.string(),
    expirationTime: v.optional(v.number()),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId,
        expirationTime: args.expirationTime,
        keys: args.keys,
      });
    } else {
      await ctx.db.insert("pushSubscriptions", {
        userId,
        endpoint: args.endpoint,
        expirationTime: args.expirationTime,
        keys: args.keys,
      });
    }

    // TRIGGER TESTING: Kirim notifikasi selamat datang
    await ctx.scheduler.runAfter(0, internal.push.sendNotification, {
      userId,
      title: "Perfin PWA",
      body: "Notifikasi berhasil diaktifkan! Anda akan menerima update keuangan di sini.",
    });
  },
});

// Mutation to delete a subscription
export const deleteSubscription = mutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();

    if (existing) {
      // Ensure the user owns this subscription before deleting
      if (existing.userId === identity.subject) {
        await ctx.db.delete(existing._id);
      }
    }
  },
});

// Internal query to get subscriptions for a user
export const getSubscriptions = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});