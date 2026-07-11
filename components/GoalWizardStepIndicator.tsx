import { cn } from '@/lib/utils';
import { ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoalWizardStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onClose: () => void;
  showBack?: boolean;
}

const stepTitles = [
  'Choose Goal Type',
  'Name & Target',
  'Timeline & Contribution',
  'Review & Create',
];

export function GoalWizardStepIndicator({
  currentStep,
  totalSteps,
  onBack,
  onClose,
  showBack = true,
}: GoalWizardStepIndicatorProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b">
      <div className="flex items-center gap-2">
        {showBack && currentStep > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <p className="text-xs text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </p>
          <p className="text-sm font-medium">{stepTitles[currentStep - 1]}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Step dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-full transition-all duration-300",
                i + 1 === currentStep
                  ? "bg-primary w-4"
                  : i + 1 < currentStep
                    ? "bg-primary/50"
                    : "bg-muted"
              )}
            />
          ))}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
