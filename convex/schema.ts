import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  transactions: defineTable({
    userId: v.string(),
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
  }).index("by_userId", ["userId"]),
  accounts: defineTable({
    userId: v.string(),
    name: v.string(),
    balance: v.string(),
    type: v.optional(v.string()),
    initialQuantity: v.optional(v.string()),
    unit: v.optional(v.string()),
    quantity: v.optional(v.number()),
    totalCostBasis: v.optional(v.number()),
    totalRealizedProfit: v.optional(v.number()),
  }).index("by_userId", ["userId"]),
  categories: defineTable({
    userId: v.string(),
    name: v.string(),
    type: v.string(),
  }).index("by_userId", ["userId"]),
  labels: defineTable({
    userId: v.string(),
    name: v.string(),
    color: v.string(),
  }).index("by_userId", ["userId"]),
  budgets: defineTable({
    userId: v.string(),
    categoryId: v.id("categories"),
    amount: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_categoryId", ["userId", "categoryId"]),
});
