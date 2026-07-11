import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatNumberInput } from '@/lib/utils';

interface GoalNameTargetStepProps {
  name: string;
  targetAmount: string;
  onNameChange: (value: string) => void;
  onTargetAmountChange: (value: string) => void;
}

export function GoalNameTargetStep({
  name,
  targetAmount,
  onNameChange,
  onTargetAmountChange,
}: GoalNameTargetStepProps) {
  return (
    <div className="space-y-5 px-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="goal-name" className="text-sm font-medium">
          Goal Name
        </Label>
        <Input
          id="goal-name"
          placeholder="e.g., Emergency Fund"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          autoFocus
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="goal-target" className="text-sm font-medium">
          Target Amount
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            Rp
          </span>
          <Input
            id="goal-target"
            type="text"
            inputMode="numeric"
            placeholder="0"
            className="pl-10"
            value={targetAmount}
            onChange={(e) => {
              const formatted = formatNumberInput(e.target.value);
              onTargetAmountChange(formatted);
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Enter amount without currency symbol
        </p>
      </div>
    </div>
  );
}
