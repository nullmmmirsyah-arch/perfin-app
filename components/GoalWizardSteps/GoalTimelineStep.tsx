import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { useGoalCalculator } from '@/hooks/useGoalCalculator';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface GoalTimelineStepProps {
  targetAmount: string;
  targetDate: Date | undefined;
  monthlyContribution: string;
  onTargetDateChange: (date: Date | undefined) => void;
  onMonthlyContributionChange: (value: string) => void;
}

const formatNumber = (value: string) => {
  const cleanValue = value.replace(/[^\d]/g, '');
  return new Intl.NumberFormat('en-US').format(parseInt(cleanValue) || 0);
};

export function GoalTimelineStep({
  targetAmount,
  targetDate,
  monthlyContribution,
  onTargetDateChange,
  onMonthlyContributionChange,
}: GoalTimelineStepProps) {
  const feedback = useGoalCalculator({
    targetAmountStr: targetAmount,
    monthlyContributionStr: monthlyContribution,
    targetDate,
  });

  return (
    <div className="space-y-5 px-4 py-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Target Date (Optional)</Label>
        <DatePicker
          date={targetDate}
          setDate={onTargetDateChange}
          disabled={(date) => date < new Date("1900-01-01")}
          captionLayout="dropdown"
          fromDate={new Date()}
          toDate={new Date(new Date().getFullYear() + 30, 11, 31)}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="monthly-contribution" className="text-sm font-medium">
          Monthly Contribution
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            Rp
          </span>
          <Input
            id="monthly-contribution"
            type="text"
            inputMode="numeric"
            placeholder="0"
            className="pl-10"
            value={monthlyContribution}
            onChange={(e) => {
              const formatted = formatNumber(e.target.value);
              onMonthlyContributionChange(formatted);
            }}
          />
        </div>
      </div>

      {feedback && (
        <div className={cn(
          "p-3 rounded-lg text-sm flex items-start gap-2",
          feedback.status === 'early'
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
            : feedback.status === 'suggestion' || feedback.status === 'info'
              ? "bg-primary/5 text-primary border border-primary/10"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        )}>
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="font-medium">{feedback.message}</p>
            {feedback.projectedDate && (
              <button
                type="button"
                onClick={() => onTargetDateChange(feedback.projectedDate)}
                className="text-xs underline font-semibold"
              >
                Set date to {format(feedback.projectedDate, 'MMMM yyyy')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
