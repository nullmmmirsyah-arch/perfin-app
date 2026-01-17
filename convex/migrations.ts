import { mutation } from "./_generated/server";
import { generateSearchTags } from "./lib/transactions";

/**
 * Migration: Backfill Search Tags
 * 
 * This script iterates through all existing transactions and populates
 * the 'searchCategoryIds' and 'searchLabelIds' fields. 
 * This is necessary for the new optimized filtering and split-transaction search.
 * 
 * Run this ONCE from the Convex Dashboard after deploying the new schema.
 */
export const backfillSearchTags = mutation({
  args: {},
  handler: async (ctx) => {
    // Authentication check removed to allow running from Dashboard as Admin
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) throw new Error("Not authenticated");

    // 1. Fetch all transactions
    // Since the volume is ~1000 records, we can fetch all at once.
    const transactions = await ctx.db.query("transactions").collect();
    
    console.log(`Starting backfill for ${transactions.length} transactions...`);

    let updatedCount = 0;
    let skippedCount = 0;

    // 2. Process each transaction
    for (const tx of transactions) {
      // Skip if already indexed (Idempotency)
      if (tx.searchCategoryIds !== undefined && tx.searchLabelIds !== undefined) {
        skippedCount++;
        continue;
      }

      // Generate tags using the central helper
      const { searchCategoryIds, searchLabelIds } = generateSearchTags({
        categoryId: tx.categoryId,
        labelId: tx.labelId,
        isSplit: tx.isSplit,
        splits: tx.splits,
      });

      // Update the document
      await ctx.db.patch(tx._id, {
        searchCategoryIds,
        searchLabelIds,
      });

      updatedCount++;
    }

    console.log(`Backfill complete!`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount} (Already indexed)`);

    return {
      total: transactions.length,
      updated: updatedCount,
      skipped: skippedCount,
    };
  },
});
