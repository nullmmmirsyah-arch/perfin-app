import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { useGoalCalculator } from '@/hooks/useGoalCalculator';
import { AlertCircle } from '@/components/ui/icons';
import { cn, formatNumberInput } from '@/lib/utils';
import { format } from 'date-fns';

interface GoalTimelineStepProps {
  targetAmount: string;
  targetDate: Date | undefined;
  monthlyContribution: string;
  onTargetDateChange: (date: Date | undefined) => void;
  onMonthlyContributionChange: (value: string) => void;
}

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
              const formatted = formatNumberInput(e.target.value);
              onMonthlyContributionChange(formatted);
            }}
          />
        </div>
      </div>

      {feedback && (
        <div className={cn(
          "p-4 rounded-xl text-sm flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2",
          feedback.status === 'early'
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
            : feedback.status === 'suggestion' || feedback.status === 'info'
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
        )}>
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="space-y-3 flex-1">
            <p className="font-medium leading-relaxed">{feedback.message}</p>
            {feedback.requiredContrib && feedback.status !== 'info' && (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  Rp {new Intl.NumberFormat().format(Math.ceil(feedback.requiredContrib))}
                </span>
                <span className="text-xs opacity-70">/month</span>
              </div>
            )}
            {feedback.projectedDate && (
              <button
                type="button"
                onClick={() => onTargetDateChange(feedback.projectedDate)}
                className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
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
