import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function generateCode(length: number = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const getOrCreateDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    // Check if user is already in a household
    const member = await ctx.db
      .query("householdMembers")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    if (member) {
       return member.householdId;
    }

    // Create default "Personal" household
    const householdId = await ctx.db.insert("households", {
      name: "Personal",
      ownerId: identity.subject,
    });

    await ctx.db.insert("householdMembers", {
      householdId,
      userId: identity.subject,
      role: "admin",
      email: identity.email,
    });

    return householdId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const members = await ctx.db
      .query("householdMembers")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    const households = await Promise.all(
      members.map(async (m) => {
        const h = await ctx.db.get(m.householdId);
        return h ? { ...h, role: m.role } : null;
      })
    );

    return households.filter((h) => h !== null);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const householdId = await ctx.db.insert("households", {
      name: args.name,
      ownerId: identity.subject,
    });

    await ctx.db.insert("householdMembers", {
      householdId,
      userId: identity.subject,
      role: "admin",
      email: identity.email,
    });

    return householdId;
  },
});

export const createInvite = mutation({
  args: {
    householdId: v.id("households"),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Check admin permission
    const member = await ctx.db
      .query("householdMembers")
      .withIndex("by_householdId_userId", q => q.eq("householdId", args.householdId).eq("userId", identity.subject))
      .first();
    
    if (!member || member.role !== 'admin') throw new Error("Unauthorized");

    const code = generateCode();
    // Expires in 7 days
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await ctx.db.insert("householdInvites", {
      householdId: args.householdId,
      email: args.email,
      code,
      expiresAt,
      createdBy: identity.subject,
      status: "pending",
    });

    return code;
  }
});

export const acceptInvite = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const invite = await ctx.db
      .query("householdInvites")
      .withIndex("by_code", q => q.eq("code", args.code))
      .first();

    if (!invite) throw new Error("Invalid code");
    if (invite.status !== "pending") throw new Error("Invite invalid");
    if (invite.expiresAt < Date.now()) throw new Error("Invite expired");

    // Check already member
    const existingMember = await ctx.db
      .query("householdMembers")
      .withIndex("by_householdId_userId", q => q.eq("householdId", invite.householdId).eq("userId", identity.subject))
      .first();

    if (existingMember) throw new Error("Already a member");

    // Add member
    await ctx.db.insert("householdMembers", {
      householdId: invite.householdId,
      userId: identity.subject,
      role: "member",
      email: identity.email,
    });

    // Update invite status
    await ctx.db.patch(invite._id, { status: "accepted" });

    return invite.householdId;
  }
});

export const getMembers = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Check membership (any member can see other members)
    const member = await ctx.db
      .query("householdMembers")
      .withIndex("by_householdId_userId", q => q.eq("householdId", args.householdId).eq("userId", identity.subject))
      .first();
    
    if (!member) throw new Error("Unauthorized");

    const members = await ctx.db
      .query("householdMembers")
      .withIndex("by_householdId", q => q.eq("householdId", args.householdId))
      .collect();

    return members;
  }
});

export const getPendingInvites = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Check admin (only admins see invites)
    const member = await ctx.db
      .query("householdMembers")
      .withIndex("by_householdId_userId", q => q.eq("householdId", args.householdId).eq("userId", identity.subject))
      .first();
    
    if (!member || member.role !== 'admin') return [];

    const invites = await ctx.db
      .query("householdInvites")
      .withIndex("by_householdId", q => q.eq("householdId", args.householdId))
      .collect();
    
    return invites.filter(i => i.status === "pending" && i.expiresAt > Date.now());
  }
});

export const removeMember = mutation({
  args: { 
      householdId: v.id("households"),
      userId: v.string()
  },
  handler: async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Unauthenticated");

      // Check admin
      const member = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", q => q.eq("householdId", args.householdId).eq("userId", identity.subject))
        .first();
      
      if (!member || member.role !== 'admin') throw new Error("Unauthorized");
      
      if (args.userId === identity.subject) throw new Error("Cannot remove self via this mutation");

      const targetMember = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", q => q.eq("householdId", args.householdId).eq("userId", args.userId))
        .first();

      if (!targetMember) throw new Error("Member not found");
      
      await ctx.db.delete(targetMember._id);
  }
})

export const rename = mutation({
  args: {
    householdId: v.id("households"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Check admin
    const member = await ctx.db
      .query("householdMembers")
      .withIndex("by_householdId_userId", q => q.eq("householdId", args.householdId).eq("userId", identity.subject))
      .first();
    
    if (!member || member.role !== 'admin') throw new Error("Unauthorized");

    await ctx.db.patch(args.householdId, { name: args.name });
  }
});