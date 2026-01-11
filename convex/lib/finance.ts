import { Doc } from "../_generated/dataModel";
import { 
  TRANSACTION_TYPES, 
  ACCOUNT_TYPES 
} from "./constants";

export type AccountMap = Map<string, Doc<"accounts">>;

/**
 * Parses a currency string into a number.
 */
export function parseAmount(value: string | undefined | null): number {
  if (!value) return 0;
  const clean = value.replace(/,/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Checks if an account is considered "Liquid" (Cash/Bank).
 * Returns true for type 'CASH' or undefined (legacy).
 * Returns false for 'ASSET' or 'SAVING'.
 */
export function isLiquidAccount(account?: Doc<"accounts"> | null): boolean {
  if (!account) return false; // Safety for missing accounts
  // Default to Liquid if type is missing (Legacy data support)
  return !account.type || account.type === ACCOUNT_TYPES.CASH;
}

/**
 * Checks if an account is "Special" (Non-Liquid: Savings/Assets).
 */
export function isSpecialAccount(account?: Doc<"accounts"> | null): boolean {
  if (!account) return false;
  return account.type === ACCOUNT_TYPES.SAVING || account.type === ACCOUNT_TYPES.ASSET;
}

/**
 * Core Logic: Determines the financial effect of a transaction.
 * Handles:
 * - Standard Expense/Income
 * - Splits
 * - Transfers (Liquid <-> Liquid, Liquid <-> Special)
 */
export function analyzeTransactionFlow(
  t: Doc<"transactions">,
  accountsMap: AccountMap
): { categoryId: string; amount: number; type: 'SPENDING' | 'INCOME' | 'NEUTRAL' }[] {
  const effects: { categoryId: string; amount: number; type: 'SPENDING' | 'INCOME' | 'NEUTRAL' }[] = [];
  const baseAmount = parseFloat(t.amount.replace(/,/g, '') || '0');

  // 1. Handle SPLIT Transactions (Recursion-like)
  if (t.isSplit && t.splits && t.splits.length > 0) {
    t.splits.forEach(split => {
      const splitAmount = parseFloat(split.amount.replace(/,/g, '') || '0');
      // Treat splits as mini-transactions of the same type
      // NOTE: Splits currently only support 'expense' type logic effectively.
      // Transfers usually aren't split in this app model yet, but if they were, logic applies.
      if (t.type === TRANSACTION_TYPES.EXPENSE || t.type === TRANSACTION_TYPES.SAVING) {
        if (split.categoryId) {
          effects.push({ categoryId: split.categoryId, amount: splitAmount, type: 'SPENDING' });
        }
      }
      // Income splits
      if (t.type === TRANSACTION_TYPES.INCOME) {
         // Income splits logic...
      }
    });
    return effects;
  }

  // 2. Handle Standard Expense / Saving
  if ((t.type === TRANSACTION_TYPES.EXPENSE || t.type === TRANSACTION_TYPES.SAVING) && t.categoryId) {
    effects.push({ categoryId: t.categoryId, amount: baseAmount, type: 'SPENDING' });
    return effects;
  }

  // 3. Handle Transfers
  if (t.type === TRANSACTION_TYPES.TRANSFER && t.accountId && t.toAccountId) {
    const source = accountsMap.get(t.accountId);
    const dest = accountsMap.get(t.toAccountId);
    const sourceIsLiquid = isLiquidAccount(source);
    const destIsLiquid = isLiquidAccount(dest);

    // Scenario A: Liquid -> Liquid (ATM -> Wallet)
    // Effect: Neutral.
    if (sourceIsLiquid && destIsLiquid) return [];

    // Scenario B: Liquid -> Special (Nabung / Beli Aset)
    // Effect: Spending (Allocated to Goal).
    if (sourceIsLiquid && !destIsLiquid && t.categoryId) {
      effects.push({ categoryId: t.categoryId, amount: baseAmount, type: 'SPENDING' });
      return effects;
    }

    // Scenario C: Special -> Liquid (Tarik Tabungan / Jual Aset)
    // Effect: Income (New Available Cash) OR Negative Spending (Reversal).
    if (!sourceIsLiquid && destIsLiquid && t.categoryId) {
      // FIX: Check if this is a Goal Disbursement (Completion/Reset)
      // If yes, it's NOT Negative Spending (which means "I returned the item").
      // Instead, it's "Release of Funds" which should increase Unassigned Cash naturally 
      // without affecting the 'Spent' history of the category negatively.
      if (t.isGoalDisbursement) {
          // It's neutral/income effectively because Liquid Cash increases, 
          // and we DO NOT want to reduce the 'spent' amount of the category 
          // because that would increase the 'remaining obligation'.
          return []; 
      }

      // We mark this as NEGATIVE SPENDING to reduce the "Spent" amount of that category.
      // Useful for reversals or mistakes.
      effects.push({ categoryId: t.categoryId, amount: -baseAmount, type: 'SPENDING' });
      return effects;
    }
  }

  return effects;
}

/**
 * Aggregates total spending per category from a list of transactions.
 * Returns a Map: CategoryID -> Total Spent Amount.
 */
export function calculateSpendingByCategory(
  transactions: Doc<"transactions">[],
  accountsMap: AccountMap
): Record<string, number> {
  const spendingMap: Record<string, number> = {};

  transactions.forEach(t => {
    const flows = analyzeTransactionFlow(t, accountsMap);
    flows.forEach(flow => {
      if (flow.type === 'SPENDING') {
        spendingMap[flow.categoryId] = (spendingMap[flow.categoryId] || 0) + flow.amount;
      }
    });
  });

  return spendingMap;
}

/**
 * Calculates Unassigned Cash (Global Logic).
 * New Formula: Total Liquid Cash - Sum(Remaining Budget Obligations)
 * Remaining Obligation = Max(0, Budget Amount - Spent in that Period)
 */
export function calculateUnassignedCash(
  allTransactions: Doc<"transactions">[],
  allBudgets: Doc<"budgets">[],
  accountsMap: AccountMap
): number {
  // 1. Calculate Total Liquid Cash (Current Reality)
  let totalLiquidCash = 0;
  for (const account of accountsMap.values()) {
    if (isLiquidAccount(account)) {
      totalLiquidCash += parseFloat(account.balance.replace(/,/g, '') || '0');
    }
  }

  // 2. Group Spending by Month & Category
  // Map<"YYYY-MM", Map<CategoryId, Amount>>
  const monthlySpending = new Map<string, Map<string, number>>();

  allTransactions.forEach(t => {
    // Only care about spending flows
    const flows = analyzeTransactionFlow(t, accountsMap);
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`; // "2024-0" for Jan

    if (!monthlySpending.has(key)) {
        monthlySpending.set(key, new Map());
    }
    const categoryMap = monthlySpending.get(key)!;

    flows.forEach(flow => {
      if (flow.type === 'SPENDING') {
        const current = categoryMap.get(flow.categoryId) || 0;
        categoryMap.set(flow.categoryId, current + flow.amount);
      }
    });
  });

  // 3. Calculate Total Remaining Budget Obligations
  let totalRemainingObligations = 0;

  allBudgets.forEach(b => {
    const key = `${b.year}-${b.month}`;
    const categoryMap = monthlySpending.get(key);
    const spent = categoryMap?.get(b.categoryId) || 0;
    const allocated = parseFloat(b.amount.replace(/,/g, '') || '0');
    
    // Obligation is what's left to be spent. 
    // If we overspent, obligation is 0 (we don't owe the envelope anymore, we owe the bank/unassigned).
    const remaining = Math.max(0, allocated - spent);
    totalRemainingObligations += remaining;
  });

  return totalLiquidCash - totalRemainingObligations;
}
