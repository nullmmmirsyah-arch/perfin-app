import { Doc } from "../_generated/dataModel";
import { 
  TRANSACTION_TYPES, 
  ACCOUNT_TYPES,
  CATEGORY_TYPES 
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
 * - Settlement Reversals (Income to Expense Category)
 */
export function analyzeTransactionFlow(
  t: Doc<"transactions">,
  accountsMap: AccountMap,
  categoriesMap?: Map<string, Doc<"categories">>
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

  // 2. Handle Standard Expense / Saving / Settlement
  if (t.categoryId) {
    // Normal Expense/Saving
    if (t.type === TRANSACTION_TYPES.EXPENSE || t.type === TRANSACTION_TYPES.SAVING) {
      effects.push({ categoryId: String(t.categoryId), amount: baseAmount, type: 'SPENDING' });
      return effects;
    }
    
    // Settlement Reversal: Income to Expense Category
    if (t.type === TRANSACTION_TYPES.INCOME && categoriesMap) {
      const cat = categoriesMap.get(String(t.categoryId));
      if (cat && cat.type === CATEGORY_TYPES.EXPENSE) {
        // Treat as Negative Spending
        effects.push({ categoryId: String(t.categoryId), amount: -baseAmount, type: 'SPENDING' });
        return effects;
      }
    }
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
 * 
 * NEW LOGIC: Handles Reimbursement Settlements.
 * If an INCOME transaction targets an EXPENSE category, it is treated as 
 * NEGATIVE SPENDING (reducing the total spent), provided categoriesMap is supplied.
 */
export function calculateSpendingByCategory(
  transactions: Doc<"transactions">[],
  accountsMap: AccountMap,
  categoriesMap?: Map<string, Doc<"categories">>
): Record<string, number> {
  const spendingMap: Record<string, number> = {};

  transactions.forEach(t => {
    // 1. Analyze Flows (Expense/Transfer/Settlement)
    // analyzeTransactionFlow now handles everything if categoriesMap is provided
    const flows = analyzeTransactionFlow(t, accountsMap, categoriesMap);
    flows.forEach(flow => {
      if (flow.type === 'SPENDING') {
        spendingMap[flow.categoryId] = (spendingMap[flow.categoryId] || 0) + flow.amount;
      }
    });
  });

  return spendingMap;
}

/**
 * Centralized logic to calculate the monthly budget summary for expenses.
 * Used by both Dashboard and Budgets page to ensure consistency.
 */
export function calculateMonthlyBudgetLeft(
  budgets: Doc<"budgets">[],
  categories: Doc<"categories">[],
  spendingMap: Record<string, number>
) {
  const catMap = new Map(categories.map(c => [c._id, c]));
  
  return budgets.reduce((acc, b) => {
    const cat = catMap.get(b.categoryId);
    // Only calculate for 'expense' type categories
    if (cat?.type !== 'expense') return acc;

    const assigned = parseAmount(b.amount);
    const carryover = parseAmount(b.carryoverAmount);
    const swept = parseAmount(b.sweptAmount);
    const spent = spendingMap[b.categoryId] || 0;

    const effectiveLimit = assigned + carryover;
    // Net Balance: We don't use Math.max(0, ...) here so that overspending 
    // correctly reduces the total global spending power.
    const remaining = effectiveLimit - swept - spent;

    return {
      totalAssigned: acc.totalAssigned + assigned,
      totalCarryover: acc.totalCarryover + carryover,
      totalSwept: acc.totalSwept + swept,
      totalSpent: acc.totalSpent + spent,
      totalEffective: acc.totalEffective + effectiveLimit,
      totalRemaining: acc.totalRemaining + remaining
    };
  }, { 
    totalAssigned: 0, 
    totalCarryover: 0, 
    totalSwept: 0, 
    totalSpent: 0, 
    totalEffective: 0, 
    totalRemaining: 0 
  });
}

/**
 * Calculates Unassigned Cash (Global Logic).
 * Formula: Total Liquid Cash - Sum(Total Budget Obligations)
 * Obligation = (allocated + carryover) - swept.
 * Spending does NOT affect unassigned — it only affects remaining limit within a budget.
 */
export function calculateUnassignedCash(
  allBudgets: Doc<"budgets">[],
  accountsMap: AccountMap,
  targetMonth?: number,
  targetYear?: number
): number {
  let totalLiquidCash = 0;
  for (const account of accountsMap.values()) {
    if (isLiquidAccount(account)) {
      totalLiquidCash += parseFloat(account.balance.replace(/,/g, '') || '0');
    }
  }

  let totalObligations = 0;

  const filteredBudgets = (targetMonth !== undefined && targetYear !== undefined)
    ? allBudgets.filter(b => b.month === targetMonth && b.year === targetYear)
    : allBudgets;

  filteredBudgets.forEach(b => {
    const allocated = parseAmount(b.amount);
    const carryover = parseAmount(b.carryoverAmount);
    const swept = parseAmount(b.sweptAmount);

    totalObligations += (allocated + carryover) - swept;
  });

  return totalLiquidCash - totalObligations;
}

/**
 * Calculates the Fiscal Month details for a given date.
 * Returns the month label using end-month convention.
 * Example: If StartDay = 25.
 * Date: Jan 10 -> Jan (period Dec 25 - Jan 24 ends in Jan)
 * Date: Jan 26 -> Feb (period Jan 25 - Feb 24 ends in Feb)
 */
export function getFiscalDateDetails(
  dateStr: string, 
  startDay: number = 1
): { year: number; month: number } {
  const date = new Date(dateStr);
  if (startDay === 1) {
    return { year: date.getFullYear(), month: date.getMonth() };
  }
  const day = date.getDate();
  let year = date.getFullYear();
  let month = date.getMonth();

  if (day >= startDay) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }

  return { year, month };
}

/**
 * Calculates the Start and End Date for a specific Fiscal Month label.
 * Uses end-month convention: label "June" (month=5) with startDay=25
 * returns { start: May 25, end: June 24 }.
 */
export function getFiscalMonthRange(
  year: number,
  month: number,
  startDay: number = 1
): { start: string; end: string } {
  const startDate = new Date(year, startDay > 1 ? month - 1 : month, startDay);
  const endDate = new Date(year, startDay > 1 ? month : month + 1, startDay - 1, 23, 59, 59, 999);
  return { 
    start: startDate.toISOString(), 
    end: endDate.toISOString() 
  };
}
