import { differenceInMonths, addMonths, format, isValid } from 'date-fns';

export type GoalFeedback = {
    status: 'suggestion' | 'early' | 'late' | 'info';
    message: string;
    requiredContrib?: number;
    projectedDate?: Date;
} | null;

type UseGoalCalculatorProps = {
    targetAmountStr?: string;
    monthlyContributionStr?: string;
    targetDate?: Date;
};

export const useGoalCalculator = ({
    targetAmountStr,
    monthlyContributionStr,
    targetDate
}: UseGoalCalculatorProps): GoalFeedback => {
    
    if (!targetAmountStr) return null;
    
    const amount = parseFloat(targetAmountStr.replace(/,/g, ''));
    const contrib = monthlyContributionStr ? parseFloat(monthlyContributionStr.replace(/,/g, '')) : 0;
    
    if (isNaN(amount)) return null;

    // Scenario 1: User set Date & Amount, but Contribution is empty (or 0)
    if (targetDate && contrib <= 0) {
        const selectedMonths = differenceInMonths(targetDate, new Date()) + (targetDate.getDate() >= new Date().getDate() ? 0 : 1);
        const divisor = Math.max(1, selectedMonths);
        const required = amount / divisor;
        
        return {
            status: 'suggestion',
            message: `To reach this by ${format(targetDate, 'MMM yyyy')}, set contribution to:`,
            requiredContrib: required
        };
    }

    // Scenario 2: User set Contribution (Calculated projection)
    if (contrib > 0) {
      const monthsNeeded = Math.ceil(amount / contrib);
      // Safety cap for months to prevent Date overflow (approx 270k years limit)
      // If monthsNeeded is absurdly high, projectedDate will be Invalid Date.
      const projectedDate = addMonths(new Date(), monthsNeeded);
      
      if (!isValid(projectedDate)) {
          return {
              status: 'late',
              message: "Contribution is too low to reach the goal in a reasonable time.",
              // No projectedDate implies we can't show "Change date to..."
          };
      }

      // 2. Compare with Selected Date (if any)
      if (targetDate) {
          const selectedMonths = differenceInMonths(targetDate, new Date()) + (targetDate.getDate() >= new Date().getDate() ? 0 : 1);
          const diff = selectedMonths - monthsNeeded;

          if (diff >= 1) { 
              return {
                  status: 'early',
                  message: "You'll finish this goal early!",
                  projectedDate,
                  requiredContrib: amount / Math.max(1, selectedMonths)
              };
          }
          
          if (diff <= -1) {
              return {
                  status: 'late',
                  message: "You won't make it by the target date.",
                  projectedDate,
                  requiredContrib: amount / Math.max(1, selectedMonths)
              };
          }
      } else {
          // If no date selected yet, just show projection with Action
          return {
              status: 'info',
              message: "Based on this contribution, you'll finish by:",
              projectedDate // Pass the date so UI can render a button
          };
      }
    }
    return null;
};
