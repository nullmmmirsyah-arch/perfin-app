import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { 
  calculateSpendingByCategory, 
  AccountMap, 
  analyzeTransactionFlow,
  getFiscalDateDetails,
  getFiscalMonthRange,
  parseAmount
} from "./lib/finance";
import { checkHouseholdAccess, ensureHouseholdAccess } from "./lib/auth";
import { 
  TRANSACTION_TYPES, 
  CATEGORY_TYPES, 
  ACCOUNT_TYPES, 
  NOTIFICATION_TYPES,
  GOAL_STATUS
} from "./lib/constants";
import { generateSearchTags } from "./lib/transactions";
import { recomputeUserCache } from "./lib/recomputeCache";

import { paginationOptsValidator } from "convex/server";

// Helper: Ensure budget exists for a category in the transaction month
async function ensureBudgetExists(
    ctx: MutationCtx, 
    categoryId: Id<"categories">, 
    dateStr: string, 
    userId: string, 
    amount: string, // Accept transaction amount
    householdId?: Id<"households">,
    shouldIncrement: boolean = false // New param: Auto-adjust budget upward
) {
    // 1. Fetch Household settings for budgetStartDay
    let household;
    if (householdId) {
        household = await ctx.db.get(householdId);
    } else {
        const member = await ctx.db
            .query("householdMembers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        if (member) household = await ctx.db.get(member.householdId);
    }
    const startDay = household?.budgetStartDay || 1;

    // 2. Use Fiscal Helper to determine Year/Month
    const { year, month } = getFiscalDateDetails(dateStr, startDay);

    let existingBudget;
    if (householdId) {
        existingBudget = await ctx.db.query("budgets")
            .withIndex("by_householdId_category_year_month", q => 
                q.eq("householdId", householdId)
                 .eq("categoryId", categoryId)
                 .eq("year", year)
                 .eq("month", month)
            ).first();
    } else {
        existingBudget = await ctx.db.query("budgets")
            .withIndex("by_user_category_year_month", q => 
                q.eq("userId", userId)
                 .eq("categoryId", categoryId)
                 .eq("year", year)
                 .eq("month", month)
            ).first();
    }

    const txAmount = parseFloat(amount.replace(/,/g, '') || '0');

    if (!existingBudget) {
        // Auto-create Budget
        await ctx.db.insert("budgets", {
            userId,
            householdId,
            categoryId,
            amount: txAmount.toString(), 
            year,
            month,
        });
    } else if (shouldIncrement) {
        // Smart Auto-Adjust: Only increment if the new transaction would exceed the current budget.
        
        // 1. Calculate current spending for this category in this month (FISCAL RANGE)
        const { start: startOfMonth, end: endOfMonth } = getFiscalMonthRange(year, month, startDay);
        
        let monthTransactions;
        let accounts; // We need accounts to determine flow direction

        if (householdId) {
            monthTransactions = await ctx.db.query("transactions")
                .withIndex("by_householdId_date", q => q.eq("householdId", householdId))
                .filter(q => q.gte(q.field("date"), startOfMonth) && q.lte(q.field("date"), endOfMonth))
                .collect();
            accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
        } else {
            monthTransactions = await ctx.db.query("transactions")
                .withIndex("by_userId_date", q => q.eq("userId", userId))
                .filter(q => q.gte(q.field("date"), startOfMonth) && q.lte(q.field("date"), endOfMonth))
                .collect();
            accounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", userId)).collect();
        }

        // Identify the account linked to this category (if any)
        const accountsMap: AccountMap = new Map(accounts.map(a => [String(a._id), a]));

        // Calculate NET Spent/Contribution using the centralized finance helper
        const currentSpent = monthTransactions.reduce((acc, t) => {
            const flows = analyzeTransactionFlow(t, accountsMap);
            const targetCatId = String(categoryId);
            
            // Sum up all spending effects for THIS specific category
            const netEffect = flows.reduce((fAcc, flow) => {
                if (flow.type === 'SPENDING' && String(flow.categoryId) === targetCatId) {
                    return fAcc + flow.amount;
                }
                return fAcc;
            }, 0);

            return acc + netEffect;
        }, 0);

        const currentLimit = parseFloat(existingBudget.amount.replace(/,/g, '') || '0');
        
        // projectedTotal is now the accurate Net Flow including the current transaction
        const projectedTotal = currentSpent;

        if (projectedTotal > currentLimit) {
            // Only update if we strictly need more room (actual overspending)
            await ctx.db.patch(existingBudget._id, {
                amount: projectedTotal.toString()
            });
        }
    }
}

export const getExpensesTrend = query({
  args: {
    householdId: v.optional(v.id("households")),
    type: v.optional(v.array(v.string())),
    accountId: v.optional(v.array(v.string())),
    categoryId: v.optional(v.array(v.string())),
    labelId: v.optional(v.array(v.string())),
    dateRange: v.optional(v.object({
      start: v.string(),
      end: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const { householdId, type, accountId, categoryId, labelId, dateRange } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Calculate period boundaries
    let startDay = 1;
    if (householdId) {
      const household = await ctx.db.get(householdId);
      startDay = household?.budgetStartDay || 1;
    }
    const { year, month } = getFiscalDateDetails(new Date().toISOString(), startDay);
    const currentStart = dateRange?.start || getFiscalMonthRange(year, month, startDay).start;
    const currentEnd = dateRange?.end || new Date().toISOString();

    // Previous period (same duration shifted back)
    const startObj = new Date(currentStart);
    const endObj = new Date(currentEnd);
    const duration = endObj.getTime() - startObj.getTime();
    const prevEndObj = new Date(startObj.getTime() - 1);
    const prevStartObj = new Date(prevEndObj.getTime() - duration);

    // Build single DB query for combined date range
    let query;
    if (householdId) {
      if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) {
        return { currentTotal: 0, prevTotal: 0, percentage: 0, direction: 'down' };
      }
      query = ctx.db.query("transactions").withIndex("by_householdId_date", q => q.eq("householdId", householdId));
    } else {
      query = ctx.db.query("transactions").withIndex("by_userId_date", q => q.eq("userId", identity.subject));
    }

    const allStart = prevStartObj.toISOString();
    const allEnd = currentEnd;
    query = query.filter(q => q.gte(q.field("date"), allStart)).filter(q => q.lte(q.field("date"), allEnd));

    // Filter by type(s) — fallback to expenses only
    if (type && type.length > 0) {
      query = query.filter((q) =>
        q.or(...type.map(t => q.eq(q.field("type"), t)))
      );
    } else {
      query = query.filter(q => q.eq(q.field("type"), TRANSACTION_TYPES.EXPENSE));
    }

    // AccountId filter (DB side)
    if (accountId && accountId.length > 0) {
      query = query.filter((q) =>
        q.or(
          q.or(...accountId.map(a => q.eq(q.field("accountId"), a))),
          q.or(...accountId.map(a => q.eq(q.field("toAccountId"), a)))
        )
      );
    }

    // Note: categoryId/labelId filtering cannot be pushed to DB via filter()
    // because Convex filter() doesn't support array containment checks on
    // searchCategoryIds/searchLabelIds. Filtering stays in JS after collect().

    // Single DB collect
    const transactions = await query.collect();

    // Split into current and previous period sums in JS
    let currentTotal = 0;
    let prevTotal = 0;
    const currentStartTime = new Date(currentStart).getTime();
    const currentEndTime = new Date(currentEnd).getTime();
    const prevStartTime = prevStartObj.getTime();
    const prevEndTime = prevEndObj.getTime();

    for (const t of transactions) {
      const tDate = new Date(t.date).getTime();
      const isCurrent = tDate >= currentStartTime && tDate <= currentEndTime;
      const isPrev = tDate >= prevStartTime && tDate <= prevEndTime;
      if (!isCurrent && !isPrev) continue;

      // JS Filter for Category/Label (same logic as before)
      const matchesCat = !categoryId || categoryId.length === 0 ||
        t.searchCategoryIds?.some(id => categoryId.includes(id));
      const matchesLabel = !labelId || labelId.length === 0 ||
        t.searchLabelIds?.some(id => labelId.includes(id));

      if (!matchesCat || !matchesLabel) continue;

      let amountToAdd = 0;
      if (t.isSplit && t.splits) {
        amountToAdd = t.splits.reduce((sAcc, s) => {
          const splitMatchesLabel = !labelId || labelId.length === 0 || (s.labelIds?.some(id => labelId.includes(String(id))));
          const splitMatchesCat = !categoryId || categoryId.length === 0 || categoryId.includes(s.categoryId);
          if (splitMatchesLabel && splitMatchesCat) {
            return sAcc + parseFloat(s.amount.replace(/,/g, '') || '0');
          }
          return sAcc;
        }, 0);
      } else {
        amountToAdd = parseFloat(t.amount.replace(/,/g, '') || '0');
      }

      if (isCurrent) currentTotal += amountToAdd;
      if (isPrev) prevTotal += amountToAdd;
    }

    // Calculate Percentage
    let percentage = 0;
    if (prevTotal > 0) {
      percentage = ((currentTotal - prevTotal) / prevTotal) * 100;
    } else if (currentTotal > 0) {
      percentage = 100;
    }

    return {
      currentTotal,
      prevTotal,
      percentage,
      direction: percentage > 0 ? 'up' : 'down'
    };
  }
});

export const get = query({
  args: {
    householdId: v.optional(v.id("households")),
    type: v.optional(v.array(v.string())),
    accountId: v.optional(v.array(v.string())),
    categoryId: v.optional(v.array(v.string())),
    labelId: v.optional(v.array(v.string())),
    merchantId: v.optional(v.array(v.string())),
    dateRange: v.optional(v.object({
      start: v.optional(v.string()),
      end: v.optional(v.string()),
    })),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { householdId, type, accountId, categoryId, labelId, merchantId, dateRange, paginationOpts } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let query;
    if (householdId) {
      if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) {
        return { page: [], isDone: true, continueCursor: "" };
      }

      query = ctx.db
        .query("transactions")
        .withIndex("by_householdId_date", (q) => q.eq("householdId", householdId));
    } else {
      query = ctx.db
        .query("transactions")
        .withIndex("by_userId_date", (q) => q.eq("userId", identity.subject));
    }

    // Filter Logic:
    // Convex filter() runs on the database/backend server for each document.
    // We can use standard JS logic inside if we're not relying on specific Index lookups for these fields (which we aren't, we used Date index).
    // Note: 'type' and 'accountId' args are now arrays.

    if (type && type.length > 0) {
      // Logic: OR (is any of the selected types)
      // Since we can't easily spread into q.or() dynamically in all TS setups, 
      // we can construct a helper or just iterate manually if needed, 
      // BUT for simplicity and flexibility with arrays, standard index scan + filter usually allows simple boolean logic.
      // However, q.eq only compares values.
      // A better approach for "IN array" in Convex filter function is simple JS logic if the builder allows it?
      // No, query.filter(q => ...) must use q operations.
      // The robust way for dynamic "IN" is converting to a massive OR chain.
      
      query = query.filter((q) => 
        q.or(
          ...type.map(t => q.eq(q.field("type"), t))
        )
      );
    }

    if (accountId && accountId.length > 0) {
      // Logic: (From IN accounts) OR (To IN accounts)
      query = query.filter((q) => 
        q.or(
           q.or(...accountId.map(a => q.eq(q.field("accountId"), a))),
           q.or(...accountId.map(a => q.eq(q.field("toAccountId"), a)))
        )
      );
    }

    if (merchantId && merchantId.length > 0) {
      query = query.filter((q) =>
        q.or(...merchantId.map(m => q.eq(q.field("merchantId"), m)))
      );
    }
    
    if (dateRange?.start) {
      const start = dateRange.start;
      query = query.filter((q) => q.gte(q.field("date"), start));
    }
    if (dateRange?.end) {
      const end = dateRange.end;
      query = query.filter((q) => q.lte(q.field("date"), end));
    }

    // Two-path pagination
    const hasJsFilters = (categoryId && categoryId.length > 0) || (labelId && labelId.length > 0);

    query = query.order("desc");

    let pageResults: Doc<"transactions">[];
    let isDone: boolean;
    let continueCursor: string;

    if (!hasJsFilters) {
      // Efficient DB-level pagination — only fetches numItems documents
      const paginated = await query.paginate(paginationOpts);
      pageResults = paginated.page;
      isDone = paginated.isDone;
      continueCursor = paginated.continueCursor;
    } else {
      // JS-side filtering for category/label requires over-fetching
      const allCandidates = await query.collect();

      let filteredResults = allCandidates;
      if (categoryId?.length) {
        filteredResults = filteredResults.filter(t =>
          t.searchCategoryIds?.some(id => categoryId.includes(id))
        );
      }
      if (labelId?.length) {
        filteredResults = filteredResults.filter(t =>
          t.searchLabelIds?.some(id => labelId.includes(id))
        );
      }

      const cursor = paginationOpts.cursor ? parseInt(paginationOpts.cursor) : 0;
      const limit = paginationOpts.numItems;
      pageResults = filteredResults.slice(cursor, cursor + limit);
      isDone = cursor + limit >= filteredResults.length;
      continueCursor = isDone ? "" : (cursor + limit).toString();
    }

    // Batch fetch related entities to avoid N+1 queries
    const accountIds = new Set<Id<"accounts">>();
    const categoryIds = new Set<Id<"categories">>();
    const labelIds = new Set<Id<"labels">>();
    const merchantIds = new Set<Id<"merchants">>();

    pageResults.forEach(t => {
      accountIds.add(t.accountId);
      if (t.toAccountId) accountIds.add(t.toAccountId);
      if (t.categoryId) categoryIds.add(t.categoryId);
      if (t.labelIds) t.labelIds.forEach(id => labelIds.add(id));
      if (t.merchantId) merchantIds.add(t.merchantId);
      
      t.splits?.forEach(s => {
        categoryIds.add(s.categoryId);
        if (s.labelIds) s.labelIds.forEach(id => labelIds.add(id));
      });
    });

    // Parallel fetch all unique related documents
    const [accounts, categories, labels, merchants] = await Promise.all([
      Promise.all(Array.from(accountIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(categoryIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(labelIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(merchantIds).map(id => ctx.db.get(id))),
    ]);

    const accountMap = new Map(accounts.filter(Boolean).map(a => [a!._id, a!]));
    const categoryMap = new Map(categories.filter(Boolean).map(c => [c!._id, c!]));
    const labelMap = new Map(labels.filter(Boolean).map(l => [l!._id, l!]));
    const merchantMap = new Map(merchants.filter(Boolean).map(m => [m!._id, m!]));

    const pageWithDetails = pageResults.map((transaction) => {
      const fromAccount = accountMap.get(transaction.accountId);
      const toAccount = transaction.toAccountId ? accountMap.get(transaction.toAccountId) : null;
      const labels = transaction.labelIds
        ? transaction.labelIds.map(id => labelMap.get(id)).filter(Boolean)
        : [];
      const category = transaction.categoryId ? categoryMap.get(transaction.categoryId) : null;
      const merchant = transaction.merchantId ? merchantMap.get(transaction.merchantId) : null;

      const splitsWithDetails = transaction.splits?.map((split) => {
        const splitCategory = categoryMap.get(split.categoryId);
        const splitLabels = split.labelIds
          ? split.labelIds.map(id => labelMap.get(id)).filter(Boolean)
          : [];

        return {
          ...split,
          categoryName: splitCategory?.name,
          labelNames: splitLabels.map(l => l!.name),
          labelIcons: splitLabels.map(l => l!.icon),
        };
      });

      const hideAmount = transaction.isSplit && transaction.splits && transaction.splits.length > 0
        ? transaction.splits.some(s => categoryMap.get(s.categoryId)?.hideAmount === true)
        : (category?.hideAmount ?? false);

      return {
        ...transaction,
        fromAccountName: fromAccount?.name,
        toAccountName: toAccount?.name,
        categoryName: category?.name,
        hideAmount,
        labels: labels,
        merchant: merchant || null,
        splits: splitsWithDetails,
      };
    });

    return {
        page: pageWithDetails,
        isDone,
        continueCursor
    };
  },
});

export const exportTransactions = query({
  args: {
    householdId: v.optional(v.id("households")),
    type: v.optional(v.array(v.string())),
    accountId: v.optional(v.array(v.string())),
    categoryId: v.optional(v.array(v.string())),
    labelId: v.optional(v.array(v.string())),
    merchantId: v.optional(v.array(v.string())),
    dateRange: v.optional(v.object({
      start: v.optional(v.string()),
      end: v.optional(v.string()),
    })),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { householdId, type, accountId, categoryId, labelId, merchantId, dateRange, search } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let queryBuilder;
    if (householdId) {
      if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) {
        return [];
      }
      queryBuilder = ctx.db
        .query("transactions")
        .withIndex("by_householdId_date", (q) => q.eq("householdId", householdId));
    } else {
      queryBuilder = ctx.db
        .query("transactions")
        .withIndex("by_userId_date", (q) => q.eq("userId", identity.subject));
    }

    if (dateRange?.start) {
      queryBuilder = queryBuilder.filter((q) => q.gte(q.field("date"), dateRange.start!));
    }
    if (dateRange?.end) {
      queryBuilder = queryBuilder.filter((q) => q.lte(q.field("date"), dateRange.end!));
    }

    if (type && type.length > 0) {
      queryBuilder = queryBuilder.filter((q) => 
        q.or(...type.map(t => q.eq(q.field("type"), t)))
      );
    }

    if (accountId && accountId.length > 0) {
      queryBuilder = queryBuilder.filter((q) => 
        q.or(
           q.or(...accountId.map(a => q.eq(q.field("accountId"), a))),
           q.or(...accountId.map(a => q.eq(q.field("toAccountId"), a)))
        )
      );
    }

    if (merchantId && merchantId.length > 0) {
      queryBuilder = queryBuilder.filter((q) =>
        q.or(...merchantId.map(m => q.eq(q.field("merchantId"), m)))
      );
    }

    // Collect all candidates first (No pagination)
    let results = await queryBuilder.order("desc").collect();

    // JS Filtering for Complex logic (Search, Categories, Labels)
    if (search || (categoryId && categoryId.length > 0) || (labelId && labelId.length > 0)) {
        const searchLower = search?.toLowerCase();
        
        results = results.filter(t => {
            let matches = true;

            // Search Text
            if (searchLower) {
                const descMatch = t.description?.toLowerCase().includes(searchLower);
                // We can't easily check category/account names here without joining first, 
                // but usually search filters by description or amount.
                // Let's stick to description for export filtering speed.
                matches = matches && (!!descMatch);
            }

            // Categories
            if (categoryId && categoryId.length > 0) {
                 const catMatch = t.searchCategoryIds?.some(id => categoryId.includes(id));
                 matches = matches && (!!catMatch);
            }

            // Labels
            if (labelId && labelId.length > 0) {
                 const lblMatch = t.searchLabelIds?.some(id => labelId.includes(id));
                 matches = matches && (!!lblMatch);
            }

            return matches;
        });
    }

    // Batch Fetch Details
    const accountIds = new Set<Id<"accounts">>();
    const categoryIds = new Set<Id<"categories">>();
    const labelIds = new Set<Id<"labels">>();

    results.forEach(t => {
      accountIds.add(t.accountId);
      if (t.toAccountId) accountIds.add(t.toAccountId);
      if (t.categoryId) categoryIds.add(t.categoryId);
      if (t.labelIds) t.labelIds.forEach(id => labelIds.add(id));
      
      t.splits?.forEach(s => {
        categoryIds.add(s.categoryId);
        if (s.labelIds) s.labelIds.forEach(id => labelIds.add(id));
      });
    });

    const [accounts, categories, labels] = await Promise.all([
      Promise.all(Array.from(accountIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(categoryIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(labelIds).map(id => ctx.db.get(id))),
    ]);

    const accountMap = new Map(accounts.filter(Boolean).map(a => [a!._id, a!]));
    const categoryMap = new Map(categories.filter(Boolean).map(c => [c!._id, c!]));
    const labelMap = new Map(labels.filter(Boolean).map(l => [l!._id, l!]));

    // Format for Export (Exploded Rows for Splits)
    return results.flatMap((t) => {
        const fromAccount = accountMap.get(t.accountId);
        const toAccount = t.toAccountId ? accountMap.get(t.toAccountId) : null;
        
        // Base object common to all rows from this transaction
        const baseRow = {
            date: t.date,
            type: t.type,
            account: fromAccount?.name || "Unknown",
            toAccount: toAccount?.name || "",
            // Common description, can be appended later
            description: t.description || "",
            assetQuantity: t.assetDetails?.quantity || "",
            isSplit: t.isSplit,
        };

        if (t.isSplit && t.splits && t.splits.length > 0) {
             // EXPLODE: Create a row for each split item
             return t.splits.map(split => {
                 const splitCategory = categoryMap.get(split.categoryId);
                 const splitLabels = split.labelIds
                   ? split.labelIds.map(id => labelMap.get(id)).filter(Boolean)
                   : [];
                 
                 // If the split has no description, use the main transaction's description
                 // or format it nicely like "Main Desc (Item Desc)"
                 let rowDesc = baseRow.description;
                 if (split.description) {
                     rowDesc = rowDesc ? `${rowDesc} (${split.description})` : split.description;
                 }

                 return {
                     ...baseRow,
                     amount: split.amount, // Use split amount!
                     category: splitCategory?.name || "Unknown",
                     labels: splitLabels.map(l => l!.name),
                     description: rowDesc,
                     hideAmount: splitCategory?.hideAmount ?? false,
                 };
             });
        } else {
             // NORMAL: Return single row
             const category = t.categoryId ? categoryMap.get(t.categoryId) : null;
             const labels = t.labelIds
               ? t.labelIds.map(id => labelMap.get(id)).filter(Boolean)
               : [];

             return [{
                 ...baseRow,
                 amount: t.amount,
                 category: category?.name || "",
                 labels: labels.map(l => l!.name),
                 hideAmount: category?.hideAmount ?? false,
             }];
        }
    });
  }
});

export const searchTransactions = query({
  args: {
    householdId: v.optional(v.id("households")),
    search: v.string(),
    type: v.optional(v.array(v.string())),
    accountId: v.optional(v.array(v.string())),
    categoryId: v.optional(v.array(v.string())),
    labelId: v.optional(v.array(v.string())),
    merchantId: v.optional(v.array(v.string())),
    dateRange: v.optional(v.object({
      start: v.optional(v.string()),
      end: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const { householdId, search, type, accountId, categoryId, labelId, merchantId, dateRange } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (!search.trim()) return [];

    let queryBuilder;
    if (householdId) {
      if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) {
        return [];
      }
      queryBuilder = ctx.db
        .query("transactions")
        .withIndex("by_householdId_date", (q) => q.eq("householdId", householdId));
    } else {
      queryBuilder = ctx.db
        .query("transactions")
        .withIndex("by_userId_date", (q) => q.eq("userId", identity.subject));
    }

    if (dateRange?.start) {
      queryBuilder = queryBuilder.filter((q) => q.gte(q.field("date"), dateRange.start!));
    }
    if (dateRange?.end) {
      queryBuilder = queryBuilder.filter((q) => q.lte(q.field("date"), dateRange.end!));
    }

    if (type && type.length > 0) {
      queryBuilder = queryBuilder.filter((q) => 
        q.or(...type.map(t => q.eq(q.field("type"), t)))
      );
    }

    if (accountId && accountId.length > 0) {
      queryBuilder = queryBuilder.filter((q) => 
        q.or(
           q.or(...accountId.map(a => q.eq(q.field("accountId"), a))),
           q.or(...accountId.map(a => q.eq(q.field("toAccountId"), a)))
        )
      );
    }

    if (merchantId && merchantId.length > 0) {
      queryBuilder = queryBuilder.filter((q) =>
        q.or(...merchantId.map(m => q.eq(q.field("merchantId"), m)))
      );
    }

    let results = await queryBuilder.order("desc").collect();

    // JS Filtering for Category & Label
    if (categoryId && categoryId.length > 0) {
      results = results.filter(t => 
        t.searchCategoryIds?.some(id => categoryId.includes(id))
      );
    }
    if (labelId && labelId.length > 0) {
      results = results.filter(t => 
        t.searchLabelIds?.some(id => labelId.includes(id))
      );
    }

    // Batch fetch related entities
    const accountIds = new Set<Id<"accounts">>();
    const categoryIds = new Set<Id<"categories">>();
    const labelIds = new Set<Id<"labels">>();
    const merchantIds = new Set<Id<"merchants">>();

    results.forEach(t => {
      accountIds.add(t.accountId);
      if (t.toAccountId) accountIds.add(t.toAccountId);
      if (t.categoryId) categoryIds.add(t.categoryId);
      if (t.labelIds) t.labelIds.forEach(id => labelIds.add(id));
      if (t.merchantId) merchantIds.add(t.merchantId);
      t.splits?.forEach(s => {
        categoryIds.add(s.categoryId);
        if (s.labelIds) s.labelIds.forEach(id => labelIds.add(id));
      });
    });

    const [accounts, categories, labels, merchants] = await Promise.all([
      Promise.all(Array.from(accountIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(categoryIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(labelIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(merchantIds).map(id => ctx.db.get(id))),
    ]);

    const accountMap = new Map(accounts.filter(Boolean).map(a => [a!._id, a!]));
    const categoryMap = new Map(categories.filter(Boolean).map(c => [c!._id, c!]));
    const labelMap = new Map(labels.filter(Boolean).map(l => [l!._id, l!]));
    const merchantMap = new Map(merchants.filter(Boolean).map(m => [m!._id, m!]));

    const searchLower = search.toLowerCase();

    const matchesSearch = (t: typeof results[number]) => {
      if (t.description?.toLowerCase().includes(searchLower)) return true;
      if (t.amount.replace(/,/g, '').includes(searchLower)) return true;

      const catName = t.categoryId ? categoryMap.get(t.categoryId)?.name : undefined;
      if (catName?.toLowerCase().includes(searchLower)) return true;

      const accName = accountMap.get(t.accountId)?.name;
      if (accName?.toLowerCase().includes(searchLower)) return true;

      const lblName = t.labelIds
        ? t.labelIds.map(id => labelMap.get(id)?.name).filter(Boolean)
        : [];
      if (lblName.some(n => n?.toLowerCase().includes(searchLower))) return true;

      const merchantName = t.merchantId ? merchantMap.get(t.merchantId)?.name : undefined;
      if (merchantName?.toLowerCase().includes(searchLower)) return true;

      if (t.toAccountId) {
        const toAccName = accountMap.get(t.toAccountId)?.name;
        if (toAccName?.toLowerCase().includes(searchLower)) return true;
      }

      if (t.isSplit && t.splits) {
        for (const split of t.splits) {
          if (split.description?.toLowerCase().includes(searchLower)) return true;
          const splitCatName = categoryMap.get(split.categoryId)?.name;
          if (splitCatName?.toLowerCase().includes(searchLower)) return true;
          if (split.labelIds) {
            const splitLblNames = split.labelIds
              .map(id => labelMap.get(id)?.name)
              .filter(Boolean);
            if (splitLblNames.some(n => n?.toLowerCase().includes(searchLower))) return true;
          }
        }
      }

      return false;
    };

    results = results.filter(matchesSearch);

    // Limit to top 30 results sorted by date (already sorted desc)
    results = results.slice(0, 30);

    // Build enriched response (same pattern as get query)
    return results.map((transaction) => {
      const fromAccount = accountMap.get(transaction.accountId);
      const toAccount = transaction.toAccountId ? accountMap.get(transaction.toAccountId) : null;
      const labels = transaction.labelIds
        ? transaction.labelIds.map(id => labelMap.get(id)).filter(Boolean)
        : [];
      const category = transaction.categoryId ? categoryMap.get(transaction.categoryId) : null;
      const merchant = transaction.merchantId ? merchantMap.get(transaction.merchantId) : null;

      const splitsWithDetails = transaction.splits?.map((split) => {
        const splitCategory = categoryMap.get(split.categoryId);
        const splitLabels = split.labelIds
          ? split.labelIds.map(id => labelMap.get(id)).filter(Boolean)
          : [];
        return {
          ...split,
          categoryName: splitCategory?.name,
          labelNames: splitLabels.map(l => l!.name),
          labelIcons: splitLabels.map(l => l!.icon),
        };
      });

      const hideAmount = transaction.isSplit && transaction.splits && transaction.splits.length > 0
        ? transaction.splits.some(s => categoryMap.get(s.categoryId)?.hideAmount === true)
        : (category?.hideAmount ?? false);

      return {
        ...transaction,
        fromAccountName: fromAccount?.name,
        toAccountName: toAccount?.name,
        categoryName: category?.name,
        hideAmount,
        labels: labels,
        merchant: merchant || null,
        splits: splitsWithDetails,
      };
    });
  },
});

export const create = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    type: v.string(),
    amount: v.string(),
    date: v.string(),
    description: v.optional(v.string()),
    accountId: v.id("accounts"),
    categoryId: v.optional(v.id("categories")),
    toAccountId: v.optional(v.id("accounts")),
    isSplit: v.optional(v.boolean()),
    splits: v.optional(v.array(v.object({
      categoryId: v.id("categories"),
      amount: v.string(),
      description: v.optional(v.string()),
      labelIds: v.optional(v.array(v.id("labels"))),
    }))),
    labelIds: v.optional(v.array(v.id("labels"))),
    assetDetails: v.optional(v.object({
      quantity: v.string(),
      unitPrice: v.optional(v.number()),
    })),
    isGoalDisbursement: v.optional(v.boolean()),
    // Receivables
    isReimbursable: v.optional(v.boolean()),
    owedBy: v.optional(v.string()),
    reimbursementStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("settled"),
      v.literal("forgiven")
    )),
    parentTransactionId: v.optional(v.id("transactions")),
    merchantId: v.optional(v.id("merchants")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { parentTransactionId, ...insertArgs } = args;

    if (args.householdId) {
      await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
    }

    // --- SETTLEMENT Logic (Partial Support) ---
    if (parentTransactionId) {
        const originalTx = await ctx.db.get(parentTransactionId);
        if (!originalTx) throw new Error("Original debt transaction not found");

        const currentPaid = parseFloat(originalTx.amountPaid?.replace(/,/g, '') || '0');
        const originalAmount = parseFloat(originalTx.amount.replace(/,/g, ''));
        const newPayment = parseFloat(args.amount.replace(/,/g, ''));

        const totalAfterPayment = currentPaid + newPayment;

        // 1. Anti-Overpay Validation
        // Allow tiny floating point tolerance (0.01)
        if (totalAfterPayment > (originalAmount + 0.01)) {
             const remaining = originalAmount - currentPaid;
             throw new Error(`Overpayment detected! Remaining debt is only ${remaining.toLocaleString()}. You are trying to pay ${newPayment.toLocaleString()}.`);
        }

        // 2. Determine New Status
        let newStatus: "pending" | "settled" = "pending";
        let newSettlementStatus: "unpaid" | "partial" | "settled" = "partial";

        if (totalAfterPayment >= (originalAmount - 0.01)) {
            newStatus = "settled";
            newSettlementStatus = "settled";
        }

        // 3. Update Parent
        await ctx.db.patch(originalTx._id, {
            amountPaid: totalAfterPayment.toString(),
            reimbursementStatus: newStatus,
            settlementStatus: newSettlementStatus
        });
    }

    let finalCategoryId = args.categoryId;

    // --- AUTO-CATEGORIZE Logic ---
    if (args.type === TRANSACTION_TYPES.TRANSFER && args.toAccountId && !finalCategoryId) {
        const destAccount = await ctx.db.get(args.toAccountId as Id<"accounts">);
        if (destAccount?.linkedCategoryId) {
            finalCategoryId = destAccount.linkedCategoryId;
        }
    }

    const amount = parseFloat(args.amount.replace(/,/g, ''));

    // --- SMART DETECTION: Auto-flag as Goal Disbursement if applicable ---
    let isGoalDisbursement = args.isGoalDisbursement;
    
    // Only run auto-detection if the frontend didn't specify a preference (undefined)
    if (isGoalDisbursement === undefined && args.type === TRANSACTION_TYPES.TRANSFER && args.accountId && args.toAccountId && finalCategoryId) {
        // We need to check account types to confirm pattern: Special -> Liquid
        // Optimization: We already fetch accounts for transfer logic below, but we need types NOW.
        // Let's fetch them here if we haven't already.
        const [sourceAcc, destAcc] = await Promise.all([
            ctx.db.get(args.accountId),
            ctx.db.get(args.toAccountId)
        ]);

        if (sourceAcc && destAcc) {
            // Helper logic from finance.ts (inlined for mutation context)
            const isSourceSpecial = sourceAcc.type === ACCOUNT_TYPES.SAVING || sourceAcc.type === ACCOUNT_TYPES.ASSET;
            const isDestLiquid = !destAcc.type || destAcc.type === ACCOUNT_TYPES.CASH;

            if (isSourceSpecial && isDestLiquid) {
                // This is a withdrawal from a Goal Account to a Spending Account.
                // Default behavior: Assume it's spending the goal (Disbursement) unless told otherwise.
                isGoalDisbursement = true;
            }
        }
    }

    if (args.type === TRANSACTION_TYPES.TRANSFER) {
      if (!args.toAccountId) {
        throw new Error('To account is required for transfers');
      }

      const fromAccount = await ctx.db.get(args.accountId);
      const toAccount = await ctx.db.get(args.toAccountId);

      if (!fromAccount || !toAccount) {
        throw new Error('One or both accounts not found');
      }

      // --- Asset Transaction Logic ---
      const isFromAsset = fromAccount.type === ACCOUNT_TYPES.ASSET;
      const isToAsset = toAccount.type === ACCOUNT_TYPES.ASSET;

      if (isFromAsset || isToAsset) {
        const quantity = parseFloat(args.assetDetails?.quantity || '0');
        if (quantity <= 0) throw new Error('Quantity is required for asset transactions');

        if (!isFromAsset && isToAsset) {
          const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
          await ctx.db.patch(fromAccount._id, { balance: (fromBalance - amount).toString() });

          const currentQty = toAccount.quantity ?? parseFloat(toAccount.initialQuantity || '0');
          const currentCostBasis = toAccount.totalCostBasis ?? 0;
          
          const newQty = currentQty + quantity;
          const newCostBasis = currentCostBasis + amount;
          const impliedPrice = quantity > 0 ? amount / quantity : 0;
          
          const newEstimatedValue = newQty * impliedPrice;

          await ctx.db.patch(toAccount._id, {
            quantity: newQty,
            totalCostBasis: newCostBasis,
            balance: newEstimatedValue.toString(),
          });
        }
        else if (isFromAsset && !isToAsset) {
          const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
          await ctx.db.patch(toAccount._id, { balance: (toBalance + amount).toString() });

          const currentQty = fromAccount.quantity ?? parseFloat(fromAccount.initialQuantity || '0');
          const currentCostBasis = fromAccount.totalCostBasis ?? 0;
          const currentRealizedProfit = fromAccount.totalRealizedProfit ?? 0;

          if (currentQty < quantity) throw new Error('Insufficient asset quantity');

          const avgCost = currentQty > 0 ? currentCostBasis / currentQty : 0;
          const sellPrice = quantity > 0 ? amount / quantity : 0; 
          const costOfSoldGoods = avgCost * quantity;
          const profit = amount - costOfSoldGoods;

          const newQty = currentQty - quantity;
          const newCostBasis = currentCostBasis - costOfSoldGoods; 
          const newRealizedProfit = currentRealizedProfit + profit;
          const newEstimatedValue = newQty * sellPrice;

          await ctx.db.patch(fromAccount._id, {
            quantity: newQty,
            totalCostBasis: newCostBasis,
            totalRealizedProfit: newRealizedProfit,
            balance: newEstimatedValue.toString(),
          });
        }
        else {
           const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
           const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));

           if (fromBalance < amount) {
               throw new Error(`Insufficient balance in ${fromAccount.name}. Available: ${fromAccount.balance}`);
           }

           await ctx.db.patch(fromAccount._id, { balance: (fromBalance - amount).toString() });
           await ctx.db.patch(toAccount._id, { balance: (toBalance + amount).toString() });
        }

      } else {
        const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
        const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));

        if (fromBalance < amount) {
            throw new Error(`Insufficient balance in ${fromAccount.name}. Available: ${fromAccount.balance}`);
        }

        await ctx.db.patch(fromAccount._id, { balance: (fromBalance - amount).toString() });
        await ctx.db.patch(toAccount._id, { balance: (toBalance + amount).toString() });
      }

    } else {
      const account = await ctx.db.get(args.accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      const balance = parseFloat(account.balance.replace(/,/g, ''));
      let newBalance;
      if (args.type === TRANSACTION_TYPES.INCOME) {
        newBalance = balance + amount;
      } else { 
        newBalance = balance - amount;
      }
      await ctx.db.patch(account._id, { balance: newBalance.toString() });
    }

    const { searchCategoryIds, searchLabelIds } = generateSearchTags({
        ...insertArgs,
        categoryId: finalCategoryId as string | undefined,
        labelIds: args.labelIds?.map(String),
        splits: args.splits?.map(s => ({
          ...s,
          labelIds: s.labelIds?.map(String),
        })),
    });

    const transaction = await ctx.db.insert("transactions", {
      ...insertArgs,
      categoryId: finalCategoryId as Id<"categories"> | undefined,
      userId: identity.subject,
      householdId: args.householdId,
      isGoalDisbursement, // Use the auto-detected or provided flag
      searchCategoryIds,
      searchLabelIds,
      // Receivables
      isReimbursable: args.isReimbursable,
      owedBy: args.owedBy,
      reimbursementStatus: args.reimbursementStatus || (args.isReimbursable ? 'pending' : undefined),
      // Initialize partial fields for new debts
      amountPaid: args.isReimbursable ? "0" : undefined,
      settlementStatus: args.isReimbursable ? "unpaid" : undefined,
      parentTransactionId: args.parentTransactionId,
    });

    if (args.isSplit && args.splits) {
        for (const split of args.splits) {
            await ensureBudgetExists(ctx, split.categoryId, args.date, identity.subject, split.amount, args.householdId, false);
        }
    } 
    else if ((args.type === TRANSACTION_TYPES.EXPENSE || args.type === TRANSACTION_TYPES.SAVING) && finalCategoryId) {
        const shouldIncrement = args.type === TRANSACTION_TYPES.SAVING;
        await ensureBudgetExists(ctx, finalCategoryId as Id<"categories">, args.date, identity.subject, args.amount, args.householdId, shouldIncrement);
    }
    else if (args.type === TRANSACTION_TYPES.TRANSFER && finalCategoryId && !isGoalDisbursement) {
         const fromAccount = await ctx.db.get(args.accountId);
         const toAccount = await ctx.db.get(args.toAccountId as Id<"accounts">);
         
         const fromIsLiquid = fromAccount && (!fromAccount.type || fromAccount.type.toUpperCase() === ACCOUNT_TYPES.CASH);
         const toIsSpecial = toAccount && (toAccount.type?.toUpperCase() === ACCOUNT_TYPES.SAVING || toAccount.type?.toUpperCase() === ACCOUNT_TYPES.ASSET);

         // ONLY auto-budget if it's a Deposit (Liquid Cash -> Special Goal)
         if (fromIsLiquid && toIsSpecial) {
            await ensureBudgetExists(ctx, finalCategoryId as Id<"categories">, args.date, identity.subject, args.amount, args.householdId, true);
         }
    }

    // Skip notifications for private accounts or hideAmount categories
    const account = args.accountId ? await ctx.db.get(args.accountId) : null;
    const category = args.categoryId ? await ctx.db.get(args.categoryId) : null;
    const anySplitHideAmount = args.isSplit && args.splits && args.splits.length > 0
      ? (await Promise.all(args.splits.map(s => ctx.db.get(s.categoryId)))).some(c => c?.hideAmount === true)
      : false;
    if (account?.householdId && (category?.householdId || anySplitHideAmount)) {
      const skipNotification =
        (account?.visibility === "private") ||
        (category?.hideAmount === true) ||
        anySplitHideAmount;
      if (skipNotification) {
        return transaction;
      }
    }

    if (args.householdId) {
      const members = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId", (q) => q.eq("householdId", args.householdId!))
        .collect();

      const household = await ctx.db.get(args.householdId);
      const householdName = household?.name || "Household";
      const txType = args.type === TRANSACTION_TYPES.INCOME ? 'Income' : 'Expense';
      
      for (const member of members) {
        if (member.userId !== identity.subject) {
          await ctx.scheduler.runAfter(0, internal.push.sendNotification, {
            userId: member.userId,
            title: `New Transaction: ${householdName}`,
            body: `${txType}: ${args.amount} - ${args.description || 'No description'}`,
          });
        }
      }
    }

    if (finalCategoryId) {
        await checkGoalProgress(ctx, finalCategoryId as Id<"categories">, args.householdId, identity.subject);
    }

    await recomputeUserCache(ctx, identity.subject, args.householdId);

    return transaction;
  },
});

export const update = mutation({
  args: {
    id: v.id("transactions"),
    type: v.optional(v.string()),
    amount: v.optional(v.string()),
    date: v.optional(v.string()),
    description: v.optional(v.string()),
    accountId: v.optional(v.id("accounts")),
    categoryId: v.optional(v.id("categories")),
    toAccountId: v.optional(v.id("accounts")),
    isSplit: v.optional(v.boolean()),
    splits: v.optional(v.array(v.object({
      categoryId: v.id("categories"),
      amount: v.string(),
      description: v.optional(v.string()),
      labelIds: v.optional(v.array(v.id("labels"))),
    }))),
    labelIds: v.optional(v.array(v.id("labels"))),
    assetDetails: v.optional(v.object({
      quantity: v.string(),
      unitPrice: v.optional(v.number()),
    })),
    isGoalDisbursement: v.optional(v.boolean()),
    // Receivables
    isReimbursable: v.optional(v.boolean()),
    owedBy: v.optional(v.string()),
    reimbursementStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("settled"),
      v.literal("forgiven")
    )),
    merchantId: v.optional(v.id("merchants")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { id, ...rest } = args;
    const originalTransaction = await ctx.db.get(id);
    if (!originalTransaction) {
      throw new Error("Original transaction not found");
    }

    if (originalTransaction.householdId) {
      await ensureHouseholdAccess(ctx, originalTransaction.householdId, identity.subject);
    } else {
      if (originalTransaction.userId !== identity.subject) throw new Error("Unauthorized");
    }

    const originalAmount = parseFloat(originalTransaction.amount.replace(/,/g, ''));
    
    if (originalTransaction.type === TRANSACTION_TYPES.TRANSFER) {
      if (!originalTransaction.toAccountId) throw new Error("Invalid original transaction data");

      const fromAccount = await ctx.db.get(originalTransaction.accountId);
      const toAccount = await ctx.db.get(originalTransaction.toAccountId);

      if (fromAccount && toAccount) {
         const isFromAsset = fromAccount.type === ACCOUNT_TYPES.ASSET;
         const isToAsset = toAccount.type === ACCOUNT_TYPES.ASSET;

         if (isFromAsset || isToAsset) {
            const quantity = parseFloat(originalTransaction.assetDetails?.quantity || '0');
            
            if (!isFromAsset && isToAsset) {
                const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
                await ctx.db.patch(fromAccount._id, { balance: (fromBalance + originalAmount).toString() });
                
                const currentQty = toAccount.quantity ?? parseFloat(toAccount.initialQuantity || '0');
                const currentCostBasis = toAccount.totalCostBasis ?? 0;
                const newQty = Math.max(0, currentQty - quantity);
                const newCostBasis = Math.max(0, currentCostBasis - originalAmount);
                const currentPrice = currentQty > 0 ? parseFloat(toAccount.balance) / currentQty : 0;
                
                await ctx.db.patch(toAccount._id, {
                    quantity: newQty,
                    totalCostBasis: newCostBasis,
                    balance: (newQty * currentPrice).toString()
                });
            }
            else if (isFromAsset && !isToAsset) {
                const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
                await ctx.db.patch(toAccount._id, { balance: (toBalance - originalAmount).toString() });

                const currentQty = fromAccount.quantity ?? parseFloat(fromAccount.initialQuantity || '0');
                const currentCostBasis = fromAccount.totalCostBasis ?? 0;
                const newQty = currentQty + quantity;
                const newCostBasis = currentCostBasis + originalAmount; 
                const currentPrice = currentQty > 0 ? parseFloat(fromAccount.balance) / currentQty : 0;

                await ctx.db.patch(fromAccount._id, {
                    quantity: newQty,
                    totalCostBasis: newCostBasis,
                    balance: (newQty * currentPrice).toString()
                });
            }
         } else {
             const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
             const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
             await ctx.db.patch(fromAccount._id, { balance: (fromBalance + originalAmount).toString() });
             await ctx.db.patch(toAccount._id, { balance: (toBalance - originalAmount).toString() });
         }
      }
    } else {
      const account = await ctx.db.get(originalTransaction.accountId);
      if (account) {
          const balance = parseFloat(account.balance.replace(/,/g, ''));
          let newBalance;
          if (originalTransaction.type === TRANSACTION_TYPES.INCOME) {
            newBalance = balance - originalAmount;
          } else { 
            newBalance = balance + originalAmount;
          }
          await ctx.db.patch(account._id, { balance: newBalance.toString() });
      }
    }

    const newTx = { ...originalTransaction, ...rest };
    let finalCategoryId = newTx.categoryId;

    if (newTx.type === TRANSACTION_TYPES.TRANSFER && newTx.toAccountId && !finalCategoryId) {
        const destAccount = await ctx.db.get(newTx.toAccountId as Id<"accounts">);
        if (destAccount?.linkedCategoryId) {
            finalCategoryId = destAccount.linkedCategoryId;
        }
    }

    // --- SMART DETECTION (Update) ---
    let isGoalDisbursement = newTx.isGoalDisbursement;
    
    // If user explicitly changed the flag in this update, trust them. 
    // If not (undefined in args), but accounts changed, we might need to re-evaluate or trust previous state.
    // For safety in this specific flow: If explicit false is sent, newTx has it.
    // We only auto-flag if it's currently false/undefined AND pattern matches.
    // But wait, if user unchecks the box, args.isGoalDisbursement is false. newTx.isGoalDisbursement is false.
    // The previous logic was overwriting it to true.
    
    // Fix: Only overwrite if args.isGoalDisbursement was NOT provided (undefined).
    if (args.isGoalDisbursement === undefined && newTx.type === TRANSACTION_TYPES.TRANSFER && newTx.accountId && newTx.toAccountId && finalCategoryId) {
         const [sourceAcc, destAcc] = await Promise.all([
            ctx.db.get(newTx.accountId),
            ctx.db.get(newTx.toAccountId)
        ]);
        if (sourceAcc && destAcc) {
            const isSourceSpecial = sourceAcc.type === ACCOUNT_TYPES.SAVING || sourceAcc.type === ACCOUNT_TYPES.ASSET;
            const isDestLiquid = !destAcc.type || destAcc.type === ACCOUNT_TYPES.CASH;
            if (isSourceSpecial && isDestLiquid) {
                isGoalDisbursement = true;
            }
        }
    }

    const newAmount = parseFloat(newTx.amount.replace(/,/g, ''));

    if (newTx.type === TRANSACTION_TYPES.TRANSFER) {
      if (!newTx.toAccountId) throw new Error("To account is required for transfers");

      const fromAccount = await ctx.db.get(newTx.accountId);
      const toAccount = await ctx.db.get(newTx.toAccountId);

      if (!fromAccount || !toAccount) throw new Error("Accounts not found");

      const isFromAsset = fromAccount.type === ACCOUNT_TYPES.ASSET;
      const isToAsset = toAccount.type === ACCOUNT_TYPES.ASSET;

      if (isFromAsset || isToAsset) {
          const newQuantity = parseFloat(newTx.assetDetails?.quantity || '0');
          const originalQuantity = parseFloat(originalTransaction.assetDetails?.quantity || '0');

          if (newQuantity <= 0) throw new Error("Quantity required for asset transaction");

          if (!isFromAsset && isToAsset) {
              // Edit "BUY" (Income to Asset)
              // Net Effect: Are we adding more or removing some?
              // If new < original, we are removing the difference from the account.
              const qtyDifference = newQuantity - originalQuantity;
              const currentQty = toAccount.quantity ?? parseFloat(toAccount.initialQuantity || '0');
              
              if (qtyDifference < 0 && (currentQty + qtyDifference) < 0) {
                 throw new Error(`Cannot update transaction. Reducing quantity by ${Math.abs(qtyDifference)} results in negative balance (Current: ${currentQty}).`);
              }

              const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
              await ctx.db.patch(fromAccount._id, { balance: (fromBalance - newAmount + originalAmount).toString() }); // Net balance change? 
              // Wait, simpler to follow standard flow: Revert Old, Apply New. But we need safety check first.
              // Re-fetching fresh state might be safer but let's trust the logic.
              // Correct Revert+Apply logic for Balance:
              // Old was: From - OldAmount
              // New is: From - NewAmount
              // Delta: From + OldAmount - NewAmount. Correct.

              const currentCostBasis = toAccount.totalCostBasis ?? 0;
              const newQty = currentQty - originalQuantity + newQuantity; // Revert then Apply
              const newCostBasis = currentCostBasis - originalAmount + newAmount;
              
              // We need price to update balance value.
              // If we are editing a BUY, usually we assume the current price is driven by this buy? 
              // Or we keep the implicit price? 
              // Let's use the Implicit Price from the NEW transaction for the new balance valuation?
              // No, valuation should be: NewQty * (Current Market Price).
              // Current Market Price = CurrentBalance / CurrentQty.
              const currentPrice = currentQty > 0 ? parseFloat(toAccount.balance) / currentQty : 0;
              // If we are strictly backdating, this simple logic might slightly drift valuation, but it preserves "Market Value".
              
              await ctx.db.patch(toAccount._id, {
                  quantity: newQty,
                  totalCostBasis: newCostBasis,
                  balance: (newQty * currentPrice).toString()
              });
          }
          else if (isFromAsset && !isToAsset) {
              // Edit "SELL" (Asset to Cash)
              // We are removing assets.
              // Old removed: originalQuantity
              // New removes: newQuantity
              // If new > original, we are removing MORE.
              const extraToRemove = newQuantity - originalQuantity;
              const currentQty = fromAccount.quantity ?? parseFloat(fromAccount.initialQuantity || '0');
              
              if (extraToRemove > 0 && (currentQty - extraToRemove) < 0) {
                 throw new Error(`Cannot update transaction. Selling ${extraToRemove} more units exceeds current balance (Current: ${currentQty}).`);
              }

              const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
              await ctx.db.patch(toAccount._id, { balance: (toBalance + newAmount - originalAmount).toString() });

              const currentCostBasis = fromAccount.totalCostBasis ?? 0;
              const currentRealizedProfit = fromAccount.totalRealizedProfit ?? 0;

              // Revert Old Sell Logic to find "Pre-Sell" state is hard without transaction history recalculation.
              // Approximation: 
              // 1. Revert the "Cost of Goods Sold" from the Old Transaction.
              // Problem: We don't store the exact COGS used in the original tx.
              // We have to estimate it using CURRENT Average Cost, which might have changed.
              // This is the limitation of simple average cost.
              // Best Effort: Use Current Average Cost for both Revert and Apply.
              
              const avgCost = currentQty > 0 ? currentCostBasis / currentQty : 0; 
              
              // New Logic:
              // We need to adjust Cost Basis by the net change in quantity sold * avgCost.
              // Quantity Change = newQuantity - originalQuantity
              const qtyChange = newQuantity - originalQuantity;
              const costBasisAdjustment = qtyChange * avgCost; // If selling more, reduce basis more.
              
              const profitAdjustment = (newAmount - originalAmount) - costBasisAdjustment; // Revenue Change - Cost Change

              const newQty = currentQty - qtyChange;
              const newCostBasis = currentCostBasis - costBasisAdjustment;
              const newRealizedProfit = currentRealizedProfit + profitAdjustment;
              
              // Valuation
              const currentPrice = currentQty > 0 ? parseFloat(fromAccount.balance) / currentQty : 0;

              await ctx.db.patch(fromAccount._id, {
                  quantity: newQty,
                  totalCostBasis: newCostBasis,
                  totalRealizedProfit: newRealizedProfit,
                  balance: (newQty * currentPrice).toString()
              });
          }
      } else {
          const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
          const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
          await ctx.db.patch(fromAccount._id, { balance: (fromBalance - newAmount).toString() });
          await ctx.db.patch(toAccount._id, { balance: (toBalance + newAmount).toString() });
      }

    } else {
      const account = await ctx.db.get(newTx.accountId);
      if (!account) throw new Error("Account not found");

      const balance = parseFloat(account.balance.replace(/,/g, ''));
      let newBalance;
      if (newTx.type === TRANSACTION_TYPES.INCOME) {
        newBalance = balance + newAmount;
      } else { 
        newBalance = balance - newAmount;
      }
      await ctx.db.patch(account._id, { balance: newBalance.toString() });
    }

    const { searchCategoryIds, searchLabelIds } = generateSearchTags({
        ...newTx,
        categoryId: finalCategoryId as string | undefined,
        labelIds: newTx.labelIds?.map(String),
        splits: newTx.splits?.map(s => ({
          ...s,
          labelIds: s.labelIds?.map(String),
        })),
    });

    const newReimbursementStatus = args.isReimbursable === true 
            ? (args.reimbursementStatus as "pending" | "settled" | "forgiven" | undefined || originalTransaction.reimbursementStatus || 'pending') 
            : (args.isReimbursable === false ? undefined : originalTransaction.reimbursementStatus);

    let newSettlementStatus = originalTransaction.settlementStatus;
    if (newReimbursementStatus === 'forgiven' || newReimbursementStatus === 'settled') {
        newSettlementStatus = 'settled';
    } else if (newReimbursementStatus === 'pending') {
        const paid = parseAmount(originalTransaction.amountPaid);
        newSettlementStatus = paid > 0 ? 'partial' : 'unpaid';
    }

    await ctx.db.patch(id, { 
        ...rest, 
        categoryId: finalCategoryId, 
        isGoalDisbursement,
        searchCategoryIds,
        searchLabelIds,
        reimbursementStatus: newReimbursementStatus,
        settlementStatus: newSettlementStatus,
    });

    if (newTx.isSplit && newTx.splits) {
        for (const split of newTx.splits) {
            await ensureBudgetExists(ctx, split.categoryId, newTx.date, identity.subject, split.amount, newTx.householdId, false);
        }
    }
    else if ((newTx.type === TRANSACTION_TYPES.EXPENSE || newTx.type === TRANSACTION_TYPES.SAVING) && newTx.categoryId) {
        await ensureBudgetExists(ctx, newTx.categoryId, newTx.date, identity.subject, newTx.amount, newTx.householdId, false);
    }
    else if (newTx.type === TRANSACTION_TYPES.TRANSFER && newTx.categoryId && !isGoalDisbursement) {
         const fromAccount = await ctx.db.get(newTx.accountId);
         const toAccount = await ctx.db.get(newTx.toAccountId as Id<"accounts">);
         
         const fromIsLiquid = fromAccount && (!fromAccount.type || fromAccount.type.toUpperCase() === ACCOUNT_TYPES.CASH);
         const toIsSpecial = toAccount && (toAccount.type?.toUpperCase() === ACCOUNT_TYPES.SAVING || toAccount.type?.toUpperCase() === ACCOUNT_TYPES.ASSET);

         // ONLY auto-budget if it's a Deposit (Liquid Cash -> Special Goal)
         if (fromIsLiquid && toIsSpecial) {
            await ensureBudgetExists(ctx, newTx.categoryId, newTx.date, identity.subject, newTx.amount, newTx.householdId, false);
         }
    }

    if (newTx.categoryId) {
        await checkGoalProgress(ctx, newTx.categoryId, newTx.householdId, newTx.userId);
    }

    await recomputeUserCache(ctx, identity.subject, newTx.householdId);
  },
});

export const deleteTransaction = mutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const transaction = await ctx.db.get(args.id);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.householdId) {
      await ensureHouseholdAccess(ctx, transaction.householdId, identity.subject);
    } else {
      if (transaction.userId !== identity.subject) throw new Error("Unauthorized");
    }

    // --- REVERSAL Logic for Receivables (Partial Support) ---
    
    // Case A: Deleting a Settlement Transaction (Child)
    if (transaction.parentTransactionId) {
        const parentTx = await ctx.db.get(transaction.parentTransactionId);
        if (parentTx) {
            const currentPaid = parseFloat(parentTx.amountPaid?.replace(/,/g, '') || '0');
            const refundAmount = parseFloat(transaction.amount.replace(/,/g, ''));
            const newPaid = Math.max(0, currentPaid - refundAmount);
            
            await ctx.db.patch(parentTx._id, {
                amountPaid: newPaid.toString(),
                reimbursementStatus: 'pending', // Reopen debt
                settlementStatus: newPaid === 0 ? 'unpaid' : 'partial'
            });
        }
    }

    // Case B: Deleting an Original Reimbursable Transaction (Parent)
    // Cascade delete all settlement transactions
    const children = await ctx.db
        .query("transactions")
        .withIndex("by_parentTransactionId", q => q.eq("parentTransactionId", args.id))
        .collect();

    for (const child of children) {
        // Adjust balance for the account where the settlement was received
        const settleAcc = await ctx.db.get(child.accountId);
        if (settleAcc) {
            const currentBal = parseFloat(settleAcc.balance.replace(/,/g, ''));
            const settleAmt = parseFloat(child.amount.replace(/,/g, ''));
            // Revert the income (decrease balance)
            await ctx.db.patch(settleAcc._id, { balance: (currentBal - settleAmt).toString() });
        }
        await ctx.db.delete(child._id);
    }

    const amount = parseFloat(transaction.amount.replace(/,/g, ''));

    if (transaction.type === TRANSACTION_TYPES.TRANSFER) {
      if (!transaction.toAccountId) throw new Error('Invalid transfer transaction data');

      const fromAccount = await ctx.db.get(transaction.accountId);
      const toAccount = await ctx.db.get(transaction.toAccountId);

      if (!fromAccount || !toAccount) throw new Error('One or both accounts not found');

      const isFromAsset = fromAccount.type === ACCOUNT_TYPES.ASSET;
      const isToAsset = toAccount.type === ACCOUNT_TYPES.ASSET;

      if (isFromAsset || isToAsset) {
        const quantity = parseFloat(transaction.assetDetails?.quantity || '0');
        
        if (!isFromAsset && isToAsset) {
          // Deleting a "BUY" (Income to Asset). We must revert (remove) the added quantity.
          // Safety Check: Ensure we have enough quantity to remove.
          const currentQty = toAccount.quantity ?? parseFloat(toAccount.initialQuantity || '0');
          if ((currentQty - quantity) < 0) {
              throw new Error(`Cannot delete this transaction. It would result in negative asset quantity (Current: ${currentQty}, Removing: ${quantity}). This asset might have already been sold.`);
          }

          const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
          await ctx.db.patch(fromAccount._id, { balance: (fromBalance + amount).toString() });

          const currentCostBasis = toAccount.totalCostBasis ?? 0;

          const newQty = Math.max(0, currentQty - quantity);
          const newCostBasis = Math.max(0, currentCostBasis - amount); 
          
          const currentPrice = currentQty > 0 ? parseFloat(toAccount.balance) / currentQty : 0;
          const newEstimatedValue = newQty * currentPrice;

          await ctx.db.patch(toAccount._id, {
            quantity: newQty,
            totalCostBasis: newCostBasis,
            balance: newEstimatedValue.toString(),
          });
        }
        else if (isFromAsset && !isToAsset) {
          const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
          await ctx.db.patch(toAccount._id, { balance: (toBalance - amount).toString() });

          const currentQty = fromAccount.quantity ?? parseFloat(fromAccount.initialQuantity || '0');
          const currentCostBasis = fromAccount.totalCostBasis ?? 0;

          const newQty = currentQty + quantity;
          const newCostBasis = currentCostBasis + amount; 
          const currentPrice = currentQty > 0 ? parseFloat(fromAccount.balance) / currentQty : 0;
          const newEstimatedValue = newQty * currentPrice;

          await ctx.db.patch(fromAccount._id, {
            quantity: newQty,
            totalCostBasis: newCostBasis, 
            balance: newEstimatedValue.toString(),
          });
        }
      } else {
        const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
        const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));

        await ctx.db.patch(fromAccount._id, { balance: (fromBalance + amount).toString() });
        await ctx.db.patch(toAccount._id, { balance: (toBalance - amount).toString() });
      }

    } else {
      const account = await ctx.db.get(transaction.accountId);
      if (!account) throw new Error('Account not found');

      const balance = parseFloat(account.balance.replace(/,/g, ''));
      let newBalance;
      if (transaction.type === TRANSACTION_TYPES.INCOME) {
        newBalance = balance - amount;
      } else { 
        newBalance = balance + amount;
      }
      await ctx.db.patch(account._id, { balance: newBalance.toString() });
    }

    await ctx.db.delete(args.id);

    if (transaction.categoryId) {
        await checkGoalProgress(ctx, transaction.categoryId, transaction.householdId, transaction.userId);
    }

    await recomputeUserCache(ctx, identity.subject, transaction.householdId);
  },
});

