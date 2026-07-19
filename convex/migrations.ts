import { internalMutation, mutation } from "./_generated/server";
import { generateSearchTags } from "./lib/transactions";
import { recomputeUserCache } from "./lib/recomputeCache";

/**
 * Backfill Search Tags
 * 
 * Populates 'searchCategoryIds' and 'searchLabelIds' on all transactions.
 * Idempotent — safe to re-run.
 */
export const backfillSearchTags = mutation({
  args: {},
  handler: async (ctx) => {
    const transactions = await ctx.db.query("transactions").collect();
    
    let updatedCount = 0;
    let skippedCount = 0;

    for (const tx of transactions) {
      if (tx.searchCategoryIds !== undefined && tx.searchLabelIds !== undefined) {
        skippedCount++;
        continue;
      }

      const { searchCategoryIds, searchLabelIds } = generateSearchTags({
        categoryId: tx.categoryId,
        labelIds: tx.labelIds,
        isSplit: tx.isSplit,
        splits: tx.splits,
      });

      await ctx.db.patch(tx._id, { searchCategoryIds, searchLabelIds });
      updatedCount++;
    }

    return {
      total: transactions.length,
      updated: updatedCount,
      skipped: skippedCount,
    };
  },
});

/**
 * Seed all user caches.
 * Recomputes cache for every unique userId+householdId pair.
 */
export const seedAllCaches = internalMutation({
  handler: async (ctx) => {
    const allAccounts = await ctx.db.query("accounts").collect();
    const seen = new Set<string>();

    for (const account of allAccounts) {
      const key = `${account.userId}:${account.householdId ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await recomputeUserCache(
        ctx,
        account.userId,
        account.householdId ?? undefined
      );
    }
  },
});
