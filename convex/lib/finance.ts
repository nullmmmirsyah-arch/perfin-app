import { Doc } from "../_generated/dataModel";
import { 
  TRANSACTION_TYPES, 
  ACCOUNT_TYPES 
} from "./constants";

export type AccountMap = Map<string, Doc<"accounts">>;

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
      // We mark this as NEGATIVE SPENDING to reduce the "Spent" amount of that category.
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
 * Formula: Total Income (All Time) - Total Budgeted (All Time).
 */
export function calculateUnassignedCash(
  allTransactions: Doc<"transactions">[],
  allBudgets: Doc<"budgets">[],
  accountsMap: AccountMap
): number {
  // 1. Calculate Total Income
  const totalIncome = allTransactions.reduce((acc, t) => {
    const amount = parseFloat(t.amount.replace(/,/g, '') || '0');

    // Case 1: Standard Income
    if (t.type === TRANSACTION_TYPES.INCOME) {
      // Note: If income is split, we sum the splits.
      if (t.isSplit && t.splits) {
        return acc + t.splits.reduce((sAcc, s) => sAcc + parseFloat(s.amount.replace(/,/g, '') || '0'), 0);
      }
      return acc + amount;
    }

    // Case 2: Asset Liquidation (Transfer Special -> Liquid)
    if (t.type === TRANSACTION_TYPES.TRANSFER && t.accountId && t.toAccountId) {
      const source = accountsMap.get(t.accountId);
      const dest = accountsMap.get(t.toAccountId);
      if (!isLiquidAccount(source) && isLiquidAccount(dest)) {
        return acc + amount;
      }
    }

    return acc;
  }, 0);

  // 2. Calculate Total Budgeted
  const totalBudgeted = allBudgets.reduce((acc, b) => acc + parseFloat(b.amount.replace(/,/g, '') || '0'), 0);

  return totalIncome - totalBudgeted;
}
