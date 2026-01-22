import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Doc, Id } from '../convex/_generated/dataModel';
import { useHousehold } from '@/components/HouseholdProvider';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useGoalCalculator } from '@/hooks/useGoalCalculator';
import { AutoSaveFields } from './forms/AutoSaveFields';

const CategoryFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  targetAmount: z.string().optional(),
  targetDate: z.date().optional(),
  enablePacing: z.boolean(),
  goalType: z.enum(['investment', 'bill', 'purchase']).optional(),
  // Auto-Save Fields
  enableAutoSave: z.boolean(),
  autoSaveSourceAccountId: z.string().optional(),
  autoSaveAmount: z.string().optional(),
  autoSaveFrequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  autoSaveDay: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof CategoryFormSchema>;

type CategoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Doc<'categories'>;
  defaultType?: 'income' | 'expense' | 'saving';
};

const CategoryDrawer = ({ open, onOpenChange, category, defaultType }: CategoryDrawerProps) => {
  const { householdId } = useHousehold();
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const upsertSchedule = useMutation(api.automations.upsertSchedule);

  const isEditMode = !!category;
  const [isProcessing, setIsProcessing] = useState(false);
  const submitLock = React.useRef(false);

  // Fetch Existing Schedule
  const existingSchedule = useQuery(api.automations.getScheduleByGoal, 
    open && isEditMode && category ? { 
        linkedEntityId: category._id,
        householdId: householdId ?? undefined 
    } : "skip"
  );

  // Fetch Existing Budget (Correct Fiscal Month)
  const now = new Date();
  const existingBudget = useQuery(api.budgets.getBudgetStatus, {
      month: now.getMonth(),
      year: now.getFullYear(),
      householdId: householdId ?? undefined,
  });
  
  const currentCategoryBudget = existingBudget?.data?.find(b => b.category._id === category?._id)?.budget;

  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined });
  const liquidAccounts = React.useMemo(() => 
    accounts?.filter(a => !a.type || a.type === 'CASH') || [], 
  [accounts]);

  // Local State for Calculator
  const [monthlyContribution, setMonthlyContribution] = useState<string>('');

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(CategoryFormSchema),
    defaultValues: {
      name: '',
      type: defaultType || '',
      targetAmount: '',
      enablePacing: false,
      goalType: 'purchase',
      enableAutoSave: false,
      autoSaveFrequency: 'monthly',
      autoSaveDay: '25',
      autoSaveAmount: '',
      autoSaveSourceAccountId: '',
    }
  });

  const categoryType = useWatch({ control: form.control, name: 'type' });
  const targetAmountStr = useWatch({ control: form.control, name: 'targetAmount' });
  const targetDate = useWatch({ control: form.control, name: 'targetDate' });
  const enableAutoSave = useWatch({ control: form.control, name: 'enableAutoSave' });

  // Sync Form with Category & Schedule Data
  useEffect(() => {
    if (open && isEditMode && category) {
        // Find existing budget for monthlyContribution prefill
        // We rely on getGoalDetails if needed, but for simplicity we skip prefilling contrib here if not found.
        form.reset({
            name: category.name,
            type: category.type,
            targetAmount: category.targetAmount || '',
            targetDate: category.targetDate ? new Date(category.targetDate) : undefined,
            enablePacing: category.enablePacing || false,
            goalType: (category.goalType as 'investment' | 'bill' | 'purchase') || 'purchase',
            enableAutoSave: !!existingSchedule?.isEnabled,
            autoSaveSourceAccountId: existingSchedule?.fromAccountId || '',
            autoSaveAmount: existingSchedule?.amount || '',
            autoSaveFrequency: (existingSchedule?.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'monthly',
            autoSaveDay: existingSchedule?.nextRunAt ? new Date(existingSchedule.nextRunAt).getDate().toString() : '25',
        });
        
        if (existingSchedule?.amount) {
            setMonthlyContribution(existingSchedule.amount);
        } else if (currentCategoryBudget?.amount) {
            setMonthlyContribution(currentCategoryBudget.amount);
        }
    } else if (open && !isEditMode) {
        form.reset({
            name: '',
            type: defaultType || '',
            targetAmount: '',
            enablePacing: false,
            goalType: 'purchase',
            enableAutoSave: false,
            autoSaveFrequency: 'monthly',
            autoSaveDay: '25',
            autoSaveAmount: '',
            autoSaveSourceAccountId: '',
        });
        setMonthlyContribution('');
    }
  }, [open, isEditMode, category, existingSchedule, form, defaultType, currentCategoryBudget?.amount]);

  const formatNumber = (value: string | undefined) => {
    if (!value) return '';
    const parsed = parseFloat(value.replace(/,/g, ''));
    if (isNaN(parsed)) return '';
    return new Intl.NumberFormat('en-US').format(parsed);
  };

  // Derived Calculation for Alert Box using Hook
  const feedback = useGoalCalculator({
      targetAmountStr,
      monthlyContributionStr: monthlyContribution,
      targetDate
  });

  const handleApplyDate = (date: Date) => {
      form.setValue('targetDate', date);
  };

  const handleApplyContrib = (amount: number) => {
      setMonthlyContribution(new Intl.NumberFormat('en-US').format(Math.ceil(amount)));
      // Also sync to auto-save if enabled
      if (enableAutoSave) {
          form.setValue('autoSaveAmount', new Intl.NumberFormat('en-US').format(Math.ceil(amount)));
      }
  };

  const onSubmit = async (data: CategoryFormValues) => {
    if (submitLock.current || isProcessing) return;

    try {
        submitLock.current = true;
        setIsProcessing(true);

        // Normalize target date to prevent timezone shifts
        let targetDateStr: string | undefined = undefined;
        if (data.targetDate) {
            const selectedDate = new Date(data.targetDate);
            // Always set to 12:00 PM (noon) local time to prevent UTC timezone shifts from changing the date.
            selectedDate.setHours(12, 0, 0, 0);
            targetDateStr = selectedDate.toISOString();
        }

        const payload = {
            name: data.name,
            type: data.type,
            targetAmount: data.targetAmount,
            targetDate: targetDateStr,
            enablePacing: data.enablePacing,
            goalType: data.type === 'saving' ? data.goalType : undefined,
            monthlyBudget: monthlyContribution ? monthlyContribution.replace(/,/g, '') : undefined,
        };

        let finalCategoryId: Id<'categories'>;

        if (isEditMode && category) {
          await updateCategory({
            id: category._id,
            ...payload,
          });
          finalCategoryId = category._id;
        } else {
          finalCategoryId = await createCategory({
            ...payload,
            householdId: householdId ?? undefined,
          });
        }

        // --- Handle Auto-Save Schedule ---
        if (data.type === 'saving') {
            const destAccount = accounts?.find(a => a.linkedCategoryId === finalCategoryId);
            
            if (data.enableAutoSave) {
                if (!data.autoSaveSourceAccountId) throw new Error("Please select a source account for Auto-Save");
                
                // Calculate next run date
                const now = new Date();
                let nextRun = new Date(now.getFullYear(), now.getMonth(), parseInt(data.autoSaveDay || '25'));
                if (nextRun < now) {
                    nextRun = addMonths(nextRun, 1);
                }

                await upsertSchedule({
                    id: existingSchedule?._id,
                    householdId: householdId ?? undefined,
                    name: `Auto-Save: ${data.name}`,
                    amount: data.autoSaveAmount || monthlyContribution || '0',
                    fromAccountId: data.autoSaveSourceAccountId as Id<'accounts'>,
                    toAccountId: destAccount?._id,
                    linkedEntityId: finalCategoryId,
                    frequency: data.autoSaveFrequency || 'monthly',
                    nextRunAt: nextRun.getTime(),
                    isEnabled: true,
                });
            } else if (existingSchedule) {
                // Disable existing schedule if toggle was turned off
                await upsertSchedule({
                    id: existingSchedule._id,
                    isEnabled: false,
                    // Re-pass required fields for patch
                    name: existingSchedule.name,
                    amount: existingSchedule.amount,
                    fromAccountId: existingSchedule.fromAccountId,
                    frequency: existingSchedule.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
                    nextRunAt: existingSchedule.nextRunAt,
                });
            }
        }

        toast.success(isEditMode ? "Category updated" : "Category created");
        onOpenChange(false);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to save category";
        toast.error(message);
        setIsProcessing(false);
        submitLock.current = false;
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96dvh]">
        <div className="overflow-y-auto p-4 pb-safe">
          <DrawerHeader className="px-0">
            <DrawerTitle>{isEditMode ? 'Edit Category' : 'Create a new Category'}</DrawerTitle>
          </DrawerHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Food" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="saving">Saving / Goal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {categoryType === 'expense' && (
                <FormField
                  control={form.control}
                  name="enablePacing"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Smart Budget Pace
                        </FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Track daily spending pace for this category.
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {categoryType === 'saving' && (
                <div className="space-y-4 border-l-2 pl-4 border-primary/20 animate-in fade-in slide-in-from-top-2">
                    <FormField
                        control={form.control}
                        name="targetAmount"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Goal Target Amount</FormLabel>
                            <FormControl>
                            <Input 
                                placeholder="e.g., 50,000,000" 
                                {...field}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    field.onChange(formatNumber(value));
                                }} 
                            />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="targetDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Target Date</FormLabel>
                            <FormControl>
                                <DatePicker 
                                    date={field.value} 
                                    setDate={field.onChange}
                                    disabled={(date) => date < new Date("1900-01-01")}
                                    captionLayout="dropdown"
                                    fromDate={new Date()}
                                    toDate={new Date(new Date().getFullYear() + 30, 11, 31)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    {/* SMART CALCULATOR UI */}
                    <div className="pt-2 pb-2 animate-in fade-in slide-in-from-top-3">
                        <div className="flex items-center justify-between mb-2">
                            <FormLabel className="text-primary font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Monthly Contribution
                            </FormLabel>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Planner</span>
                        </div>
                        <Input 
                            placeholder="e.g. 500,000" 
                            value={monthlyContribution}
                            onChange={(e) => {
                                const val = formatNumber(e.target.value);
                                setMonthlyContribution(val);
                                if (enableAutoSave) form.setValue('autoSaveAmount', val);
                            }}
                        />
                        {/* Feedback Alert */}
                        {feedback && (
                            <div className={cn(
                                "mt-3 p-3 rounded-md text-sm flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-300",
                                feedback.status === 'early' ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : 
                                feedback.status === 'suggestion' ? "bg-primary/5 text-primary border border-primary/10" : 
                                feedback.status === 'info' ? "bg-primary/5 text-primary border border-primary/10" :
                                "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                            )}>
                                <div className="flex items-start gap-2 font-medium">
                                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span>{feedback.message}</span>
                                </div>
                                {(feedback.projectedDate || feedback.requiredContrib) && (
                                    <div className="flex flex-col gap-1.5 pl-6 mt-1">
                                        {feedback.projectedDate && (
                                            <button 
                                                type="button"
                                                onClick={() => handleApplyDate(feedback.projectedDate!)}
                                                className="text-xs text-left hover:underline font-semibold flex items-center gap-1"
                                            >
                                                <span>👉 {feedback.status === 'info' ? "Set target date to" : "Change date to"} {format(feedback.projectedDate, 'MMMM yyyy')}</span>
                                            </button>
                                        )}
                                        {feedback.requiredContrib && feedback.status !== 'info' && (
                                            <button 
                                                type="button"
                                                onClick={() => handleApplyContrib(feedback.requiredContrib!)}
                                                className="text-xs text-left hover:underline font-semibold flex items-center gap-1"
                                            >
                                                <span>👉 {feedback.status === 'suggestion' ? "Apply Suggestion:" : "Change contribution to"} {new Intl.NumberFormat('en-US').format(Math.ceil(feedback.requiredContrib))}</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* AUTO-SAVE SECTION */}
                    <AutoSaveFields 
                        form={form} 
                        liquidAccounts={liquidAccounts} 
                        formatNumber={formatNumber} 
                    />
                    
                    <FormField
                        control={form.control}
                        name="goalType"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Goal Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select goal type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="purchase">✨ Purchase (Wishlist)</SelectItem>
                                    <SelectItem value="bill">📅 Bill (Sinking Fund)</SelectItem>
                                    <SelectItem value="investment">🛡️ Investment (Wealth)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
              )}

              <div className="flex flex-col gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={isProcessing}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" disabled={isProcessing}>Cancel</Button>
                </DrawerClose>
              </div>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CategoryDrawer;