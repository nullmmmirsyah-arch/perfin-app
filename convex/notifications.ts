import { v } from "convex/values";
import { mutation, query, internalQuery, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function ensureHouseholdAccess(ctx: QueryCtx, householdId: Id<"households">, userId: string) {
    const member = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", (q) =>
            q.eq("householdId", householdId).eq("userId", userId)
        )
        .first();
    return !!member;
}

export const getSubscriptions = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const saveSubscription = mutation({
  args: {
    endpoint: v.string(),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
    expirationTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (existing) {
        await ctx.db.patch(existing._id, {
            userId: identity.subject,
            keys: args.keys,
            expirationTime: args.expirationTime,
        });
    } else {
        await ctx.db.insert("pushSubscriptions", {
            userId: identity.subject,
            ...args,
        });
    }
  },
});

export const deleteSubscription = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (existing && existing.userId === identity.subject) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const get = query({
  args: { 
    householdId: v.optional(v.id("households")),
  },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let notifications;
    if (householdId) {
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) return [];
        notifications = await ctx.db.query("notifications")
            .withIndex("by_householdId", q => q.eq("householdId", householdId))
            .order("desc")
            .take(20);
    } else {
        notifications = await ctx.db.query("notifications")
            .withIndex("by_userId", q => q.eq("userId", identity.subject))
            .order("desc")
            .take(20);
    }

    return notifications;
  },
});

export const getUnreadCount = query({
  args: { 
    householdId: v.optional(v.id("households")),
  },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let notifications;
    if (householdId) {
         // Note: optimize later if needed, but for <100 notifications this is fine
        if (!await ensureHouseholdAccess(ctx, householdId, identity.subject)) return 0;
        notifications = await ctx.db.query("notifications")
            .withIndex("by_householdId", q => q.eq("householdId", householdId))
            .filter(q => q.eq(q.field("isRead"), false))
            .collect();
    } else {
        notifications = await ctx.db.query("notifications")
            .withIndex("by_userId", q => q.eq("userId", identity.subject))
            .filter(q => q.eq(q.field("isRead"), false))
            .collect();
    }

    return notifications.length;
  },
});

export const markAsRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // We strictly should check ownership, but for now assuming ID knowledge is enough or check generic ownership
    const notif = await ctx.db.get(args.id);
    if (!notif) return;

    if (notif.householdId) {
         // Check household access
         if (!await ensureHouseholdAccess(ctx, notif.householdId, identity.subject)) throw new Error("Unauthorized");
    } else {
         if (notif.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.id, { isRead: true });
  },
});

export const markAllAsRead = mutation({
  args: { householdId: v.optional(v.id("households")) },
  handler: async (ctx, args) => {
     const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let notifications;
    if (args.householdId) {
        if (!await ensureHouseholdAccess(ctx, args.householdId, identity.subject)) throw new Error("Unauthorized");
        notifications = await ctx.db.query("notifications")
            .withIndex("by_householdId", q => q.eq("householdId", args.householdId))
            .filter(q => q.eq(q.field("isRead"), false))
            .collect();
    } else {
        notifications = await ctx.db.query("notifications")
            .withIndex("by_userId", q => q.eq("userId", identity.subject))
            .filter(q => q.eq(q.field("isRead"), false))
            .collect();
    }

    for (const n of notifications) {
        await ctx.db.patch(n._id, { isRead: true });
    }
  }
})

// Internal Mutation to be called by other functions
export const createInternal = mutation({
    args: {
        userId: v.string(),
        householdId: v.optional(v.id("households")),
        type: v.string(),
        title: v.string(),
        message: v.string(),
        data: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        // No auth check needed here as it's intended to be called internally or we trust the caller (Convex internal calls preserve context if needed, but this is a direct mutation)
        // Wait, if we call this via client, we need auth.
        // If we call this via `ctx.runMutation` from another mutation, it works.
        // Let's add auth check just in case it's exposed.
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");
        
        await ctx.db.insert("notifications", {
            ...args,
            isRead: false,
            createdAt: Date.now(),
        });
    }
});
