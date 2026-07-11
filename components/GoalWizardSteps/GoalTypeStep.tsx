import { cn } from '@/lib/utils';
import { ShieldCheck, CalendarClock, Sparkles } from 'lucide-react';
import { GoalType } from '@/hooks/useGoalWizard';

interface GoalTypeStepProps {
  selectedType: GoalType | null;
  onSelect: (type: GoalType) => void;
}

const goalTypes = [
  {
    type: 'investment' as GoalType,
    icon: ShieldCheck,
    title: 'Investment (Wealth)',
    description: 'Long-term accumulation for financial security',
    color: 'text-chart-2',
    bgColor: 'bg-chart-2/10',
    borderColor: 'border-chart-2/30',
    selectedBg: 'bg-chart-2/20',
  },
  {
    type: 'bill' as GoalType,
    icon: CalendarClock,
    title: 'Bill (Sinking Fund)',
    description: 'Recurring obligations like annual tax or insurance',
    color: 'text-chart-3',
    bgColor: 'bg-chart-3/10',
    borderColor: 'border-chart-3/30',
    selectedBg: 'bg-chart-3/20',
  },
  {
    type: 'purchase' as GoalType,
    icon: Sparkles,
    title: 'Purchase (Wishlist)',
    description: 'One-off purchases like vacation or gadgets',
    color: 'text-chart-1',
    bgColor: 'bg-chart-1/10',
    borderColor: 'border-chart-1/30',
    selectedBg: 'bg-chart-1/20',
  },
];

export function GoalTypeStep({ selectedType, onSelect }: GoalTypeStepProps) {
  return (
    <div className="space-y-3 px-4 py-4">
      <p className="text-sm text-muted-foreground mb-4">
        What kind of goal are you creating?
      </p>
      
      {goalTypes.map((goal) => {
        const isSelected = selectedType === goal.type;
        const Icon = goal.icon;
        
        return (
          <button
            key={goal.type}
            type="button"
            onClick={() => onSelect(goal.type)}
            className={cn(
              "w-full p-4 rounded-xl border-2 text-left transition-all duration-200",
              "active:scale-[0.98]",
              isSelected
                ? `${goal.selectedBg} ${goal.borderColor} shadow-sm`
                : "border-border hover:border-border/80 hover:bg-muted/50"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-lg", goal.bgColor)}>
                <Icon className={cn("h-5 w-5", goal.color)} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base">{goal.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {goal.description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
