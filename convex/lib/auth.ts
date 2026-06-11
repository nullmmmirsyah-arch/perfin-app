import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Checks if a user is a member of a household.
 * Returns true if member, false otherwise.
 * Use this for Queries where you want to return empty data if unauthorized.
 */
export async function checkHouseholdAccess(
  ctx: QueryCtx | MutationCtx, 
  householdId: Id<"households">, 
  userId: string
): Promise<boolean> {
  const member = await ctx.db
    .query("householdMembers")
    .withIndex("by_householdId_userId", (q) =>
      q.eq("householdId", householdId).eq("userId", userId)
    )
    .first();
  return !!member;
}

/**
 * Ensures a user is a member of a household.
 * Throws an Error if not authorized.
 * Use this for Mutations or Queries where access is mandatory.
 */
export async function ensureHouseholdAccess(
  ctx: QueryCtx | MutationCtx, 
  householdId: Id<"households">, 
  userId: string
): Promise<void> {
  const isMember = await checkHouseholdAccess(ctx, householdId, userId);
  if (!isMember) {
    throw new Error("Unauthorized: You are not a member of this household.");
  }
}

/**
 * Checks if a user is an admin of a household.
 */
export async function checkAdminAccess(
  ctx: QueryCtx | MutationCtx,
  householdId: Id<"households">,
  userId: string
): Promise<boolean> {
  const member = await ctx.db
    .query("householdMembers")
    .withIndex("by_householdId_userId", (q) =>
      q.eq("householdId", householdId).eq("userId", userId)
    )
    .first();
  return member?.role === "admin";
}

/**
 * Ensures a user is an admin of a household. Throws if not admin.
 */
export async function ensureAdminAccess(
  ctx: MutationCtx,
  householdId: Id<"households">,
  userId: string
): Promise<void> {
  if (!await checkAdminAccess(ctx, householdId, userId)) {
    throw new Error("Unauthorized: Admin access required.");
  }
}
