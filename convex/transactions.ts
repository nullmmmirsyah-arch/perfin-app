import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const get = query({
  args: {
    type: v.optional(v.string()),
    accountId: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    dateRange: v.optional(v.object({
      start: v.optional(v.string()),
      end: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { type, accountId, categoryId, dateRange }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let query = ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject));

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

    const transactions = await query.order("desc").collect();
    
    // Join with account names, labels, and categories
    const transactionsWithDetails = await Promise.all(
      transactions.map(async (transaction) => {
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
              return {
                ...split,
                categoryName: splitCategory?.name,
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

    return transactionsWithDetails;
  },
});

export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
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
    });
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

    const updatedTxData = { ...originalTransaction, ...rest };

    const accountBalances = new Map<Id<"accounts">, number>();

    const getAccountBalance = async (accountId: Id<"accounts">) => {
      if (accountBalances.has(accountId)) {
        return accountBalances.get(accountId)!;
      }
      const account = await ctx.db.get(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }
      const balance = parseFloat(account.balance.replace(/,/g, ''));
      accountBalances.set(accountId, balance);
      return balance;
    };

    // 1. Revert original transaction
    const originalAmount = parseFloat(originalTransaction.amount.replace(/,/g, ''));
    if (originalTransaction.type === 'transfer') {
      if (!originalTransaction.toAccountId) throw new Error("Invalid original transaction");
      const fromBalance = await getAccountBalance(originalTransaction.accountId);
      accountBalances.set(originalTransaction.accountId, fromBalance + originalAmount);

      const toBalance = await getAccountBalance(originalTransaction.toAccountId);
      accountBalances.set(originalTransaction.toAccountId, toBalance - originalAmount);
    } else {
      const balance = await getAccountBalance(originalTransaction.accountId);
      if (originalTransaction.type === 'income') {
        accountBalances.set(originalTransaction.accountId, balance - originalAmount);
      } else { // expense
        accountBalances.set(originalTransaction.accountId, balance + originalAmount);
      }
    }

    // 2. Apply new transaction to the potentially updated balances
    const newAmount = parseFloat(updatedTxData.amount.replace(/,/g, ''));
    if (updatedTxData.type === 'transfer') {
      if (!updatedTxData.toAccountId) throw new Error("Invalid updated transaction");
      const fromBalance = await getAccountBalance(updatedTxData.accountId);
      accountBalances.set(updatedTxData.accountId, fromBalance - newAmount);

      const toBalance = await getAccountBalance(updatedTxData.toAccountId);
      accountBalances.set(updatedTxData.toAccountId, toBalance + newAmount);
    } else {
      const balance = await getAccountBalance(updatedTxData.accountId);
      if (updatedTxData.type === 'income') {
        accountBalances.set(updatedTxData.accountId, balance + newAmount);
      } else { // expense
        accountBalances.set(updatedTxData.accountId, balance - newAmount);
      }
    }

    // 3. Patch all affected accounts
    for (const [accountId, balance] of accountBalances.entries()) {
      await ctx.db.patch(accountId, { balance: balance.toString() });
    }

    // 4. Patch the transaction document
    const transaction = await ctx.db.patch(id, rest);
    return transaction;
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

    const amount = parseFloat(transaction.amount.replace(/,/g, ''));

    if (transaction.type === 'transfer') {
      if (!transaction.toAccountId) {
        throw new Error('To account is required for transfers');
      }

      const fromAccount = await ctx.db.get(transaction.accountId);
      const toAccount = await ctx.db.get(transaction.toAccountId);

      if (!fromAccount || !toAccount) {
        throw new Error('One or both accounts not found');
      }

      const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
      const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));

      await ctx.db.patch(fromAccount._id, { balance: (fromBalance + amount).toString() });
      await ctx.db.patch(toAccount._id, { balance: (toBalance - amount).toString() });
    } else {
      const account = await ctx.db.get(transaction.accountId);
      if (!account) {
        throw new Error('Account not found');
      }

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