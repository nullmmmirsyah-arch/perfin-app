import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { getServerNow } from "./lib/finance";

export const getRecurringExpenses = query({
  args: { householdId: v.optional(v.id("households")) },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let expenses;
    if (householdId) {
      expenses = await ctx.db
        .query("recurringExpenses")
        .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
        .collect();
    } else {
      expenses = await ctx.db
        .query("recurringExpenses")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .collect();
    }

    return expenses.filter((e) => e.isActive);
  },
});

export const getRecurringSummary = query({
  args: {
    householdId: v.optional(v.id("households")),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, { householdId, year, month }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let expenses;
    if (householdId) {
      expenses = await ctx.db
        .query("recurringExpenses")
        .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
        .collect();
    } else {
      expenses = await ctx.db
        .query("recurringExpenses")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .collect();
    }

    const activeExpenses = expenses.filter((e) => e.isActive);

    const payments = await ctx.db
      .query("recurringPayments")
      .withIndex("by_year_month", (q) =>
        q.eq("year", year).eq("month", month)
      )
      .collect();

    const paidExpenseIds = new Set(
      payments.map((p) => p.recurringExpenseId)
    );

    const totalAmount = activeExpenses.reduce(
      (sum, e) => sum + parseFloat(e.amount),
      0
    );

    let recurringTz: string | null = null;
    if (householdId) {
      const h = await ctx.db.get(householdId);
      recurringTz = h?.timezone ?? null;
    } else {
      const member = await ctx.db.query("householdMembers")
        .withIndex("by_userId", q => q.eq("userId", identity.subject))
        .first();
      if (member) {
        const h = await ctx.db.get(member.householdId);
        recurringTz = h?.timezone ?? null;
      }
    }
    const recurringNow = getServerNow(recurringTz);
    const currentDay = recurringNow.getDate();
    const daysInMonth = new Date(year, month, 0).getDate();

    const paid = activeExpenses.filter((e) => paidExpenseIds.has(e._id));
    const unpaid = activeExpenses.filter((e) => !paidExpenseIds.has(e._id));

    const overdue = unpaid.filter((e) => e.dayOfMonth < currentDay);
    const upcoming = unpaid.filter((e) => {
      const diff = e.dayOfMonth - currentDay;
      return diff >= 0 && diff <= 3;
    });

    return {
      totalAmount: totalAmount.toString(),
      totalCount: activeExpenses.length,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      overdueCount: overdue.length,
      upcoming: upcoming.map((e) => ({
        _id: e._id,
        name: e.name,
        amount: e.amount,
        dayOfMonth: e.dayOfMonth,
      })),
      overdue: overdue.map((e) => ({
        _id: e._id,
        name: e.name,
        amount: e.amount,
        dayOfMonth: e.dayOfMonth,
      })),
    };
  },
});

export const getPaidThisMonth = query({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, { year, month }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const payments = await ctx.db
      .query("recurringPayments")
      .withIndex("by_year_month", (q) => q.eq("year", year).eq("month", month))
      .collect();
    return payments.map((p) => p.recurringExpenseId);
  },
});

export const createRecurringExpense = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    name: v.string(),
    amount: v.string(),
    categoryId: v.id("categories"),
    dayOfMonth: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (args.dayOfMonth < 1 || args.dayOfMonth > 31) {
      throw new Error("dayOfMonth must be between 1 and 31");
    }

    const id = await ctx.db.insert("recurringExpenses", {
      userId: identity.subject,
      householdId: args.householdId,
      name: args.name,
      amount: args.amount,
      categoryId: args.categoryId,
      dayOfMonth: args.dayOfMonth,
      isActive: true,
      createdAt: Date.now(),
    });

    return id;
  },
});

export const updateRecurringExpense = mutation({
  args: {
    id: v.id("recurringExpenses"),
    name: v.optional(v.string()),
    amount: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    dayOfMonth: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Recurring expense not found");
    }

    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.amount !== undefined) patch.amount = fields.amount;
    if (fields.categoryId !== undefined) patch.categoryId = fields.categoryId;
    if (fields.dayOfMonth !== undefined) {
      if (fields.dayOfMonth < 1 || fields.dayOfMonth > 31) {
        throw new Error("dayOfMonth must be between 1 and 31");
      }
      patch.dayOfMonth = fields.dayOfMonth;
    }

    await ctx.db.patch(id, patch);
  },
});

export const deleteRecurringExpense = mutation({
  args: { id: v.id("recurringExpenses") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Recurring expense not found");
    }

    await ctx.db.patch(id, { isActive: false });
  },
});

export const markRecurringPaid = mutation({
  args: {
    recurringExpenseId: v.id("recurringExpenses"),
    year: v.number(),
    month: v.number(),
    transactionId: v.optional(v.id("transactions")),
  },
  handler: async (ctx, { recurringExpenseId, year, month, transactionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("recurringPayments")
      .withIndex("by_recurringExpenseId", (q) =>
        q.eq("recurringExpenseId", recurringExpenseId)
      )
      .collect();

    const alreadyPaid = existing.find(
      (p) => p.year === year && p.month === month
    );
    if (alreadyPaid) {
      throw new Error("Already marked as paid for this month");
    }

    const id = await ctx.db.insert("recurringPayments", {
      recurringExpenseId,
      year,
      month,
      paidAt: Date.now(),
      transactionId,
    });

    return id;
  },
});
