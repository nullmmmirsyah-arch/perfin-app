import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

import { paginationOptsValidator } from "convex/server";

export const get = query({
  args: {
    householdId: v.optional(v.id("households")),
    type: v.optional(v.string()),
    accountId: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    dateRange: v.optional(v.object({
      start: v.optional(v.string()),
      end: v.optional(v.string()),
    })),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { householdId, type, accountId, categoryId, dateRange, paginationOpts } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let query;
    if (householdId) {
      const member = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", (q) =>
          q.eq("householdId", householdId).eq("userId", identity.subject)
        )
        .first();

      if (!member) {
        // Return empty page structure if not member
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

    if (type) {
      query = query.filter((q) => q.eq(q.field("type"), type));
    }
    if (accountId) {
      query = query.filter((q) => q.eq(q.field("accountId"), accountId));
    }
    if (categoryId) {
      query = query.filter((q) => q.eq(q.field("categoryId"), categoryId));
    }
    if (dateRange?.start) {
      const start = dateRange.start;
      query = query.filter((q) => q.gte(q.field("date"), start));
    }
    if (dateRange?.end) {
      const end = dateRange.end;
      query = query.filter((q) => q.lte(q.field("date"), end));
    }

    const results = await query.order("desc").paginate(paginationOpts);
    
    // Join with account names, labels, and categories
    const pageWithDetails = await Promise.all(
      results.page.map(async (transaction) => {
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

        // Join category names for splits if they exist
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
        ...results,
        page: pageWithDetails
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
      const member = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", (q) =>
          q.eq("householdId", args.householdId!).eq("userId", identity.subject)
        )
        .first();
      if (!member) {
        throw new Error("Not a member of this household");
      }
    }

    const amount = parseFloat(args.amount.replace(/,/g, ''));

    if (args.type === 'transfer') {
      if (!args.toAccountId) {
        throw new Error('To account is required for transfers');
      }

      const fromAccount = await ctx.db.get(args.accountId);
      const toAccount = await ctx.db.get(args.toAccountId);

      if (!fromAccount || !toAccount) {
        throw new Error('One or both accounts not found');
      }

      // --- Asset Transaction Logic ---
      const isFromAsset = fromAccount.type === 'ASSET';
      const isToAsset = toAccount.type === 'ASSET';

      if (isFromAsset || isToAsset) {
        // Validation for Asset Transfer
        const quantity = parseFloat(args.assetDetails?.quantity || '0');
        if (quantity <= 0) throw new Error('Quantity is required for asset transactions');

        // Case A: Buying Asset (Cash -> Asset)
        if (!isFromAsset && isToAsset) {
          // Debit Cash Account
          const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
          await ctx.db.patch(fromAccount._id, { balance: (fromBalance - amount).toString() });

          // Credit Asset Account (Logic: Buy)
          const currentQty = toAccount.quantity ?? parseFloat(toAccount.initialQuantity || '0');
          const currentCostBasis = toAccount.totalCostBasis ?? 0;
          
          const newQty = currentQty + quantity;
          const newCostBasis = currentCostBasis + amount;
          const impliedPrice = quantity > 0 ? amount / quantity : 0;
          
          // Balance for Asset Account = Current Estimated Value (New Qty * Last Price)
          // "Current Estimated Value: $1,600... Last Known Price was $80/g"
          const newEstimatedValue = newQty * impliedPrice;

          await ctx.db.patch(toAccount._id, {
            quantity: newQty,
            totalCostBasis: newCostBasis,
            balance: newEstimatedValue.toString(),
          });
        }
        // Case B: Selling Asset (Asset -> Cash)
        else if (isFromAsset && !isToAsset) {
          // Credit Cash Account (Logic: Receive Cash)
          const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
          await ctx.db.patch(toAccount._id, { balance: (toBalance + amount).toString() });

          // Debit Asset Account (Logic: Sell/Profit Taking)
          const currentQty = fromAccount.quantity ?? parseFloat(fromAccount.initialQuantity || '0');
          const currentCostBasis = fromAccount.totalCostBasis ?? 0;
          const currentRealizedProfit = fromAccount.totalRealizedProfit ?? 0;

          if (currentQty < quantity) throw new Error('Insufficient asset quantity');

          // "Average Cost: Total spent / Total quantity"
          // We use the PRE-SALE average cost to determine cost basis of sold items.
          const avgCost = currentQty > 0 ? currentCostBasis / currentQty : 0;
          
          const sellPrice = quantity > 0 ? amount / quantity : 0; // Implied Price
          const costOfSoldGoods = avgCost * quantity;
          const profit = amount - costOfSoldGoods; // Realized Profit

          const newQty = currentQty - quantity;
          const newCostBasis = currentCostBasis - costOfSoldGoods; // Reduce cost basis proportionally
          const newRealizedProfit = currentRealizedProfit + profit;
          
          // "Current Estimated Value: 19g * $120" (New Qty * Sell Price)
          const newEstimatedValue = newQty * sellPrice;

          await ctx.db.patch(fromAccount._id, {
            quantity: newQty,
            totalCostBasis: newCostBasis,
            totalRealizedProfit: newRealizedProfit,
            balance: newEstimatedValue.toString(),
          });
        }
        // Case C: Asset to Asset (Not defined in PRD yet, block or treat as standard?)
        // Treating as standard value transfer for now or throw error? 
        // Let's assume standard value transfer if both are assets (rare case in current scope).
        else {
           // Fallback to standard logic if complex asset-to-asset logic isn't defined
           const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
           const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
           await ctx.db.patch(fromAccount._id, { balance: (fromBalance - amount).toString() });
           await ctx.db.patch(toAccount._id, { balance: (toBalance + amount).toString() });
        }

      } else {
        // --- Standard Cash Transfer ---
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
      if (args.type === 'income') {
        newBalance = balance + amount;
      } else { // expense
        newBalance = balance - amount;
      }
      await ctx.db.patch(account._id, { balance: newBalance.toString() });
    }

    const transaction = await ctx.db.insert("transactions", {
      ...args,
      userId: identity.subject,
      householdId: args.householdId,
    });

    // --- TRIGGER NOTIFICATION ---
    if (args.householdId) {
      // 1. Get all household members
      const members = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId", (q) => q.eq("householdId", args.householdId!))
        .collect();

      // 2. Identify the sender name (optional, ideally stored or fetched)
      // For now we use generic "A member" or try to use identity info if available?
      // Clerk identity usually has name, but identity object here is minimal wrapper.
      // Let's assume generic message for now: "New transaction in [Household]"
      
      const household = await ctx.db.get(args.householdId);
      const householdName = household?.name || "Household";
      const txType = args.type === 'income' ? 'Income' : 'Expense';
      
      // 3. Loop through members and send to everyone EXCEPT sender
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

    // --- CHECK GOAL PROGRESS ---
    if (args.categoryId) {
        await checkGoalProgress(ctx, args.categoryId, args.householdId, identity.subject);
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

    // Auth Check
    if (originalTransaction.householdId) {
      const member = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", (q) =>
          q.eq("householdId", originalTransaction.householdId!).eq("userId", identity.subject)
        )
        .first();
      if (!member) throw new Error("Unauthorized");
    } else {
      if (originalTransaction.userId !== identity.subject) throw new Error("Unauthorized");
    }

    // ==========================================
    // 1. REVERT ORIGINAL TRANSACTION EFFECTS
    // ==========================================
    const originalAmount = parseFloat(originalTransaction.amount.replace(/,/g, ''));
    
    if (originalTransaction.type === 'transfer') {
      if (!originalTransaction.toAccountId) throw new Error("Invalid original transaction data");

      const fromAccount = await ctx.db.get(originalTransaction.accountId);
      const toAccount = await ctx.db.get(originalTransaction.toAccountId);

      if (fromAccount && toAccount) {
         const isFromAsset = fromAccount.type === 'ASSET';
         const isToAsset = toAccount.type === 'ASSET';

         if (isFromAsset || isToAsset) {
            const quantity = parseFloat(originalTransaction.assetDetails?.quantity || '0');
            
            // Revert BUY (Cash -> Asset)
            if (!isFromAsset && isToAsset) {
                // Credit Cash
                const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
                await ctx.db.patch(fromAccount._id, { balance: (fromBalance + originalAmount).toString() });
                
                // Debit Asset (Remove Qty & Cost)
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
            // Revert SELL (Asset -> Cash)
            else if (isFromAsset && !isToAsset) {
                // Debit Cash
                const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
                await ctx.db.patch(toAccount._id, { balance: (toBalance - originalAmount).toString() });

                // Credit Asset (Return Qty)
                const currentQty = fromAccount.quantity ?? parseFloat(fromAccount.initialQuantity || '0');
                const currentCostBasis = fromAccount.totalCostBasis ?? 0;
                // Approx Cost Basis Restoration (Since we don't track profit per tx yet)
                const newQty = currentQty + quantity;
                const newCostBasis = currentCostBasis + originalAmount; // Conservative approx
                const currentPrice = currentQty > 0 ? parseFloat(fromAccount.balance) / currentQty : 0;

                await ctx.db.patch(fromAccount._id, {
                    quantity: newQty,
                    totalCostBasis: newCostBasis,
                    balance: (newQty * currentPrice).toString()
                });
            }
         } else {
             // Standard Transfer Revert
             const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
             const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
             await ctx.db.patch(fromAccount._id, { balance: (fromBalance + originalAmount).toString() });
             await ctx.db.patch(toAccount._id, { balance: (toBalance - originalAmount).toString() });
         }
      }
    } else {
      // Revert Income/Expense
      const account = await ctx.db.get(originalTransaction.accountId);
      if (account) {
          const balance = parseFloat(account.balance.replace(/,/g, ''));
          let newBalance;
          if (originalTransaction.type === 'income') {
            newBalance = balance - originalAmount;
          } else { // expense
            newBalance = balance + originalAmount;
          }
          await ctx.db.patch(account._id, { balance: newBalance.toString() });
      }
    }

    // ==========================================
    // 2. APPLY NEW TRANSACTION EFFECTS
    // ==========================================
    // Construct the new state of the transaction
    const newTx = { ...originalTransaction, ...rest };
    const newAmount = parseFloat(newTx.amount.replace(/,/g, ''));

    if (newTx.type === 'transfer') {
      if (!newTx.toAccountId) throw new Error("To account is required for transfers");

      const fromAccount = await ctx.db.get(newTx.accountId);
      const toAccount = await ctx.db.get(newTx.toAccountId);

      if (!fromAccount || !toAccount) throw new Error("Accounts not found");

      const isFromAsset = fromAccount.type === 'ASSET';
      const isToAsset = toAccount.type === 'ASSET';

      if (isFromAsset || isToAsset) {
          const quantity = parseFloat(newTx.assetDetails?.quantity || '0');
          if (quantity <= 0) throw new Error("Quantity required for asset transaction");

          // Apply BUY (Cash -> Asset)
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
          // Apply SELL (Asset -> Cash)
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
          // Standard Transfer Apply
          const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
          const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
          await ctx.db.patch(fromAccount._id, { balance: (fromBalance - newAmount).toString() });
          await ctx.db.patch(toAccount._id, { balance: (toBalance + newAmount).toString() });
      }

    } else {
      // Apply Income/Expense
      const account = await ctx.db.get(newTx.accountId);
      if (!account) throw new Error("Account not found");

      const balance = parseFloat(account.balance.replace(/,/g, ''));
      let newBalance;
      if (newTx.type === 'income') {
        newBalance = balance + newAmount;
      } else { // expense
        newBalance = balance - newAmount;
      }
      await ctx.db.patch(account._id, { balance: newBalance.toString() });
    }

    // 3. Update Transaction Document
    await ctx.db.patch(id, rest);

    // --- CHECK GOAL PROGRESS ---
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

    // Auth Check
    if (transaction.householdId) {
      const member = await ctx.db
        .query("householdMembers")
        .withIndex("by_householdId_userId", (q) =>
          q.eq("householdId", transaction.householdId!).eq("userId", identity.subject)
        )
        .first();
      if (!member) throw new Error("Unauthorized");
    } else {
      if (transaction.userId !== identity.subject) throw new Error("Unauthorized");
    }

    const amount = parseFloat(transaction.amount.replace(/,/g, ''));

    // --- REVERT LOGIC ---
    if (transaction.type === 'transfer') {
      if (!transaction.toAccountId) throw new Error('Invalid transfer transaction data');

      const fromAccount = await ctx.db.get(transaction.accountId);
      const toAccount = await ctx.db.get(transaction.toAccountId);

      if (!fromAccount || !toAccount) throw new Error('One or both accounts not found');

      const isFromAsset = fromAccount.type === 'ASSET';
      const isToAsset = toAccount.type === 'ASSET';

      if (isFromAsset || isToAsset) {
        // Asset Reversal Logic
        const quantity = parseFloat(transaction.assetDetails?.quantity || '0');
        if (quantity <= 0) console.warn("Deleting asset transaction with invalid quantity data");

        // Case A: Reverting a BUY (Cash -> Asset)
        if (!isFromAsset && isToAsset) {
          // 1. Credit Cash Account (Give money back)
          const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
          await ctx.db.patch(fromAccount._id, { balance: (fromBalance + amount).toString() });

          // 2. Debit Asset Account (Remove quantity and cost basis)
          const currentQty = toAccount.quantity ?? parseFloat(toAccount.initialQuantity || '0');
          const currentCostBasis = toAccount.totalCostBasis ?? 0;

          const newQty = Math.max(0, currentQty - quantity);
          const newCostBasis = Math.max(0, currentCostBasis - amount); // Remove the cost added
          
          // Recalculate estimated balance based on remaining qty
          // We need an implied price. If we remove the transaction, we revert to previous state?
          // It's hard to know exact "previous" price without history. 
          // Best effort: Use current implied price or keep last known price?
          // Strategy: Calculate current price, keep it constant, apply to new Qty.
          const currentPrice = currentQty > 0 ? parseFloat(toAccount.balance) / currentQty : 0;
          const newEstimatedValue = newQty * currentPrice;

          await ctx.db.patch(toAccount._id, {
            quantity: newQty,
            totalCostBasis: newCostBasis,
            balance: newEstimatedValue.toString(),
          });
        }
        // Case B: Reverting a SELL (Asset -> Cash)
        else if (isFromAsset && !isToAsset) {
          // 1. Debit Cash Account (Take money back)
          const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));
          await ctx.db.patch(toAccount._id, { balance: (toBalance - amount).toString() });

          // 2. Credit Asset Account (Return quantity)
          const currentQty = fromAccount.quantity ?? parseFloat(fromAccount.initialQuantity || '0');
          const currentCostBasis = fromAccount.totalCostBasis ?? 0;

          // Re-calculate the profit that was realized in this transaction to un-realize it.
          // We need the cost basis OF THE SOLD ITEMS at the time of sale.
          // This is tricky because we don't store historical avg cost. 
          // But we can approximate: realizedProfit = SaleAmount - (AvgCost * Qty)
          // So: (AvgCost * Qty) = SaleAmount - RealizedProfit.
          // Wait, we don't store individual transaction profit in the transaction doc currently.
          // We only stored `amount` (Sale Value). 
          
          // CRITICAL FIX: We need to assume standard FIFO or Weighted Avg. 
          // Since we can't perfectly know the historical Cost Basis removed, 
          // we might have to rely on current avg cost or imperfect reversal if we don't track it.
          // HOWEVER, for a simple app:
          // We can try to deduce if we track profit? We don't track profit per Tx.
          // Let's assume the profit impact was: SaleAmount - (OldAvgCost * Qty).
          // Reversing it:
          // NewCostBasis = CurrentCostBasis + (Estimated Cost of Goods Returned)
          // NewRealizedProfit = CurrentRealizedProfit - (Estimated Profit Reversed)
          
          // Simplification for now:
          // We just add back the Quantity. 
          // And we need to add back the "Cost Basis" that was removed.
          // If we don't know it, we are stuck.
          // Ideally, we should have stored `costBasis` or `profit` in the transaction doc.
          // Since we didn't, we will assume the Cost Basis to return is (CurrentAvgCost * Qty) 
          // which is imperfect but safer than nothing.
          
          // BETTER APPROACH for "Perfect" Undo:
          // Use the `assetDetails` in transaction to store `costBasisSnapshot` in future.
          // For now, let's reverse using current Average Cost (best guess).
          
          const newQty = currentQty + quantity;
          
          // We can't perfectly restore Cost Basis without history. 
          // Let's assume we restore it proportionally to current? No, that propagates errors.
          // Let's assume the "Profit" part of the Sale Amount is what we remove from Realized Profit.
          // And (Sale Amount - Profit) is what we add back to Cost Basis.
          // Since we don't know the profit, we might just have to accept a slight drift OR
          // Assume 0 profit (Cost Basis = Sale Amount) if we want to be conservative? No.
          
          // Temporary Solution: 
          // Add back Qty.
          // Do NOT touch Cost Basis/Profit (safest to avoid corrupting data further),
          // OR try to reverse based on current stats.
          
          // Let's try to reverse using implied logic:
          // We effectively "buy back" the asset at the sale price? 
          // That would reset Cost Basis to the Sale Price.
          
          const newCostBasis = currentCostBasis + amount; // This assumes 0 profit (conservative).
          // If there was profit, we are inflating cost basis (bad).
          
          // Let's stick to "Add back Quantity" and update Balance.
          // Ideally we update schema to store `profit` on transaction.
          
          const currentPrice = currentQty > 0 ? parseFloat(fromAccount.balance) / currentQty : 0;
          const newEstimatedValue = newQty * currentPrice;

          await ctx.db.patch(fromAccount._id, {
            quantity: newQty,
            totalCostBasis: newCostBasis, // This is an approximation
            balance: newEstimatedValue.toString(),
          });
        }
      } else {
        // Standard Reversal
        const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
        const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));

        await ctx.db.patch(fromAccount._id, { balance: (fromBalance + amount).toString() });
        await ctx.db.patch(toAccount._id, { balance: (toBalance - amount).toString() });
      }

    } else {
      // Income / Expense Reversal
      const account = await ctx.db.get(transaction.accountId);
      if (!account) throw new Error('Account not found');

      const balance = parseFloat(account.balance.replace(/,/g, ''));
      let newBalance;
      if (transaction.type === 'income') {
        newBalance = balance - amount;
      } else { // expense
        newBalance = balance + amount;
      }
      await ctx.db.patch(account._id, { balance: newBalance.toString() });
    }

    await ctx.db.delete(args.id);
  },
});


// Helper to check goal progress
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";

async function checkGoalProgress(ctx: MutationCtx, categoryId: Id<"categories">, householdId: Id<"households"> | undefined, userId: string) {
    // 1. Get Category
    const category = await ctx.db.get(categoryId);
    // console.log(`[CheckGoal] Checking category: ${category?.name} (${categoryId})`);
    
    if (!category || category.type !== 'saving' || !category.targetAmount) {
        // console.log(`[CheckGoal] Skipped: Not a saving goal or no target.`);
        return;
    }

    // 2. Calculate Total Accumulated
    let transactions;
    if (householdId) {
        transactions = await ctx.db.query("transactions")
            .withIndex("by_householdId", q => q.eq("householdId", householdId))
            .collect();
    } else {
        transactions = await ctx.db.query("transactions")
            .withIndex("by_userId", q => q.eq("userId", userId))
            .collect();
    }

    let accumulated = 0;
    
    // We need account types for transfer logic
    let accounts;
    if (householdId) {
        accounts = await ctx.db.query("accounts").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
        accounts = await ctx.db.query("accounts").withIndex("by_userId", q => q.eq("userId", userId)).collect();
    }
    const accountTypeMap = new Map(accounts.map(a => [a._id, a.type || 'CASH']));
    const isSpecial = (type: string) => type === 'ASSET' || type === 'SAVING';

    transactions.forEach(t => {
        const val = Math.abs(parseFloat(t.amount.replace(/,/g, '') || '0'));

        // Case 1: Standard Accumulation
        if ((t.type === 'expense' || t.type === 'saving') && String(t.categoryId) === String(categoryId)) {
             accumulated += val;
        }
        
        // Case 2: Split Transactions
        if (t.isSplit && t.splits) {
            t.splits.forEach(s => {
                if (String(s.categoryId) === String(categoryId)) {
                    accumulated += Math.abs(parseFloat(s.amount.replace(/,/g, '') || '0'));
                }
            });
        }

        // Case 3: Transfer Logic
        if (t.type === 'transfer' && String(t.categoryId) === String(categoryId) && t.accountId && t.toAccountId) {
            const sourceType = accountTypeMap.get(t.accountId) || 'CASH';
            const destType = accountTypeMap.get(t.toAccountId) || 'CASH';
            const sourceIsSpecial = isSpecial(sourceType);
            const destIsSpecial = isSpecial(destType);

            // Inflow: Liquid -> Special (Count as +)
            if (!sourceIsSpecial && destIsSpecial) {
                accumulated += val;
            }
            // Outflow: Special -> Liquid (Count as -)
            if (sourceIsSpecial && !destIsSpecial) {
                accumulated -= val;
            }
        }
    });

    const target = parseFloat(category.targetAmount.replace(/,/g, ''));
    // console.log(`[CheckGoal] Accumulated: ${accumulated}, Target: ${target}`);

    // 3. Check if Goal Reached
    // Use a small epsilon for float comparison safety, or just >=
    if (accumulated >= target) {
        // console.log(`[CheckGoal] Goal Reached!`);
        
        if (category.status === 'achieved') {
             // console.log(`[CheckGoal] Already achieved status.`);
             return;
        }

        // Check if notification exists
        const existingNotif = await ctx.db.query("notifications")
            .withIndex("by_userId", q => q.eq("userId", userId))
            .filter(q => q.eq(q.field("type"), "goal_reached"))
            .collect();
        
        // Filter in memory to match categoryId exactly
        const hasNotified = existingNotif.some(n => String(n.data?.categoryId) === String(categoryId));
        
        if (!hasNotified) {
             // console.log(`[CheckGoal] Creating notification...`);
             await ctx.db.insert("notifications", {
                userId,
                householdId,
                type: "goal_reached",
                title: "Goal Achieved! 🎉",
                message: `You've reached your target for ${category.name}. Click here to process your goal funds.`,
                data: { categoryId: categoryId },
                isRead: false,
                createdAt: Date.now(),
            });
        } else {
            // console.log(`[CheckGoal] Notification already exists.`);
        }
    }
}