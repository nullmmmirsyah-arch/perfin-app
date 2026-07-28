/**
 * AllowanceCalculator — Pure TypeScript module for budget allowance pacing.
 *
 * This module performs ONLY calculations. It has no React, no Convex, and no
 * transaction queries. All values must be passed in by the caller.
 *
 * Allowance is a recommendation layer — it NEVER affects budget allocation,
 * remaining budget calculations, or month-end processing.
 */

export type AllowanceType = "budget_period" | "weekly";

export interface AllowanceInput {
  allowanceType: AllowanceType;
  weeklyResetDay?: number;       // 0=Sunday, 1=Monday, ..., 6=Saturday
  budgetAmount: number;          // effective limit (assigned + carryover - swept)
  spent: number;                 // current fiscal period spending
  weeklySpent: number;           // pre-computed by caller
  fiscalPeriodStart: Date;
  fiscalPeriodEnd: Date;
  now: Date;
}

export interface AllowanceResult {
  type: AllowanceType;
  remaining: number;
  daysRemaining: number;
  allowance: number;
  // Weekly-only fields:
  weekNumber?: number;
  weekStart?: Date;
  weekEnd?: Date;
  weeklyRemaining?: number;
  daysRemainingInWeek?: number;
}

/**
 * Splits a fiscal period into week segments based on the reset day.
 * Short weeks (start/end of period) receive proportional allowance.
 */
function splitIntoWeekSegments(
  start: Date,
  end: Date,
  resetDay: number
): { start: Date; end: Date; days: number }[] {
  const segments: { start: Date; end: Date; days: number }[] = [];
  
  // Find the first reset day on or after the period start
  const startDayOfWeek = start.getDay();
  let firstResetOffset = (resetDay - startDayOfWeek + 7) % 7;
  
  let segStart = new Date(start);
  segStart.setHours(0, 0, 0, 0);
  
  // If the period starts on a reset day, the first segment starts there
  // Otherwise, the first segment is a partial week from start to the first reset day
  if (firstResetOffset > 0) {
    const firstEnd = new Date(start);
    firstEnd.setDate(firstEnd.getDate() + firstResetOffset - 1);
    firstEnd.setHours(23, 59, 59, 999);
    
    if (firstEnd <= end) {
      const days = Math.floor((firstEnd.getTime() - segStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      segments.push({ start: new Date(segStart), end: new Date(firstEnd), days });
      segStart = new Date(firstEnd);
      segStart.setDate(segStart.getDate() + 1);
      segStart.setHours(0, 0, 0, 0);
    }
  }
  
  // Full weeks from the first reset day onwards
  while (segStart <= end) {
    const weekEnd = new Date(segStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    const actualEnd = weekEnd > end ? end : weekEnd;
    const days = Math.floor((actualEnd.getTime() - segStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    segments.push({ start: new Date(segStart), end: new Date(actualEnd), days });
    
    segStart = new Date(actualEnd);
    segStart.setDate(segStart.getDate() + 1);
    segStart.setHours(0, 0, 0, 0);
  }
  
  return segments;
}

/**
 * Finds the current active week segment.
 */
function findCurrentWeek(
  segments: { start: Date; end: Date; days: number }[],
  now: Date
): { index: number; segment: { start: Date; end: Date; days: number } } | null {
  for (let i = 0; i < segments.length; i++) {
    if (now >= segments[i].start && now <= segments[i].end) {
      return { index: i, segment: segments[i] };
    }
  }
  // If past all segments, return the last one
  if (segments.length > 0 && now > segments[segments.length - 1].end) {
    const last = segments.length - 1;
    return { index: last, segment: segments[last] };
  }
  return null;
}

/**
 * Calculates the recommended spending allowance based on the configured pacing type.
 *
 * @param input - All values must be pre-computed by the caller
 * @returns Allowance result with remaining, allowance, and weekly details (if applicable)
 */
export function calculateAllowance(input: AllowanceInput): AllowanceResult {
  const {
    allowanceType,
    weeklyResetDay = 1,
    budgetAmount,
    spent,
    weeklySpent,
    fiscalPeriodStart,
    fiscalPeriodEnd,
    now,
  } = input;

  const remaining = Math.max(0, budgetAmount - spent);
  
  // Days remaining in fiscal period (inclusive of today)
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.max(1, Math.floor((fiscalPeriodEnd.getTime() - now.getTime()) / msPerDay) + 1);

  if (allowanceType === "budget_period") {
    return {
      type: "budget_period",
      remaining,
      daysRemaining,
      allowance: daysRemaining > 0 ? remaining / daysRemaining : 0,
    };
  }

  // Weekly mode
  const segments = splitIntoWeekSegments(fiscalPeriodStart, fiscalPeriodEnd, weeklyResetDay);
  const currentWeek = findCurrentWeek(segments, now);

  if (!currentWeek) {
    // Fallback: treat as budget_period
    return {
      type: "weekly",
      remaining,
      daysRemaining,
      allowance: daysRemaining > 0 ? remaining / daysRemaining : 0,
    };
  }

  const { index: weekIndex, segment } = currentWeek;
  const dailyAllowance = daysRemaining > 0 ? remaining / daysRemaining : 0;
  const weeklyAllowance = dailyAllowance * segment.days;
  const weeklyRemaining = Math.max(0, weeklyAllowance - weeklySpent);
  
  const daysRemainingInWeek = Math.max(1, Math.floor((segment.end.getTime() - now.getTime()) / msPerDay) + 1);
  const allowance = daysRemainingInWeek > 0 ? weeklyRemaining / daysRemainingInWeek : 0;

  return {
    type: "weekly",
    remaining,
    daysRemaining,
    allowance,
    weekNumber: weekIndex + 1,
    weekStart: segment.start,
    weekEnd: segment.end,
    weeklyRemaining,
    daysRemainingInWeek,
  };
}