export const forgiveReceivable = mutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const transaction = await ctx.db.get(args.id);
    if (!transaction) throw new Error("Transaction not found");

    if (transaction.householdId) {
      await ensureHouseholdAccess(ctx, transaction.householdId, identity.subject);
    } else {
      if (transaction.userId !== identity.subject) throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.id, { 
        reimbursementStatus: 'forgiven',
        settlementStatus: 'settled'
    });
  },
});

async function checkGoalProgress(ctx: MutationCtx, categoryId: Id<"categories">, householdId: Id<"households"> | undefined, userId: string) {
    const category = await ctx.db.get(categoryId);
    
    if (!category || category.type !== CATEGORY_TYPES.SAVING || !category.targetAmount) {
        return;
    }

    let transactions;
    if (householdId) {
        transactions = await ctx.db.query("transactions")
            .withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        transactions = await ctx.db.query("transactions")
            .withIndex("by_userId", q => q.eq("userId", userId)).collect();
    }

    let accounts;
    if (householdId) {
        accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        accounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", userId)).collect();
    }
    const accountsMap: AccountMap = new Map(accounts.map(a => [String(a._id), a]));

    const spendingMap = calculateSpendingByCategory(transactions, accountsMap);
    const accumulated = spendingMap[categoryId] || 0;

    const target = parseFloat(category.targetAmount.replace(/,/g, ''));

    const existingNotif = await ctx.db.query("notifications")
        .withIndex("by_userId", q => q.eq("userId", userId))
        .filter(q => q.eq(q.field("type"), NOTIFICATION_TYPES.GOAL_REACHED))
        .collect();
    
    const specificNotif = existingNotif.find(n => String(n.data?.categoryId) === String(categoryId));

    if (accumulated >= target) {
        if (category.status === GOAL_STATUS.ACHIEVED) {
             return;
        }
        
        if (!specificNotif) {
             await ctx.db.insert("notifications", {
                userId,
                householdId,
                type: NOTIFICATION_TYPES.GOAL_REACHED,
                title: "Goal Achieved! 🎉",
                message: `You've reached your target for ${category.name}. Click here to process your goal funds.`,
                data: { categoryId: categoryId },
                isRead: false,
                createdAt: Date.now(),
            });
        }
    } else {
        // Regression: Goal is no longer met (e.g. transaction deleted)
        // If there was a notification, remove it so it can trigger again later.
        if (specificNotif) {
            await ctx.db.delete(specificNotif._id);
        }
    }
}
