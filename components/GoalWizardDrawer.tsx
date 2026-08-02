import React, { useEffect, useState, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useHousehold } from '@/components/HouseholdProvider';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, PartyPopper } from '@/components/ui/icons';
import confetti from 'canvas-confetti';
import { useGoalWizard } from '@/hooks/useGoalWizard';
import { GoalWizardStepIndicator } from './GoalWizardStepIndicator';
import { GoalTypeStep } from './GoalWizardSteps/GoalTypeStep';
import { GoalNameTargetStep } from './GoalWizardSteps/GoalNameTargetStep';
import { GoalTimelineStep } from './GoalWizardSteps/GoalTimelineStep';
import { GoalReviewStep } from './GoalWizardSteps/GoalReviewStep';
import { addMonths } from 'date-fns';

interface GoalWizardDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editGoal?: {
    _id: Id<'categories'>;
    name: string;
    targetAmount?: string;
    targetDate?: string;
    goalType?: 'investment' | 'bill' | 'purchase';
  };
}

const confettiColors = {
  investment: ['#3b82f6', '#60a5fa', '#93c5fd'],
  bill: ['#22c55e', '#4ade80', '#86efac'],
  purchase: ['#a855f7', '#c084fc', '#d8b4fe'],
};

export function GoalWizardDrawer({ open, onOpenChange, editGoal }: GoalWizardDrawerProps) {
  const { householdId } = useHousehold();
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const upsertSchedule = useMutation(api.automations.upsertSchedule);

  const wizard = useGoalWizard();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successGoalName, setSuccessGoalName] = useState('');
  const submitLock = React.useRef(false);

  const isEditMode = !!editGoal;

  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined });

  // Reset wizard when drawer opens
  useEffect(() => {
    if (open) {
      wizard.reset();
      setIsProcessing(false);
      submitLock.current = false;
      setIsSuccess(false);
      setSuccessGoalName('');

      if (editGoal) {
        wizard.updateField('goalType', editGoal.goalType || 'purchase');
        wizard.updateField('name', editGoal.name);
        wizard.updateField('targetAmount', editGoal.targetAmount || '');
        if (editGoal.targetDate) {
          wizard.updateField('targetDate', new Date(editGoal.targetDate));
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editGoal]);

  // Back button handling
  useEffect(() => {
    if (open) {
      window.history.pushState({ drawer: 'goal-wizard' }, '', window.location.href);

      const handlePopState = () => {
        if (wizard.isDirty) {
          window.history.pushState({ drawer: 'goal-wizard' }, '', window.location.href);
          setShowDiscardDialog(true);
        } else {
          onOpenChange(false);
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [open, wizard.isDirty, onOpenChange]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && wizard.isDirty) {
      setShowDiscardDialog(true);
      return;
    }
    onOpenChange(newOpen);
  };

  const handleDiscard = () => {
    setShowDiscardDialog(false);
    wizard.reset();
    onOpenChange(false);
  };

  const fireConfetti = useCallback((goalType: 'investment' | 'bill' | 'purchase') => {
    const colors = confettiColors[goalType];
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
    });

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
    }, 250);

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
    }, 400);
  }, []);

  const onSubmit = async () => {
    if (submitLock.current || isProcessing) return;

    try {
      submitLock.current = true;
      setIsProcessing(true);

      const { state } = wizard;

      // Normalize target date
      let targetDateStr: string | undefined = undefined;
      if (state.targetDate) {
        const selectedDate = new Date(state.targetDate);
        selectedDate.setHours(12, 0, 0, 0);
        targetDateStr = selectedDate.toISOString();
      }

      const payload = {
        name: state.name,
        type: 'saving' as const,
        targetAmount: state.targetAmount,
        targetDate: targetDateStr,
        enablePacing: false,
        goalType: state.goalType as 'investment' | 'bill' | 'purchase',
      };

      let finalCategoryId: Id<'categories'>;

      if (isEditMode && editGoal) {
        await updateCategory({
          id: editGoal._id,
          ...payload,
        });
        finalCategoryId = editGoal._id;
      } else {
        finalCategoryId = await createCategory({
          ...payload,
          householdId: householdId ?? undefined,
        });
      }

      // Handle Auto-Save
      if (state.enableAutoSave && !isEditMode) {
        const destAccount = accounts?.find(a => a.linkedCategoryId === finalCategoryId);
        
        if (!state.autoSaveSourceAccountId) {
          throw new Error("Please select a source account for Auto-Save");
        }

        const now = new Date();
        let nextRun = new Date(now.getFullYear(), now.getMonth(), parseInt(state.autoSaveDay || '25'));
        if (nextRun < now) {
          nextRun = addMonths(nextRun, 1);
        }

        await upsertSchedule({
          householdId: householdId ?? undefined,
          name: `Auto-Save: ${state.name}`,
          amount: state.autoSaveAmount || state.monthlyContribution || '0',
          fromAccountId: state.autoSaveSourceAccountId as Id<'accounts'>,
          toAccountId: destAccount?._id,
          linkedEntityId: finalCategoryId,
          frequency: state.autoSaveFrequency,
          nextRunAt: nextRun.getTime(),
          isEnabled: true,
        });
      }

      // Success!
      setSuccessGoalName(state.name);
      setIsSuccess(true);
      
      if (!isEditMode) {
        fireConfetti(state.goalType || 'purchase');
        
        // Play success sound
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
          oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
          oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.4);
        } catch {
          // Audio not supported, skip
        }
      }

      toast.success(isEditMode ? "Goal updated" : "Goal created!");
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        wizard.reset();
        onOpenChange(false);
      }, 2000);

    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save goal";
      toast.error(message);
      setIsProcessing(false);
      submitLock.current = false;
    }
  };

  const handleNext = () => {
    if (wizard.canProceed()) {
      wizard.nextStep();
    }
  };

  // Success overlay
  if (isSuccess) {
    return (
      <Drawer open={open} onOpenChange={() => {}}>
        <DrawerContent className="max-h-[96dvh]">
          <DrawerHeader>
            <DrawerTitle>Goal Created!</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col items-center justify-center py-16 px-4 space-y-6">
            <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center animate-in fade-in zoom-in-95">
              <PartyPopper className="h-10 w-10 text-success" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                You&apos;re on your way to <span className="font-semibold text-foreground">{successGoalName}</span>!
              </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[96dvh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Create Goal</DrawerTitle>
        </DrawerHeader>
        <GoalWizardStepIndicator
          currentStep={wizard.state.currentStep}
          totalSteps={wizard.totalSteps}
          onBack={wizard.prevStep}
          onClose={() => handleOpenChange(false)}
          showBack={wizard.state.currentStep > 1}
        />

        <div className="flex-1 overflow-y-auto">
          {wizard.state.currentStep === 1 && (
            <GoalTypeStep
              selectedType={wizard.state.goalType}
              onSelect={(type) => {
                wizard.updateField('goalType', type);
                setTimeout(() => wizard.nextStep(), 300);
              }}
            />
          )}

          {wizard.state.currentStep === 2 && (
            <GoalNameTargetStep
              name={wizard.state.name}
              targetAmount={wizard.state.targetAmount}
              onNameChange={(value) => wizard.updateField('name', value)}
              onTargetAmountChange={(value) => wizard.updateField('targetAmount', value)}
            />
          )}

          {wizard.state.currentStep === 3 && (
            <GoalTimelineStep
              targetAmount={wizard.state.targetAmount}
              targetDate={wizard.state.targetDate}
              monthlyContribution={wizard.state.monthlyContribution}
              onTargetDateChange={(date) => wizard.updateField('targetDate', date)}
              onMonthlyContributionChange={(value) => wizard.updateField('monthlyContribution', value)}
            />
          )}

          {wizard.state.currentStep === 4 && (
            <GoalReviewStep state={wizard.state} />
          )}
        </div>

        <div className="p-4 border-t space-y-2">
          {wizard.state.currentStep < wizard.totalSteps ? (
            <Button
              className="w-full"
              onClick={handleNext}
              disabled={!wizard.canProceed()}
            >
              Continue
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={onSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                '🎉 Create Goal'
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
        </div>
      </DrawerContent>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscardDialog(false)}>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
}
