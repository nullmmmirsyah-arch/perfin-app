import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

export const getTotals = query({
  args: {
    dateRange: v.optional(v.object({
      start: v.string(),
      end: v.string(),
    })),
  },
  handler: async (ctx, { dateRange }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let transactions;
    if (dateRange) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .filter((q) => q.and(q.gte(q.field("date"), dateRange.start), q.lte(q.field("date"), dateRange.end)))
        .collect();
    } else {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .collect();
    }

    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => acc + parseFloat(t.amount.replace(/,/g, '')), 0);

    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => acc + parseFloat(t.amount.replace(/,/g, '')), 0);

    return { income, expense };
  },
});

export const getSpendingByCategory = query({
  args: {
    dateRange: v.optional(v.object({
      start: v.string(),
      end: v.string(),
    })),
  },
  handler: async (ctx, { dateRange }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let transactions;
    if (dateRange) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .filter((q) => q.and(q.gte(q.field("date"), dateRange.start), q.lte(q.field("date"), dateRange.end)))
        .collect();
    } else {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .collect();
    }

    const expenseTransactions = transactions.filter((t) => t.type === "expense");

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    const spendingByCategory = categories.map(category => {
      const categorySpending = expenseTransactions
        .filter(t => t.categoryId === category._id)
        .reduce((acc, t) => acc + parseFloat(t.amount.replace(/,/g, '')), 0);
      return { name: category.name, value: categorySpending };
    }).filter(c => c.value > 0);

    return spendingByCategory;
  },
});
