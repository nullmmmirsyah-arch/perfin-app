import { internalMutation, mutation } from "./_generated/server";
import { generateSearchTags } from "./lib/transactions";
import { recomputeUserCache } from "./lib/recomputeCache";

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
        labelIds: tx.labelIds,
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

export const backfillHouseholdSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const households = await ctx.db.query("households").collect();
    let updated = 0;
    
    for (const h of households) {
      if (h.budgetStartDay === undefined) {
        await ctx.db.patch(h._id, { budgetStartDay: 1 });
        updated++;
      }
    }
    
    return { total: households.length, updated };
  }
});

/**
 * Migration: Backfill Budget Fields
 * 
 * This script populates the new 'initialAmount' and 'totalAdjustments' fields
 * for existing budgets. For existing budgets:
 * - initialAmount = amount (retroactive - this was the initial allocation)
 * - totalAdjustments = "0" (no historical adjustments tracked)
 * 
 * Run this ONCE from the Convex Dashboard after deploying the new schema.
 */
/**
 * Migration: Shift budget months for end-month convention.
 * 
 * Only shifts budgets belonging to households with budgetStartDay > 1.
 * startDay=1 budgets already use calendar month = fiscal month.
 * 
 * Run this ONCE from the Convex Dashboard BEFORE deploying the code changes.
 */
export const migrateFiscalMonthConvention = mutation({
  args: {},
  handler: async (ctx) => {
    const households = await ctx.db.query("households").collect();
    const householdStartDay = new Map(
      households.map(h => [h._id, h.budgetStartDay ?? 1])
    );
    
    const budgets = await ctx.db.query("budgets").collect();
    let count = 0;
    for (const b of budgets) {
      const startDay = b.householdId
        ? (householdStartDay.get(b.householdId) ?? 1)
        : 1;
      if (startDay === 1) continue;

      const newMonth = (b.month + 1) % 12;
      let newYear = b.year;
      if (b.month === 11) newYear += 1;

      if (newMonth !== b.month || newYear !== b.year) {
        await ctx.db.patch(b._id, { month: newMonth, year: newYear });
        count++;
      }
    }
    return { total: budgets.length, updated: count };
  },
});

export const backfillBudgetFields = mutation({
  args: {},
  handler: async (ctx) => {
    const budgets = await ctx.db.query("budgets").collect();
    
    console.log(`Starting backfill for ${budgets.length} budgets...`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const budget of budgets) {
      // Skip if already populated (Idempotency)
      if (budget.initialAmount !== undefined && budget.totalAdjustments !== undefined) {
        skippedCount++;
        continue;
      }
      
      // Set initialAmount to current amount (retroactive)
      // Set totalAdjustments to "0" (no historical data)
      await ctx.db.patch(budget._id, {
        initialAmount: budget.amount,
        totalAdjustments: "0",
      });
      
      updatedCount++;
    }
    
    console.log(`Backfill complete!`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount} (Already indexed)`);
    
    return {
      total: budgets.length,
      updated: updatedCount,
      skipped: skippedCount,
    };
  },
});

/**
 * Migration: Labels color→icon + single→multi-label
 *
 * 1. Labels: remove `color`, add `icon: "Tag"` (default)
 * 2. Transactions: labelId → labelIds (array)
 * 3. Splits: labelId → labelIds (array)
 * 4. Recompute searchLabelIds
 *
 * Run ONCE from Convex Dashboard after deploying new schema.
 */
export const migrateLabelsToIconAndMultiLabel = mutation({
  args: {},
  handler: async (ctx) => {
    // --- Migrate Labels: color → icon ---
    const labels = await ctx.db.query("labels").collect();
    let labelsUpdated = 0;
    for (const label of labels) {
      const patch: Record<string, unknown> = {};
      if ("color" in label) {
        patch.icon = "Tag";
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(label._id, patch);
        labelsUpdated++;
      }
    }

    // --- Migrate Transactions: labelId → labelIds ---
    const transactions = await ctx.db.query("transactions").collect();
    let txUpdated = 0;

    for (const tx of transactions) {
      const patch: Record<string, unknown> = {};
      const legacyTx = tx as Record<string, unknown>;

      // Root labelId → labelIds
      if (legacyTx.labelId && !legacyTx.labelIds) {
        patch.labelIds = [legacyTx.labelId];
      }

      // Splits labelId → labelIds
      if (tx.splits && tx.splits.length > 0) {
        patch.splits = tx.splits.map((s) => {
          const legacySplit = s as Record<string, unknown>;
          return {
            ...s,
            labelIds: legacySplit.labelId && !legacySplit.labelIds ? [legacySplit.labelId] : (s.labelIds || []),
          };
        });
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(tx._id, patch);
        txUpdated++;
      }
    }

    // --- Recompute searchLabelIds for all transactions ---
    const allTx = await ctx.db.query("transactions").collect();
    let searchUpdated = 0;

    for (const tx of allTx) {
      const labelIdsSet = new Set<string>();

      if (tx.labelIds && Array.isArray(tx.labelIds)) {
        tx.labelIds.forEach((id) => labelIdsSet.add(String(id)));
      }

      if (tx.splits && tx.splits.length > 0) {
        for (const split of tx.splits) {
          if (split.labelIds && Array.isArray(split.labelIds)) {
            split.labelIds.forEach((id) => labelIdsSet.add(String(id)));
          }
        }
      }

      const newSearchLabelIds = Array.from(labelIdsSet);
      const currentSearch = tx.searchLabelIds || [];

      if (
        JSON.stringify(newSearchLabelIds.sort()) !==
        JSON.stringify(currentSearch.sort())
      ) {
        await ctx.db.patch(tx._id, { searchLabelIds: newSearchLabelIds });
        searchUpdated++;
      }
    }

    return {
      labelsUpdated,
      transactionsUpdated: txUpdated,
      searchLabelIdsRecomputed: searchUpdated,
    };
  },
});