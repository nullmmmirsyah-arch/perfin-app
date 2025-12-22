import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    return await ctx.db
      .query("budgets")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const getBudgetStatus = query({
  args: {
    month: v.optional(v.number()), // 0-11
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    // 1. Get all categories
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // 2. Get all budgets
    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // 3. Calculate date range for the month
    const now = new Date();
    const currentYear = args.year ?? now.getFullYear();
    const currentMonth = args.month ?? now.getMonth();
    
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // 4. Get transactions for the month
    // Note: This fetches all transactions for the user and filters in memory.
    // Ideally, we'd have a date index, but 'transactions' only has 'by_userId'.
    // Given the likely scale, this is acceptable for now.
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const transactionsInMonth = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= startOfMonth && tDate <= endOfMonth;
    });

    // 5. Aggregate spending by category
    const spendingByCategory: Record<string, number> = {};
    transactionsInMonth.forEach((t) => {
      if (t.type !== 'expense') return;

      if (t.isSplit && t.splits) {
        t.splits.forEach((split) => {
          if (split.categoryId && split.amount) {
            const amount = parseFloat(split.amount.replace(/,/g, ''));
            if (!isNaN(amount)) {
              spendingByCategory[split.categoryId] = (spendingByCategory[split.categoryId] || 0) + amount;
            }
          }
        });
      } else if (t.categoryId && t.amount) {
        const amount = parseFloat(t.amount.replace(/,/g, ''));
        if (!isNaN(amount)) {
          spendingByCategory[t.categoryId] = (spendingByCategory[t.categoryId] || 0) + amount;
        }
      }
    });

    // 6. Combine data
    // We only want to show categories that are "expenses" typically, 
    // or we can show all and let the UI filter. 
    // Let's return all categories but enriched with budget and spending info.
    
    const budgetMap = new Map(budgets.map(b => [b.categoryId, b]));

    return categories
        .filter(c => c.type === 'expense') // Only budgeting for expenses usually
        .map((category) => {
            const budget = budgetMap.get(category._id);
            const spent = spendingByCategory[category._id] || 0;
            return {
                category,
                budget,
                spent,
            };
    });
  },
});

export const upsertBudget = mutation({
  args: {
    categoryId: v.id("categories"),
    amount: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existingBudget = await ctx.db
      .query("budgets")
      .withIndex("by_userId_categoryId", (q) => 
        q.eq("userId", identity.subject).eq("categoryId", args.categoryId)
      )
      .first();

    if (existingBudget) {
      await ctx.db.patch(existingBudget._id, { amount: args.amount });
    } else {
      await ctx.db.insert("budgets", {
        userId: identity.subject,
        categoryId: args.categoryId,
        amount: args.amount,
      });
    }
  },
});

export const deleteBudget = mutation({
  args: {
    id: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    await ctx.db.delete(args.id);
  },
});
