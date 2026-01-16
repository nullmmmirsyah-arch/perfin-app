/**
 * Centralized constants for the application to ensure consistency 
 * and avoid typos in database queries and business logic.
 */

export const TRANSACTION_TYPES = {
  EXPENSE: "expense",
  INCOME: "income",
  TRANSFER: "transfer",
  SAVING: "saving", // Note: Saving is used for direct goal contributions
} as const;

export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

export const CATEGORY_TYPES = {
  EXPENSE: "expense",
  INCOME: "income",
  SAVING: "saving", // Represents a Financial Goal
} as const;

export type CategoryType = typeof CATEGORY_TYPES[keyof typeof CATEGORY_TYPES];

export const ACCOUNT_TYPES = {
  CASH: "CASH",
  ASSET: "ASSET",
  SAVING: "SAVING",
} as const;

export type AccountType = typeof ACCOUNT_TYPES[keyof typeof ACCOUNT_TYPES];

export const GOAL_STATUS = {
  ACTIVE: "active",
  ACHIEVED: "achieved",
  ARCHIVED: "archived",
} as const;

export type GoalStatus = typeof GOAL_STATUS[keyof typeof GOAL_STATUS];

export const GOAL_TYPES = {
  INVESTMENT: "investment", // Wealth Building (Emergency Fund, Gold)
  BILL: "bill",             // Sinking Fund (Tax, Insurance)
  PURCHASE: "purchase",     // Wishlist (Vacation, Gadget)
} as const;

export type GoalType = typeof GOAL_TYPES[keyof typeof GOAL_TYPES];

export const NOTIFICATION_TYPES = {
  GOAL_REACHED: "goal_reached",
  SYSTEM: "system",
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

export const AUTOMATION_FREQUENCIES = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

export type AutomationFrequency = typeof AUTOMATION_FREQUENCIES[keyof typeof AUTOMATION_FREQUENCIES];
