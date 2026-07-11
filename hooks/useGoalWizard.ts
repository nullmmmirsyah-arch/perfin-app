import { useState, useCallback } from 'react';

export type GoalType = 'investment' | 'bill' | 'purchase';

export interface GoalWizardState {
  currentStep: number;
  goalType: GoalType | null;
  name: string;
  targetAmount: string;
  targetDate: Date | undefined;
  monthlyContribution: string;
  enableAutoSave: boolean;
  autoSaveSourceAccountId: string;
  autoSaveAmount: string;
  autoSaveFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  autoSaveDay: string;
}

const TOTAL_STEPS = 4;

const initialState: GoalWizardState = {
  currentStep: 1,
  goalType: null,
  name: '',
  targetAmount: '',
  targetDate: undefined,
  monthlyContribution: '',
  enableAutoSave: false,
  autoSaveSourceAccountId: '',
  autoSaveAmount: '',
  autoSaveFrequency: 'monthly',
  autoSaveDay: '25',
};

export function useGoalWizard() {
  const [state, setState] = useState<GoalWizardState>(initialState);
  const [isDirty, setIsDirty] = useState(false);

  const setStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, currentStep: Math.max(1, Math.min(step, TOTAL_STEPS)) }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({ ...prev, currentStep: Math.min(prev.currentStep + 1, TOTAL_STEPS) }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({ ...prev, currentStep: Math.max(prev.currentStep - 1, 1) }));
  }, []);

  const updateField = useCallback(<K extends keyof GoalWizardState>(
    field: K,
    value: GoalWizardState[K]
  ) => {
    setState(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
    setIsDirty(false);
  }, []);

  const canProceed = useCallback(() => {
    switch (state.currentStep) {
      case 1: return state.goalType !== null;
      case 2: return state.name.trim().length > 0 && parseFloat(state.targetAmount.replace(/,/g, '')) > 0;
      case 3: return true; // All fields optional
      case 4: return true; // Review step
      default: return false;
    }
  }, [state]);

  return {
    state,
    isDirty,
    setStep,
    nextStep,
    prevStep,
    updateField,
    reset,
    canProceed,
    totalSteps: TOTAL_STEPS,
  };
}
