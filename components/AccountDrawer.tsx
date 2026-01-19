import React, { useEffect, useMemo, useState } from 'react';
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
  DrawerFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useGoalCalculator } from '@/hooks/useGoalCalculator';
import { AutoSaveFields } from './forms/AutoSaveFields';

const AccountFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  balance: z.string().refine(val => !isNaN(parseFloat(val.replace(/,/g, ''))), {
    message: 'Balance must be a number',
  }),
  type: z.enum(['CASH', 'ASSET', 'SAVING']),
  initialQuantity: z.string().optional(),
  unit: z.string().optional(),
  targetAmount: z.string().optional(),
  targetDate: z.date().optional(),
  enableGoal: z.boolean().optional(),
  goalType: z.enum(['investment', 'bill', 'purchase']).optional(),
  // New Fields
  monthlyBudget: z.string().optional(),
  enableAutoSave: z.boolean().optional(),
  autoSaveSourceAccountId: z.string().optional(),
  autoSaveAmount: z.string().optional(),
  autoSaveFrequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  autoSaveDay: z.string().optional(),
});

type AccountFormValues = z.infer<typeof AccountFormSchema>;

type AccountDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Doc<'accounts'>;
};

const formatNumber = (value: string | undefined) => {
  if (!value) return '';
  const parsed = parseFloat(value.replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US').format(parsed);
};

const AccountDrawer = ({ open, onOpenChange, account }: AccountDrawerProps) => {
  const { householdId } = useHousehold();
  const createAccount = useMutation(api.accounts.create);
  const updateAccount = useMutation(api.accounts.update);
  const upsertSchedule = useMutation(api.automations.upsertSchedule);

  const categories = useQuery(api.categories.get, { householdId: householdId ?? undefined, showArchived: true });
  
  // Fetch Liquid Accounts for Auto-Save Source
  const allAccounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined });
  const liquidAccounts = useMemo(() => 
    allAccounts?.filter(a => !a.type || a.type === 'CASH') || [], 
  [allAccounts]);

  const isEditMode = !!account;
  const [isProcessing, setIsProcessing] = useState(false);
  const submitLock = React.useRef(false);

  // Fetch Existing Schedule and Goal Details (for budget)
  const linkedCategoryId = account?.linkedCategoryId;
  
  const existingSchedule = useQuery(api.automations.getScheduleByGoal, 
    open && isEditMode && linkedCategoryId ? { 
        linkedEntityId: linkedCategoryId,
        householdId: householdId ?? undefined 
    } : "skip"
  );

  const goalDetails = useQuery(api.categories.getGoalDetails,
    open && isEditMode && linkedCategoryId ? {
        id: linkedCategoryId,
        householdId: householdId ?? undefined
    } : "skip"
  );

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(AccountFormSchema),
    defaultValues: {
      name: '',
      balance: '',
      type: 'CASH',
      initialQuantity: '',
      unit: '',
      targetAmount: '',
      targetDate: undefined,
      enableGoal: false,
      goalType: 'purchase',
      monthlyBudget: '',
      enableAutoSave: false,
      autoSaveFrequency: 'monthly',
      autoSaveDay: '25',
      autoSaveAmount: '',
      autoSaveSourceAccountId: '',
    },
  });

  const { formState: { isSubmitting } } = form;

  const accountType = useWatch({ control: form.control, name: 'type' });
  const enableGoal = useWatch({ control: form.control, name: 'enableGoal' });
  const enableAutoSave = useWatch({ control: form.control, name: 'enableAutoSave' });
  const targetAmountStr = useWatch({ control: form.control, name: 'targetAmount' });
  const targetDate = useWatch({ control: form.control, name: 'targetDate' });
  const monthlyBudgetStr = useWatch({ control: form.control, name: 'monthlyBudget' });

  useEffect(() => {
    if (open && isEditMode && account) {
      // Find linked category to prepopulate goal data
      const linkedCategory = categories?.find(c => c._id === account.linkedCategoryId);
      
      form.reset({
        name: account.name,
        balance: account.balance,
        type: (account.type as 'CASH' | 'ASSET' | 'SAVING') || 'CASH',
        initialQuantity: account.initialQuantity || '',
        unit: account.unit || '',
        targetAmount: linkedCategory?.targetAmount || '',
        targetDate: linkedCategory?.targetDate ? new Date(linkedCategory.targetDate) : undefined,
        enableGoal: !!linkedCategory?.targetAmount, // Enable if target exists
        goalType: (linkedCategory?.goalType as 'investment' | 'bill' | 'purchase') || 'purchase',
        // New Fields Pre-fill
        monthlyBudget: goalDetails?.currentBudget?.amount || '',
        enableAutoSave: !!existingSchedule?.isEnabled,
        autoSaveSourceAccountId: existingSchedule?.fromAccountId || '',
        autoSaveAmount: existingSchedule?.amount || '',
        autoSaveFrequency: (existingSchedule?.frequency as any) || 'monthly',
        autoSaveDay: existingSchedule?.nextRunAt ? new Date(existingSchedule.nextRunAt).getDate().toString() : '25',
      });
    } else if (open && !isEditMode) {
      form.reset({
        name: '',
        balance: '',
        type: 'CASH',
        initialQuantity: '',
        unit: '',
        targetAmount: '',
        targetDate: undefined,
        enableGoal: false,
        goalType: 'purchase',
        monthlyBudget: '',
        enableAutoSave: false,
        autoSaveFrequency: 'monthly',
        autoSaveDay: '25',
        autoSaveAmount: '',
        autoSaveSourceAccountId: '',
      });
    }
  }, [open, isEditMode, account, form, categories, existingSchedule, goalDetails]);

  // Derived Calculation for Alert Box using Hook
  const feedback = useGoalCalculator({
      targetAmountStr,
      monthlyContributionStr: monthlyBudgetStr,
      targetDate
  });

  const handleApplyDate = (date: Date) => {
    form.setValue('targetDate', date);
  };

  const handleApplyContrib = (amount: number) => {
    const val = new Intl.NumberFormat('en-US').format(Math.ceil(amount));
    form.setValue('monthlyBudget', val);
    // Also sync to auto-save if enabled
    if (enableAutoSave) {
        form.setValue('autoSaveAmount', val);
    }
  };

  const onSubmit = async (data: AccountFormValues) => {
    if (submitLock.current || isProcessing) return;

    try {
        submitLock.current = true;
        setIsProcessing(true);

        // Normalize target date to prevent timezone shifts
        let targetDateStr: string | undefined = undefined;
        if (data.enableGoal && data.targetDate) {
            const now = new Date();
            const selectedDate = new Date(data.targetDate);
            const isToday = selectedDate.toDateString() === now.toDateString();
            
            if (isToday) {
                selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            } else {
                selectedDate.setHours(12, 0, 0, 0);
            }
            targetDateStr = selectedDate.toISOString();
        }

        const payload = {
            name: data.name,
            balance: data.balance,
            type: data.type,
            initialQuantity: data.initialQuantity,
            unit: data.unit,
            targetAmount: data.enableGoal ? data.targetAmount : undefined,
            targetDate: targetDateStr,
            goalType: data.enableGoal ? data.goalType : undefined,
            monthlyBudget: data.monthlyBudget ? data.monthlyBudget.replace(/,/g, '') : undefined,
        };

        let result;
        if (isEditMode && account) {
          await updateAccount({
            id: account._id,
            ...payload,
          });
          result = { linkedCategoryId: account.linkedCategoryId }; 
        } else {
          result = await createAccount({
            householdId: householdId ?? undefined,
            ...payload,
          });
        }

        let targetCategoryId: Id<'categories'> | undefined;
        if (isEditMode) {
             // @ts-ignore
            targetCategoryId = result?.linkedCategoryId ?? account?.linkedCategoryId; 
        } else {
             // @ts-ignore
            targetCategoryId = result?.linkedCategoryId;
        }

        if ((data.type === 'SAVING' || data.type === 'ASSET') && data.enableGoal && targetCategoryId) {
            if (data.enableAutoSave) {
                if (!data.autoSaveSourceAccountId) throw new Error("Please select a source account for Auto-Save");
                
                const now = new Date();
                let nextRun = new Date(now.getFullYear(), now.getMonth(), parseInt(data.autoSaveDay || '25'));
                if (nextRun < now) {
                    nextRun = addMonths(nextRun, 1);
                }

                await upsertSchedule({
                    id: existingSchedule?._id,
                    householdId: householdId ?? undefined,
                    name: `Auto-Save: ${data.name}`,
                    amount: data.autoSaveAmount || data.monthlyBudget || '0',
                    fromAccountId: data.autoSaveSourceAccountId as Id<'accounts'>,
                    toAccountId: isEditMode ? account?._id : (result as any).accountId,
                    linkedEntityId: targetCategoryId,
                    frequency: data.autoSaveFrequency || 'monthly',
                    nextRunAt: nextRun.getTime(),
                    isEnabled: true,
                });
            } else if (existingSchedule) {
                await upsertSchedule({
                    id: existingSchedule._id,
                    isEnabled: false,
                    name: existingSchedule.name,
                    amount: existingSchedule.amount,
                    fromAccountId: existingSchedule.fromAccountId,
                    frequency: existingSchedule.frequency as any,
                    nextRunAt: existingSchedule.nextRunAt,
                });
            }
        }
        
        toast.success(isEditMode ? "Account updated" : "Account created");
        onOpenChange(false);
    } catch (error: any) {
        toast.error(error.message || "Failed to save account");
        setIsProcessing(false);
        submitLock.current = false;
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-dvh flex flex-col">
        <DrawerHeader>
          <DrawerTitle>{isEditMode ? 'Edit Account' : 'Create a new Account'}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto p-4 pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                        <Tabs 
                            value={field.value} 
                            onValueChange={(val: string) => field.onChange(val as 'CASH' | 'ASSET' | 'SAVING')} 
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="CASH">Cash</TabsTrigger>
                                <TabsTrigger value="SAVING">Saving</TabsTrigger>
                                <TabsTrigger value="ASSET">Asset</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Wallet" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {accountType === 'ASSET' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="initialQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isEditMode ? 'Quantity' : 'Initial Quantity'}</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" type="number" step="any" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Grams, Shares" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isEditMode ? 'Current Balance' : 'Initial Balance'}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0" 
                        inputMode="numeric" 
                        {...field} 
                        disabled={isEditMode}
                        value={field.value || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(formatNumber(value));
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          field.onBlur();
                          field.onChange(formatNumber(value));
                        }}
                      />
                    </FormControl>
                    {isEditMode && (
                        <p className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded italic">
                            Balance can only be changed via transactions (Income/Expense/Transfer) to keep your financial reports accurate.
                        </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Goal Settings Section */}
              {(accountType === 'SAVING' || accountType === 'ASSET') && (
                  <div className="border rounded-md p-3 bg-muted/20 space-y-3">
                      <FormField
                        control={form.control}
                        name="enableGoal"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg p-0 space-y-0">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base">Set Goal Target</FormLabel>
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
                      
                      {enableGoal && (
                          <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                               <div className="grid grid-cols-2 gap-4">
                                   <FormField
                                        control={form.control}
                                        name="targetAmount"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Target Amount</FormLabel>
                                            <FormControl>
                                            <Input 
                                                className="h-8"
                                                placeholder="0" 
                                                {...field}
                                                value={field.value || ''}
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
                                            <FormLabel className="text-xs">Target Date</FormLabel>
                                            <FormControl>
                                                <DatePicker
                                                    date={field.value}
                                                    setDate={field.onChange}
                                                    disabled={(date) => date < new Date("1900-01-01")}
                                                    className="h-8 pl-3"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                               </div>

                               {/* Monthly Contribution (Budget) */}
                               <div className="pt-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <FormLabel className="text-primary font-semibold flex items-center gap-1 text-xs">
                                            <CheckCircle2 className="h-3 w-3" /> Monthly Contribution (Budget)
                                        </FormLabel>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="monthlyBudget"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                <Input 
                                                    className="h-8"
                                                    placeholder="e.g. 500,000" 
                                                    {...field}
                                                    onChange={(e) => {
                                                        const val = formatNumber(e.target.value);
                                                        field.onChange(val);
                                                        // Auto-sync to auto-save amount if empty
                                                        if (enableAutoSave && !form.getValues('autoSaveAmount')) {
                                                            form.setValue('autoSaveAmount', val);
                                                        }
                                                    }}
                                                />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
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

                               {accountType === 'SAVING' && (
                                   <FormField
                                        control={form.control}
                                        name="goalType"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Goal Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Select type" />
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
                               )}

                               {/* AUTO-SAVE SECTION */}
                                <AutoSaveFields 
                                    form={form} 
                                    liquidAccounts={liquidAccounts} 
                                    formatNumber={formatNumber} 
                                />
                          </div>
                      )}
                  </div>
              )}
              {/* Hidden submit button */}
              <button type="submit" className="hidden" />
            </form>
          </Form>
        </div>
        <DrawerFooter className="border-t bg-background pt-4 pb-safe px-4">
            <Button 
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(10);
                  form.handleSubmit(onSubmit)();
                }}
                disabled={isProcessing}
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
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default AccountDrawer;