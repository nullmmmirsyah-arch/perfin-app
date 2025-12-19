import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

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
    
    // Join with account names and labels
    const transactionsWithDetails = await Promise.all(
      transactions.map(async (transaction) => {
        const fromAccount = await ctx.db.get(transaction.accountId);
        const toAccount = transaction.toAccountId
          ? await ctx.db.get(transaction.toAccountId)
          : null;

        const label = transaction.labelId
          ? await ctx.db.get(transaction.labelId)
          : null;

        return {
          ...transaction,
          fromAccountName: fromAccount?.name,
          toAccountName: toAccount?.name,
          label: label,
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
    }))),
    labelId: v.optional(v.id("labels")),
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

      const fromBalance = parseFloat(fromAccount.balance.replace(/,/g, ''));
      const toBalance = parseFloat(toAccount.balance.replace(/,/g, ''));

      await ctx.db.patch(fromAccount._id, { balance: (fromBalance - amount).toString() });
      await ctx.db.patch(toAccount._id, { balance: (toBalance + amount).toString() });
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
    }))),
    labelId: v.optional(v.id("labels")),
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