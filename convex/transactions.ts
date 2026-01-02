import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { calculateSpendingByCategory, AccountMap } from "./lib/finance";
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
    householdId?: Id<"households">
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

    if (!existingBudget) {
        // Auto-create Budget with the transaction amount to prevent "Over Budget" alarm
        await ctx.db.insert("budgets", {
            userId,
            householdId,
            categoryId,
            amount: amount.replace(/,/g, ''), 
            year,
            month,
        });
    }
}

export const get = query({
  args: {
    householdId: v.optional(v.id("households")),
    type: v.optional(v.string()),
    accountId: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    labelId: v.optional(v.string()),
    dateRange: v.optional(v.object({
      start: v.optional(v.string()),
      end: v.optional(v.string()),
    })),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { householdId, accountId, categoryId, labelId, dateRange, paginationOpts } = args;
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

    if (accountId) {
      query = query.filter((q) => q.eq(q.field("accountId"), accountId));
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
    
    if (labelId || categoryId) {
        filteredResults = allCandidates.filter(t => {
            const mainMatchesLabel = !labelId || String(t.labelId) === String(labelId);
            const mainMatchesCat = !categoryId || String(t.categoryId) === String(categoryId);
            const isMainMatch = mainMatchesLabel && mainMatchesCat;

            const hasMatchingSplit = t.splits?.some(s => {
                const splitMatchesLabel = !labelId || String(s.labelId) === String(labelId);
                const splitMatchesCat = !categoryId || String(s.categoryId) === String(categoryId);
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
    
    const pageWithDetails = await Promise.all(
      pageResults.map(async (transaction) => {
        const fromAccount = await ctx.db.get(transaction.accountId);
        const toAccount = transaction.toAccountId
          ? await ctx.db.get(transaction.toAccountId)
          : null;

        const label = transaction.labelId
          ? await ctx.db.get(transaction.labelId)
          : null;

        const category = transaction.categoryId
          ? await ctx.db.get(transaction.categoryId)
          : null;

        const splitsWithDetails = transaction.splits 
          ? await Promise.all(transaction.splits.map(async (split) => {
              const splitCategory = await ctx.db.get(split.categoryId);
              const splitLabel = split.labelId ? await ctx.db.get(split.labelId) : null;
              
              return {
                ...split,
                categoryName: splitCategory?.name,
                labelName: splitLabel?.name,
                labelColor: splitLabel?.color,
              };
            }))
          : undefined;

        return {
          ...transaction,
          fromAccountName: fromAccount?.name,
          toAccountName: toAccount?.name,
          categoryName: category?.name,
          label: label,
          splits: splitsWithDetails,
        };
      })
    );

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
    });

    if (args.isSplit && args.splits) {
        for (const split of args.splits) {
            await ensureBudgetExists(ctx, split.categoryId, args.date, identity.subject, split.amount, args.householdId);
        }
    } 
    else if ((args.type === TRANSACTION_TYPES.EXPENSE || args.type === TRANSACTION_TYPES.SAVING) && finalCategoryId) {
        await ensureBudgetExists(ctx, finalCategoryId as Id<"categories">, args.date, identity.subject, args.amount, args.householdId);
    }
    else if (args.type === TRANSACTION_TYPES.TRANSFER && finalCategoryId) {
         await ensureBudgetExists(ctx, finalCategoryId as Id<"categories">, args.date, identity.subject, args.amount, args.householdId);
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

    // --- AUTO-CATEGORIZE Logic for Update ---
    if (newTx.type === TRANSACTION_TYPES.TRANSFER && newTx.toAccountId && !finalCategoryId) {
        const destAccount = await ctx.db.get(newTx.toAccountId as Id<"accounts">);
        if (destAccount?.linkedCategoryId) {
            finalCategoryId = destAccount.linkedCategoryId;
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

    await ctx.db.patch(id, { ...rest, categoryId: finalCategoryId });

    if (newTx.isSplit && newTx.splits) {
        for (const split of newTx.splits) {
            await ensureBudgetExists(ctx, split.categoryId, newTx.date, identity.subject, split.amount, newTx.householdId);
        }
    }
    else if ((newTx.type === TRANSACTION_TYPES.EXPENSE || newTx.type === TRANSACTION_TYPES.SAVING) && newTx.categoryId) {
        await ensureBudgetExists(ctx, newTx.categoryId, newTx.date, identity.subject, newTx.amount, newTx.householdId);
    }
    else if (newTx.type === TRANSACTION_TYPES.TRANSFER && newTx.categoryId) {
         await ensureBudgetExists(ctx, newTx.categoryId, newTx.date, identity.subject, newTx.amount, newTx.householdId);
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
    const accountsMap: AccountMap = new Map(accounts.map(a => [a._id, a]));

    const spendingMap = calculateSpendingByCategory(transactions, accountsMap);
    const accumulated = spendingMap[categoryId] || 0;

    const target = parseFloat(category.targetAmount.replace(/,/g, ''));

    if (accumulated >= target) {
        
        if (category.status === GOAL_STATUS.ACHIEVED) {
             return;
        }

        const existingNotif = await ctx.db.query("notifications")
            .withIndex("by_userId", q => q.eq("userId", userId))
            .filter(q => q.eq(q.field("type"), NOTIFICATION_TYPES.GOAL_REACHED))
            .collect();
        
        const hasNotified = existingNotif.some(n => String(n.data?.categoryId) === String(categoryId));
        
        if (!hasNotified) {
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
    }
}
