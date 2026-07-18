import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  merchants: defineTable({
    userId: v.string(),
    householdId: v.id("households"), // Required - merchants are household-only
    name: v.string(),
    icon: v.string(), // Emoji or icon identifier
  })
    .index("by_householdId", ["householdId"])
    .index("by_userId", ["userId"])
    .index("by_householdId_name", ["householdId", "name"]),
  
  households: defineTable({
    name: v.string(),
    ownerId: v.string(),
    budgetStartDay: v.optional(v.number()),
  }),
  householdMembers: defineTable({
    householdId: v.id("households"),
    userId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
    email: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"])
    .index("by_householdId_userId", ["householdId", "userId"]),
  
  householdInvites: defineTable({
    householdId: v.id("households"),
    email: v.optional(v.string()),
    code: v.string(),
    expiresAt: v.number(),
    createdBy: v.string(),
    status: v.string(), // "pending" | "accepted" | "expired"
  })
    .index("by_code", ["code"])
    .index("by_householdId", ["householdId"]),

  transactions: defineTable({
    userId: v.string(),
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
    searchCategoryIds: v.optional(v.array(v.string())),
    searchLabelIds: v.optional(v.array(v.string())),
    
    // --- Receivables / Reimbursement Fields ---
    isReimbursable: v.optional(v.boolean()), 
    owedBy: v.optional(v.string()), 
    reimbursementStatus: v.optional(v.union(
      v.literal("pending"), 
      v.literal("settled"), 
      v.literal("forgiven")
    )),
    // New Partial Settlement Fields
    amountPaid: v.optional(v.string()), // Total settled so far
    settlementStatus: v.optional(v.union(
      v.literal("unpaid"),
      v.literal("partial"),
      v.literal("settled")
    )),
    parentTransactionId: v.optional(v.id("transactions")), // Link to the original debt
    merchantId: v.optional(v.id("merchants")),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"])
    .index("by_householdId", ["householdId"])
    .index("by_householdId_date", ["householdId", "date"])
    .index("by_search_category", ["userId", "searchCategoryIds"])
    .index("by_search_label", ["userId", "searchLabelIds"])
    .index("by_household_search_category", ["householdId", "searchCategoryIds"])
    .index("by_household_search_label", ["householdId", "searchLabelIds"])
    .index("by_accountId", ["accountId"])
    .index("by_toAccountId", ["toAccountId"])
    // Index for finding Active Receivables
    .index("by_receivables_status", ["householdId", "isReimbursable", "reimbursementStatus"])
    .index("by_userId_reimbursable_status", ["userId", "isReimbursable", "reimbursementStatus"])
    // Index for cascading deletes and calculations
    .index("by_parentTransactionId", ["parentTransactionId"])
    // Index for merchant lookups
    .index("by_merchantId", ["merchantId"]),
  accounts: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    name: v.string(),
    balance: v.string(),
    type: v.optional(v.string()),
    initialQuantity: v.optional(v.string()),
    unit: v.optional(v.string()),
    quantity: v.optional(v.number()),
    totalCostBasis: v.optional(v.number()),
    totalRealizedProfit: v.optional(v.number()),
    isArchived: v.optional(v.boolean()),
    linkedCategoryId: v.optional(v.id("categories")),
    visibility: v.optional(v.union(v.literal("shared"), v.literal("private"))),
  })
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"]),
  categories: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    name: v.string(),
    type: v.string(),
    targetAmount: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
    status: v.optional(v.string()),
    enablePacing: v.optional(v.boolean()),
    goalType: v.optional(v.union(
      v.literal("investment"),
      v.literal("bill"),
      v.literal("purchase")
    )),
    lastResetDate: v.optional(v.string()),
    hideAmount: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"]),
  
  goalHistory: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    categoryId: v.id("categories"),
    completedDate: v.string(),
    finalAmount: v.number(),
    targetAmount: v.number(),
    note: v.optional(v.string()),
  })
    .index("by_categoryId", ["categoryId"]),

  labels: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    name: v.string(),
    icon: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"]),
  budgets: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    categoryId: v.id("categories"),
    amount: v.string(),
    year: v.number(),
    month: v.number(),
    initialAmount: v.optional(v.string()),
    totalAdjustments: v.optional(v.string()),
    sweptAmount: v.optional(v.string()),
    carryoverAmount: v.optional(v.string()),
  })
    .index("by_userId_year_month", ["userId", "year", "month"])
    .index("by_user_category_year_month", ["userId", "categoryId", "year", "month"])
    .index("by_householdId_year_month", ["householdId", "year", "month"])
    .index("by_householdId_category_year_month", ["householdId", "categoryId", "year", "month"]),
  
  notifications: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    type: v.string(), // "goal_reached", "system"
    title: v.string(),
    message: v.string(),
    data: v.optional(v.any()), // e.g., { categoryId: "..." }
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"]),

  pushSubscriptions: defineTable({
    userId: v.string(),
    endpoint: v.string(),
    expirationTime: v.optional(v.number()),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
  })
    .index("by_userId", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  scheduledTransactions: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    name: v.string(),
    amount: v.string(),
    fromAccountId: v.id("accounts"),
    toAccountId: v.optional(v.id("accounts")),
    linkedEntityId: v.optional(v.id("categories")),
    frequency: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("yearly")
    ),
    nextRunAt: v.number(),
    isEnabled: v.boolean(),
    lastRunStatus: v.optional(v.union(v.literal("success"), v.literal("failed"))),
    failureReason: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"])
    .index("by_nextRun", ["isEnabled", "nextRunAt"])
    .index("by_linkedEntityId", ["linkedEntityId"]),

  recurringExpenses: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    name: v.string(),
    amount: v.string(),
    categoryId: v.id("categories"),
    dayOfMonth: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"]),

  recurringPayments: defineTable({
    recurringExpenseId: v.id("recurringExpenses"),
    year: v.number(),
    month: v.number(),
    paidAt: v.number(),
    transactionId: v.optional(v.id("transactions")),
  })
    .index("by_recurringExpenseId", ["recurringExpenseId"])
    .index("by_year_month", ["year", "month"]),

  userCaches: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    accumulatedByCategory: v.array(v.object({
      categoryId: v.string(),
      amount: v.number(),
    })),
    unassignedCash: v.number(),
    monthlySpending: v.array(v.object({
      year: v.number(),
      month: v.number(),
      spending: v.array(v.object({
        categoryId: v.string(),
        amount: v.number(),
      })),
      totalSpent: v.number(),
    })),
    lastUpdatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"]),
});
