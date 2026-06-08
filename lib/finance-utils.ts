import { differenceInCalendarDays, differenceInMonths, subMonths, addMonths } from "date-fns";

export type PacingStatus = 'safe' | 'warning' | 'danger';

export interface PacingResult {
  status: PacingStatus;
  dailyLimit: number;
  timeProgress: number;
  spendProgress: number;
  daysRemaining: number;
}

// --- CORE HELPERS ---

export function getFiscalDate(date: Date, startDay: number = 1): Date {
  if (startDay === 1) return date;
  const day = date.getDate();
  if (day >= startDay) return addMonths(date, 1);
  return date;
}

export function getFiscalDateDetails(dateStr: string, startDay: number = 1): { year: number; month: number } {
  const date = new Date(dateStr);
  const fiscalDate = getFiscalDate(date, startDay);
  return {
      year: fiscalDate.getFullYear(),
      month: fiscalDate.getMonth()
  };
}

export function getFiscalMonthRange(year: number, month: number, startDay: number = 1): { start: Date; end: Date } {
  const startDate = new Date(year, startDay > 1 ? month - 1 : month, startDay);
  const endDate = new Date(year, startDay > 1 ? month : month + 1, startDay - 1);
  return { start: startDate, end: endDate };
}

export function calculateFiscalDaysRemaining(budgetStartDay: number = 1): number {
  const now = new Date();
  const currentFiscal = getFiscalDate(now, budgetStartDay);
  
  // Get range for CURRENT fiscal month
  const { end } = getFiscalMonthRange(currentFiscal.getFullYear(), currentFiscal.getMonth(), budgetStartDay);
  
  // Diff in Days (+1 to include today)
  const diffDays = differenceInCalendarDays(end, now) + 1;
  return Math.max(1, diffDays);
}

// --- STRATEGY & PACING (UPDATED TO BE FISCAL AWARE) ---

export function calculateGoalStrategy(
  currentAmount: number,
  targetAmount: number,
  targetDateStr?: string,
  budgetStartDay: number = 1
) {
  if (!targetAmount || !targetDateStr) return null;

  const now = new Date();
  const targetDate = new Date(targetDateStr);
  
  if (targetDate <= now) return null;

  const remainingAmount = Math.max(0, targetAmount - currentAmount);
  if (remainingAmount === 0) return { monthly: 0, months: 0, isDone: true };

  // FISCAL UPDATE:
  // We need to calculate how many *Fiscal Months* are left.
  // We align 'now' to its Fiscal Date representation.
  // We align 'target' to its Fiscal Date representation (approx).
  
  const fiscalNow = getFiscalDate(now, budgetStartDay);
  
  // If target date is e.g. 20th Jan (and start is 25), it effectively falls in Dec fiscal.
  const fiscalTarget = getFiscalDate(targetDate, budgetStartDay);

  // Calculate difference + 1 to include current month
  const monthsRemaining = differenceInMonths(fiscalTarget, fiscalNow) + (fiscalTarget.getDate() >= fiscalNow.getDate() ? 0 : 1);
  const divisor = Math.max(1, monthsRemaining);
  
  const monthly = remainingAmount / divisor;

  return {
    monthly,
    months: divisor,
    isDone: false
  };
}

export function calculateBudgetPace(
  spent: number,
  limit: number,
  year: number, // Fiscal Year
  month: number, // Fiscal Month
  budgetStartDay: number = 1
): PacingResult {
  const now = new Date();
  
  // Check if we are viewing the Current Active Fiscal Month
  const currentFiscal = getFiscalDate(now, budgetStartDay);
  const isCurrentFiscalMonth = currentFiscal.getFullYear() === year && currentFiscal.getMonth() === month;
  
  // Base status check: Over budget is ALWAYS danger
  const isOver = limit > 0 && spent > limit;

  // If viewing Past/Future, simpler logic
  if (!isCurrentFiscalMonth) {
    const viewDate = new Date(year, month, budgetStartDay);
    const isPast = viewDate < currentFiscal;
    
    if (isPast) {
      return {
        status: isOver ? 'danger' : 'safe',
        dailyLimit: 0,
        timeProgress: 100,
        spendProgress: limit > 0 ? (spent / limit) * 100 : 0,
        daysRemaining: 0,
      };
    }
    // Future
    return {
      status: isOver ? 'danger' : 'safe',
      dailyLimit: limit / 30, // Approx
      timeProgress: 0,
      spendProgress: limit > 0 ? (spent / limit) * 100 : 0,
      daysRemaining: 30,
    };
  }

  // FISCAL UPDATE for Current Month:
  const { start, end } = getFiscalMonthRange(year, month, budgetStartDay);
  
  // Total Days in this specific fiscal cycle (e.g. 30, 31, 28)
  const totalDaysInCycle = differenceInCalendarDays(end, start) + 1;
  
  // Days Passed since Start of Cycle
  const daysPassed = differenceInCalendarDays(now, start) + 1;
  
  const timeProgress = (daysPassed / totalDaysInCycle) * 100;
  const spendProgress = limit > 0 ? (spent / limit) * 100 : 0;
  
  const daysRemainingExact = differenceInCalendarDays(end, now) + 1;

  const remainingBudget = Math.max(0, limit - spent);
  const dailyLimit = remainingBudget / Math.max(1, daysRemainingExact);

  // Status Logic
  let status: PacingStatus = 'safe';
  
  if (isOver) {
      status = 'danger';
  } else if (spendProgress > timeProgress + 10) {
    status = 'danger';
  } else if (spendProgress > timeProgress) {
    status = 'warning';
  }

  return {
    status,
    dailyLimit,
    timeProgress,
    spendProgress,
    daysRemaining: daysRemainingExact,
  };
}