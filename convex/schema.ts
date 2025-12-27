import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  households: defineTable({
    name: v.string(),
    ownerId: v.string(),
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
      labelId: v.optional(v.id("labels")),
    }))),
    labelId: v.optional(v.id("labels")),
    assetDetails: v.optional(v.object({
      quantity: v.string(),
      unitPrice: v.optional(v.number()),
    })),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"])
    .index("by_householdId", ["householdId"])
    .index("by_householdId_date", ["householdId", "date"]),
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
  })
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"]),
  labels: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    name: v.string(),
    color: v.string(),
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
  })
    .index("by_userId_year_month", ["userId", "year", "month"])
    .index("by_user_category_year_month", ["userId", "categoryId", "year", "month"])
    .index("by_householdId_year_month", ["householdId", "year", "month"])
    .index("by_householdId_category_year_month", ["householdId", "categoryId", "year", "month"]),
  
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
});
