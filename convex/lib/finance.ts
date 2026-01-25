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
  // CRITICAL FIX: Use toUpperCase() to handle different casing in DB (e.g. "Cash" vs "CASH")
  return !account.type || account.type.toUpperCase() === ACCOUNT_TYPES.CASH;
}

/**
 * Checks if an account is "Special" (Non-Liquid: Savings/Assets).
 */
export function isSpecialAccount(account?: Doc<"accounts"> | null): boolean {
  if (!account || !account.type) return false;
  const type = account.type.toUpperCase();
  return type === ACCOUNT_TYPES.SAVING || type === ACCOUNT_TYPES.ASSET;
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
      if (t.type === TRANSACTION_TYPES.EXPENSE || t.type === TRANSACTION_TYPES.SAVING) {
        if (split.categoryId) {
          effects.push({ categoryId: String(split.categoryId), amount: splitAmount, type: 'SPENDING' });
        }
      }
    });
    return effects;
  }

  // 2. Handle Standard Expense / Saving
  if ((t.type === TRANSACTION_TYPES.EXPENSE || t.type === TRANSACTION_TYPES.SAVING) && t.categoryId) {
    effects.push({ categoryId: String(t.categoryId), amount: baseAmount, type: 'SPENDING' });
    return effects;
  }

  // 3. Handle Transfers
  if (t.type === TRANSACTION_TYPES.TRANSFER && t.accountId && t.toAccountId) {
    // CRITICAL FIX: Always use String() for Map access to handle Convex ID objects correctly
    const source = accountsMap.get(String(t.accountId));
    const dest = accountsMap.get(String(t.toAccountId));
    const sourceIsLiquid = isLiquidAccount(source);
    const destIsLiquid = isLiquidAccount(dest);

    // Scenario A: Liquid -> Liquid (ATM -> Wallet)
    // Effect: Neutral.
    if (sourceIsLiquid && destIsLiquid) return [];

    // Scenario B: Liquid -> Special (Nabung / Beli Aset)
    // Effect: Spending (Allocated to Goal).
    if (sourceIsLiquid && !destIsLiquid && t.categoryId) {
      effects.push({ categoryId: String(t.categoryId), amount: baseAmount, type: 'SPENDING' });
      return effects;
    }

    // Scenario C: Special -> Liquid (Tarik Tabungan / Jual Aset)
    // Effect: Income (New Available Cash) OR Negative Spending (Reversal).
    if (!sourceIsLiquid && destIsLiquid && t.categoryId) {
      if (t.isGoalDisbursement) {
          return []; 
      }

      // We mark this as NEGATIVE SPENDING to reduce the "Spent" amount of that category.
      effects.push({ categoryId: String(t.categoryId), amount: -baseAmount, type: 'SPENDING' });
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
  accountsMap: AccountMap,
  budgetStartDay: number = 1
): number {
  // 1. Calculate Total Liquid Cash (Current Reality)
  let totalLiquidCash = 0;
  for (const account of accountsMap.values()) {
    if (isLiquidAccount(account)) {
      totalLiquidCash += parseFloat(account.balance.replace(/,/g, '') || '0');
    }
  }

  // 2. Group Spending by Fiscal Month & Category
  const monthlySpending = new Map<string, Map<string, number>>();

  allTransactions.forEach(t => {
    const flows = analyzeTransactionFlow(t, accountsMap);
    const { year, month } = getFiscalDateDetails(t.date, budgetStartDay);
    const key = `${year}-${month}`; 

    if (!monthlySpending.has(key)) {
        monthlySpending.set(key, new Map());
    }
    const categoryMap = monthlySpending.get(key)!;

    flows.forEach(flow => {
      if (flow.type === 'SPENDING') {
        const catId = String(flow.categoryId);
        const current = categoryMap.get(catId) || 0;
        categoryMap.set(catId, current + flow.amount);
      }
    });
  });

  // 3. Calculate Total Remaining Budget Obligations
  let totalRemainingObligations = 0;

  allBudgets.forEach(b => {
    const key = `${b.year}-${b.month}`;
    const categoryMap = monthlySpending.get(key);
    const spent = categoryMap?.get(String(b.categoryId)) || 0;
    const allocated = parseFloat(b.amount.replace(/,/g, '') || '0');
    const carryover = parseFloat(b.carryoverAmount?.replace(/,/g, '') || '0');
    const swept = parseFloat(b.sweptAmount?.replace(/,/g, '') || '0');
    
    // Fix: Allow negative remaining (overspending) so Unassigned Cash isn't reduced automatically.
    // Remaining obligation must include carryover (rollover surplus/debt)
    const remaining = (allocated + carryover - swept) - spent;
    totalRemainingObligations += remaining;
  });

  return totalLiquidCash - totalRemainingObligations;
}

/**
 * Calculates the Fiscal Month details for a given date.
 * Example: If StartDay = 25.
 * Date: Jan 10 -> Belongs to Dec Fiscal Month.
 * Date: Jan 26 -> Belongs to Jan Fiscal Month.
 */
export function getFiscalDateDetails(
  dateStr: string, 
  startDay: number = 1
): { year: number; month: number } {
  const date = new Date(dateStr);
  const day = date.getDate();
  let year = date.getFullYear();
  let month = date.getMonth(); // 0-11

  // If day is before startDay, it belongs to previous month
  if (day < startDay) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  return { year, month };
}

/**
 * Calculates the Start and End Date for a specific Fiscal Month.
 * Example: Fiscal Month Jan (Year 2024), StartDay 25.
 * Returns: { start: "2024-01-25...", end: "2024-02-24..." }
 */
export function getFiscalMonthRange(
  year: number,
  month: number,
  startDay: number = 1
): { start: string; end: string } {
  // Start Date
  const startDate = new Date(year, month, startDay);
  
  // End Date: Start Date + 1 Month - 1ms
  // Note: JS Date handles overflow correctly (e.g., month 12 becomes Jan next year)
  const nextMonthDate = new Date(year, month + 1, startDay);
  const endDate = new Date(nextMonthDate.getTime() - 1);

  return { 
    start: startDate.toISOString(), 
    end: endDate.toISOString() 
  };
}
