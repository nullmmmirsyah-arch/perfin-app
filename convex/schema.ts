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
    }))),
    labelId: v.optional(v.id("labels")),
  }).index("by_userId", ["userId"]),
  accounts: defineTable({
    userId: v.string(),
    name: v.string(),
    balance: v.string(),
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
});
