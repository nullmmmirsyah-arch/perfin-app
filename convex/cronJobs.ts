import { internalMutation } from "./_generated/server";
import { recomputeUserCache } from "./lib/recomputeCache";

export const recomputeAllCaches = internalMutation({
  handler: async (ctx) => {
    const allCaches = await ctx.db.query("userCaches").collect();
    for (const cache of allCaches) {
      await recomputeUserCache(ctx, cache.userId, cache.householdId);
    }
  },
});
