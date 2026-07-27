import { GoalWizardState } from '@/hooks/useGoalWizard';
import { ShieldCheck, CalendarClock, Sparkles } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface GoalReviewStepProps {
  state: GoalWizardState;
}

const goalTypeConfig = {
  investment: {
    icon: ShieldCheck,
    label: 'Investment (Wealth)',
    color: 'text-chart-2',
    bgColor: 'bg-chart-2/10',
  },
  bill: {
    icon: CalendarClock,
    label: 'Bill (Sinking Fund)',
    color: 'text-chart-3',
    bgColor: 'bg-chart-3/10',
  },
  purchase: {
    icon: Sparkles,
    label: 'Purchase (Wishlist)',
    color: 'text-chart-1',
    bgColor: 'bg-chart-1/10',
  },
};

export function GoalReviewStep({ state }: GoalReviewStepProps) {
  const config = state.goalType ? goalTypeConfig[state.goalType] : null;
  const Icon = config?.icon;
  
  const targetAmount = parseFloat(state.targetAmount.replace(/,/g, '')) || 0;
  const monthlyContribution = parseFloat(state.monthlyContribution.replace(/,/g, '')) || 0;
  const monthsNeeded = monthlyContribution > 0 ? Math.ceil(targetAmount / monthlyContribution) : 0;

  return (
    <div className="px-4 py-4">
      <div className="rounded-xl border bg-muted/30 p-5 space-y-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
          )}
          <span className="text-sm font-medium text-muted-foreground">
            {config?.label}
          </span>
        </div>

        <h3 className="text-xl font-bold">{state.name || 'Untitled Goal'}</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target</span>
            <span className="font-semibold">
              Rp {new Intl.NumberFormat().format(targetAmount)}
            </span>
          </div>
          {state.targetDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date</span>
              <span className="font-medium">
                {format(state.targetDate, 'MMM yyyy')}
              </span>
            </div>
          )}
          {monthlyContribution > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly</span>
              <span className="font-medium">
                Rp {new Intl.NumberFormat().format(monthlyContribution)}
              </span>
            </div>
          )}
        </div>

        {monthsNeeded > 0 && (
          <>
            <div className="border-t border-dashed" />
            <p className="text-sm text-muted-foreground">
              You&apos;ll reach your goal in{' '}
              <span className="font-semibold text-foreground">{monthsNeeded} months</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
