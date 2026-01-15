import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { calculateSpendingByCategory, AccountMap, analyzeTransactionFlow } from "./lib/finance";
import { checkHouseholdAccess, ensureHouseholdAccess } from "./lib/auth";
import { 
  TRANSACTION_TYPES, 
  CATEGORY_TYPES, 
  ACCOUNT_TYPES, 
  NOTIFICATION_TYPES,
  GOAL_STATUS
} from "./lib/constants";

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
    const date = new Date(dateStr);
    const month = date.getMonth();
    const year = date.getFullYear();

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
        
        // 1. Calculate current spending for this category in this month
        const startOfMonth = new Date(year, month, 1).toISOString();
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
        
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

    // Helper to get totals for a specific date range
    const getPeriodTotal = async (start: string, end: string) => {
        let query;
        if (householdId) {
            if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) return 0;
            query = ctx.db.query("transactions").withIndex("by_householdId_date", q => q.eq("householdId", householdId));
        } else {
            query = ctx.db.query("transactions").withIndex("by_userId_date", q => q.eq("userId", identity.subject));
        }

        // Apply Date Filter
        query = query.filter(q => q.gte(q.field("date"), start)).filter(q => q.lte(q.field("date"), end));

        // Apply Other Filters (Same as main get query logic)
        // Ensure we only count Expenses for trend
        query = query.filter(q => q.eq(q.field("type"), TRANSACTION_TYPES.EXPENSE));

        if (accountId && accountId.length > 0) {
             query = query.filter((q) => 
                q.or(
                   q.or(...accountId.map(a => q.eq(q.field("accountId"), a))),
                   q.or(...accountId.map(a => q.eq(q.field("toAccountId"), a)))
                )
             );
        }

        const transactions = await query.collect();

        // JS Filter for Category/Label & Summation
        return transactions.reduce((acc, t) => {
            // JS Filter Check
            const mainMatchesLabel = !labelId || labelId.length === 0 || (t.labelId && labelId.includes(t.labelId));
            const mainMatchesCat = !categoryId || categoryId.length === 0 || (t.categoryId && categoryId.includes(t.categoryId));
            
            // Note: For trend, we simplify split logic. We sum the main amount if matches, 
            // OR if it's split, we sum the matching splits.
            
            let amountToAdd = 0;
            if (t.isSplit && t.splits) {
                 amountToAdd = t.splits.reduce((sAcc, s) => {
                    const splitMatchesLabel = !labelId || labelId.length === 0 || (s.labelId && labelId.includes(s.labelId));
                    const splitMatchesCat = !categoryId || categoryId.length === 0 || (s.categoryId && categoryId.includes(s.categoryId));
                    if (splitMatchesLabel && splitMatchesCat) {
                        return sAcc + parseFloat(s.amount.replace(/,/g, '') || '0');
                    }
                    return sAcc;
                 }, 0);
            } else if (mainMatchesLabel && mainMatchesCat) {
                 amountToAdd = parseFloat(t.amount.replace(/,/g, '') || '0');
            }

            return acc + amountToAdd;
        }, 0);
    };

    // 1. Calculate Current Period
    const currentStart = dateRange?.start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const currentEnd = dateRange?.end || new Date().toISOString();
    const currentTotal = await getPeriodTotal(currentStart, currentEnd);

    // 2. Calculate Previous Period (Same Duration Shifted Back)
    const startObj = new Date(currentStart);
    const endObj = new Date(currentEnd);
    const duration = endObj.getTime() - startObj.getTime();
    
    // Shift back by duration (e.g., last 30 days -> prev 30 days)
    const prevEndObj = new Date(startObj.getTime() - 1); // 1ms before current start
    const prevStartObj = new Date(prevEndObj.getTime() - duration);
    
    const prevTotal = await getPeriodTotal(prevStartObj.toISOString(), prevEndObj.toISOString());

    // 3. Calculate Percentage
    let percentage = 0;
    if (prevTotal > 0) {
        percentage = ((currentTotal - prevTotal) / prevTotal) * 100;
    } else if (currentTotal > 0) {
        percentage = 100; // From 0 to something is 100% increase (technically infinite, but cap for UI)
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
    dateRange: v.optional(v.object({
      start: v.optional(v.string()),
      end: v.optional(v.string()),
    })),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { householdId, type, accountId, categoryId, labelId, dateRange, paginationOpts } = args;
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
    
    if (dateRange?.start) {
      const start = dateRange.start;
      query = query.filter((q) => q.gte(q.field("date"), start));
    }
    if (dateRange?.end) {
      const end = dateRange.end;
      query = query.filter((q) => q.lte(q.field("date"), end));
    }

    // Manual Pagination & Filtering Logic to support Split Labels
    const allCandidates = await query.order("desc").collect();

    let filteredResults = allCandidates;
    
    // JS Filtering for Category & Label (handling Splits & Multi-Select)
    if ((labelId && labelId.length > 0) || (categoryId && categoryId.length > 0)) {
        filteredResults = allCandidates.filter(t => {
            // Check Main Transaction
            const mainMatchesLabel = !labelId || labelId.length === 0 || (t.labelId && labelId.includes(t.labelId));
            const mainMatchesCat = !categoryId || categoryId.length === 0 || (t.categoryId && categoryId.includes(t.categoryId));
            const isMainMatch = mainMatchesLabel && mainMatchesCat;

            // Check Splits
            const hasMatchingSplit = t.splits?.some(s => {
                const splitMatchesLabel = !labelId || labelId.length === 0 || (s.labelId && labelId.includes(s.labelId));
                const splitMatchesCat = !categoryId || categoryId.length === 0 || (s.categoryId && categoryId.includes(s.categoryId));
                return splitMatchesLabel && splitMatchesCat;
            });

            return isMainMatch || hasMatchingSplit;
        });
    }

    const cursor = paginationOpts.cursor ? parseInt(paginationOpts.cursor) : 0;
    const limit = paginationOpts.numItems;
    
    const pageResults = filteredResults.slice(cursor, cursor + limit);
    const isDone = cursor + limit >= filteredResults.length;
    const continueCursor = isDone ? "" : (cursor + limit).toString();

    // Batch fetch related entities to avoid N+1 queries
    const accountIds = new Set<Id<"accounts">>();
    const categoryIds = new Set<Id<"categories">>();
    const labelIds = new Set<Id<"labels">>();

    pageResults.forEach(t => {
      accountIds.add(t.accountId);
      if (t.toAccountId) accountIds.add(t.toAccountId);
      if (t.categoryId) categoryIds.add(t.categoryId);
      if (t.labelId) labelIds.add(t.labelId);
      
      t.splits?.forEach(s => {
        categoryIds.add(s.categoryId);
        if (s.labelId) labelIds.add(s.labelId);
      });
    });

    // Parallel fetch all unique related documents
    const [accounts, categories, labels] = await Promise.all([
      Promise.all(Array.from(accountIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(categoryIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(labelIds).map(id => ctx.db.get(id))),
    ]);

    const accountMap = new Map(accounts.filter(Boolean).map(a => [a!._id, a!]));
    const categoryMap = new Map(categories.filter(Boolean).map(c => [c!._id, c!]));
    const labelMap = new Map(labels.filter(Boolean).map(l => [l!._id, l!]));

    const pageWithDetails = pageResults.map((transaction) => {
      const fromAccount = accountMap.get(transaction.accountId);
      const toAccount = transaction.toAccountId ? accountMap.get(transaction.toAccountId) : null;
      const label = transaction.labelId ? labelMap.get(transaction.labelId) : null;
      const category = transaction.categoryId ? categoryMap.get(transaction.categoryId) : null;

      const splitsWithDetails = transaction.splits?.map((split) => {
        const splitCategory = categoryMap.get(split.categoryId);
        const splitLabel = split.labelId ? labelMap.get(split.labelId) : null;

        return {
          ...split,
          categoryName: splitCategory?.name,
          labelName: splitLabel?.name,
          labelColor: splitLabel?.color,
        };
      });

      return {
        ...transaction,
        fromAccountName: fromAccount?.name,
        toAccountName: toAccount?.name,
        categoryName: category?.name,
        label: label || null,
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
      labelId: v.optional(v.id("labels")),
    }))),
    labelId: v.optional(v.id("labels")),
    assetDetails: v.optional(v.object({
      quantity: v.string(),
      unitPrice: v.optional(v.number()),
    })),
    isGoalDisbursement: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (args.householdId) {
      await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
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
           await ctx.db.patch(fromAccount._id, { balance: (fromBalance - amount).toString() });
           await ctx.db.patch(toAccount._id, { balance: (toBalance + amount).toString() });
        }

      } else {
        const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
        const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));

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

    const transaction = await ctx.db.insert("transactions", {
      ...args,
      categoryId: finalCategoryId as Id<"categories"> | undefined,
      userId: identity.subject,
      householdId: args.householdId,
      isGoalDisbursement, // Use the auto-detected or provided flag
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
      labelId: v.optional(v.id("labels")),
    }))),
    labelId: v.optional(v.id("labels")),
    assetDetails: v.optional(v.object({
      quantity: v.string(),
      unitPrice: v.optional(v.number()),
    })),
    isGoalDisbursement: v.optional(v.boolean()),
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
          const quantity = parseFloat(newTx.assetDetails?.quantity || '0');
          if (quantity <= 0) throw new Error("Quantity required for asset transaction");

          if (!isFromAsset && isToAsset) {
              const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
              await ctx.db.patch(fromAccount._id, { balance: (fromBalance - newAmount).toString() });

              const currentQty = toAccount.quantity ?? parseFloat(toAccount.initialQuantity || '0');
              const currentCostBasis = toAccount.totalCostBasis ?? 0;
              const newQty = currentQty + quantity;
              const newCostBasis = currentCostBasis + newAmount;
              const impliedPrice = quantity > 0 ? newAmount / quantity : 0;
              
              await ctx.db.patch(toAccount._id, {
                  quantity: newQty,
                  totalCostBasis: newCostBasis,
                  balance: (newQty * impliedPrice).toString()
              });
          }
          else if (isFromAsset && !isToAsset) {
              const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
              await ctx.db.patch(toAccount._id, { balance: (toBalance + newAmount).toString() });

              const currentQty = fromAccount.quantity ?? parseFloat(fromAccount.initialQuantity || '0');
              const currentCostBasis = fromAccount.totalCostBasis ?? 0;
              const currentRealizedProfit = fromAccount.totalRealizedProfit ?? 0;

              if (currentQty < quantity) throw new Error("Insufficient asset quantity");

              const avgCost = currentQty > 0 ? currentCostBasis / currentQty : 0;
              const costOfSoldGoods = avgCost * quantity;
              const profit = newAmount - costOfSoldGoods;

              const newQty = currentQty - quantity;
              const newCostBasis = currentCostBasis - costOfSoldGoods;
              const newRealizedProfit = currentRealizedProfit + profit;
              const sellPrice = quantity > 0 ? newAmount / quantity : 0;

              await ctx.db.patch(fromAccount._id, {
                  quantity: newQty,
                  totalCostBasis: newCostBasis,
                  totalRealizedProfit: newRealizedProfit,
                  balance: (newQty * sellPrice).toString()
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

    await ctx.db.patch(id, { ...rest, categoryId: finalCategoryId, isGoalDisbursement });

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
          const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
          await ctx.db.patch(fromAccount._id, { balance: (fromBalance + amount).toString() });

          const currentQty = toAccount.quantity ?? parseFloat(toAccount.initialQuantity || '0');
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
