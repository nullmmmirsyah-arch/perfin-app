import { differenceInMonths } from "date-fns";

export type PacingStatus = 'safe' | 'warning' | 'danger';

export interface PacingResult {
  status: PacingStatus;
  dailyLimit: number;
  timeProgress: number;
  spendProgress: number;
  daysRemaining: number;
}

export function calculateGoalStrategy(
  currentAmount: number,
  targetAmount: number,
  targetDateStr?: string
) {
  if (!targetAmount || !targetDateStr) return null;

  const now = new Date();
  const targetDate = new Date(targetDateStr);
  
  if (targetDate <= now) return null; // Already passed or today

  const remainingAmount = Math.max(0, targetAmount - currentAmount);
  if (remainingAmount === 0) return { monthly: 0, months: 0, isDone: true };

  // Calculate months remaining (including current month)
  const monthsRemaining = differenceInMonths(targetDate, now) + (targetDate.getDate() >= now.getDate() ? 0 : 1);
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
  year: number,
  month: number
): PacingResult {
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  
  // If not current month, it's either past or future.
  // For past: if spent > limit then danger, else safe.
  // For future: always safe.
  if (!isCurrentMonth) {
    const isPast = new Date(year, month) < new Date(now.getFullYear(), now.getMonth());
    if (isPast) {
      return {
        status: spent > limit ? 'danger' : 'safe',
        dailyLimit: 0,
        timeProgress: 100,
        spendProgress: (spent / limit) * 100,
        daysRemaining: 0,
      };
    }
    return {
      status: 'safe',
      dailyLimit: limit / 30, // Approximation
      timeProgress: 0,
      spendProgress: 0,
      daysRemaining: 30,
    };
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  const timeProgress = (currentDay / daysInMonth) * 100;
  const spendProgress = limit > 0 ? (spent / limit) * 100 : 0;
  const daysRemaining = daysInMonth - currentDay + 1; // including today

  const remainingBudget = Math.max(0, limit - spent);
  const dailyLimit = remainingBudget / daysRemaining;

  // Tolerance of 10%
  let status: PacingStatus = 'safe';
  if (spendProgress > timeProgress + 10) {
    status = 'danger';
  } else if (spendProgress > timeProgress) {
    status = 'warning';
  }

  // Also if spent > limit, it's always danger
  if (spent > limit) status = 'danger';

  return {
    status,
    dailyLimit,
    timeProgress,
    spendProgress,
    daysRemaining,
  };
}
