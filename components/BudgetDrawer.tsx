import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Doc, Id } from '../convex/_generated/dataModel';
import { useHousehold } from '@/components/HouseholdProvider';
import CategoryDrawer from '@/components/CategoryDrawer';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Loader2 } from '@/components/ui/icons';

const BudgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.string().min(1, 'Amount is required'),
  allowanceType: z.enum(["budget_period", "weekly"]).optional(),
  weeklyResetDay: z.number().optional(),
});

type BudgetFormValues = z.infer<typeof BudgetFormSchema>;

type BudgetDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: Doc<'categories'>;
  currentAmount?: string;
  categoryType?: 'expense' | 'saving';
  year: number;
  month: number;
};

const formatAmount = (value: string) => {
  const cleanValue = value.replace(/[^\d.]/g, '');
  const parts = cleanValue.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0];
};

const BudgetDrawer = ({ open, onOpenChange, defaultCategory, currentAmount, categoryType = 'expense', year, month }: BudgetDrawerProps) => {
  const { householdId } = useHousehold();
  const upsertBudget = useMutation(api.budgets.upsertBudget);
  const updateAllowanceConfig = useMutation(api.categories.updateAllowanceConfig);
  
  const categories = useQuery(api.categories.get, { type: categoryType, householdId: householdId ?? undefined });
  
  const budgetStatus = useQuery(api.budgets.getBudgetStatus, {
      month,
      year,
      householdId: householdId ?? undefined,
  });

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = React.useState(false);
  const submitLock = React.useRef(false);

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(BudgetFormSchema),
    defaultValues: {
      categoryId: '',
      amount: '',
      allowanceType: 'budget_period',
      weeklyResetDay: 1,
    },
  });

  const categoryId = useWatch({ control: form.control, name: 'categoryId' });
  const amountValue = useWatch({ control: form.control, name: 'amount' });
  const watchedAllowanceType = useWatch({ control: form.control, name: 'allowanceType' });
  const watchedWeeklyResetDay = useWatch({ control: form.control, name: 'weeklyResetDay' });

  // Fetch assistance data when category is selected
  const assistanceData = useQuery(api.budgets.getBudgetAssistance, 
    categoryId ? { categoryId: categoryId as Id<"categories">, targetMonth: month, targetYear: year, householdId: householdId ?? undefined } : "skip"
  );

  useEffect(() => {
    if (open) {
      setIsProcessing(false);
      submitLock.current = false;

      form.reset({
        categoryId: defaultCategory?._id ?? '',
        amount: currentAmount ? formatAmount(currentAmount) : '',
        allowanceType: (defaultCategory?.allowanceType as "budget_period" | "weekly") ?? "budget_period",
        weeklyResetDay: defaultCategory?.weeklyResetDay ?? 1,
      });
    }
  }, [open, defaultCategory, currentAmount, form]);

  const onSubmit = async (data: BudgetFormValues) => {
    if (submitLock.current || isProcessing) return;

    try {
      submitLock.current = true;
      setIsProcessing(true);

      await upsertBudget({
        householdId: householdId ?? undefined,
        categoryId: data.categoryId as Id<'categories'>,
        amount: data.amount.replace(/,/g, ''),
        year,
        month,
      });

      if (data.categoryId) {
        await updateAllowanceConfig({
          categoryId: data.categoryId as Id<'categories'>,
          allowanceType: data.allowanceType ?? "budget_period",
          weeklyResetDay: data.weeklyResetDay,
        });
      }

      toast.success("Budget updated");
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      form.setError('root', { type: 'manual', message: errorMessage });
      setIsProcessing(false);
      submitLock.current = false;
    }
  };

  const applySuggestion = (amount: number | string) => {
      if (!amount) return;
      form.setValue('amount', formatAmount(amount.toString()));
  };

  const currentLimit = currentAmount ? parseFloat(currentAmount) : 0;
  const moveAmount = parseFloat(amountValue?.replace(/,/g, '') || '0');

  // Find the current budget item to get carryover details
  const currentBudgetItem = budgetStatus?.data.find(i => i.category._id === categoryId);
  const carryover = currentBudgetItem?.budget?.carryoverAmount ? parseFloat(currentBudgetItem.budget.carryoverAmount) : 0;
  const newAllocation = parseFloat(amountValue?.replace(/,/g, '') || '0');
  const totalEffective = carryover + newAllocation;

  return (
    <>
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96dvh]">
        <DrawerHeader>
          <DrawerTitle>Set Budget Limit</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pt-0 overflow-y-auto">
          <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!!defaultCategory}>
                      <FormControl>
                          <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {categories?.map((category) => (
                          <SelectItem key={category._id} value={category._id}>
                              {category.name}
                          </SelectItem>
                          ))}
                      </SelectContent>
                      </Select>
                      {categories !== undefined && categories.length === 0 && (
                        <FormDescription>
                          No {categoryType === 'saving' ? 'savings' : 'expense'} categories yet.{' '}
                          <button
                            type="button"
                            className="text-primary underline hover:text-primary/80"
                            onClick={() => setCategoryDrawerOpen(true)}
                          >
                            Create one first
                          </button>
                        </FormDescription>
                      )}
                      <FormMessage />
                  </FormItem>
                  )}
              />

              <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                  <FormItem>
                      <div className="flex justify-between items-center">
                          <FormLabel>Monthly Allocation</FormLabel>
                          {assistanceData && (
                              <span className={cn(
                                  "text-xs",
                                  assistanceData.unassignedCash < 0 ? "text-destructive" : "text-muted-foreground"
                              )}>
                                  Available: {(assistanceData.unassignedCash + (currentAmount ? parseFloat(currentAmount) : 0)).toLocaleString()}
                              </span>
                          )}
                      </div>
                      <FormControl>
                      <Input 
                          placeholder="e.g., 500.00" 
                          inputMode="decimal"
                          className="h-11 text-base"
                          {...field} 
                          onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(formatAmount(value));
                          }}
                      />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Your budget resets at the start of each budget cycle.</p>
                      <FormMessage />
                  </FormItem>
                  )}
              />

              {/* Allowance Config */}
              {categoryId && (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="allowanceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allowance</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value ?? "budget_period"}
                            onValueChange={field.onChange}
                            className="flex flex-col gap-2 items-stretch"
                          >
                            <label className="flex items-center rounded-lg border border-border p-3 cursor-pointer transition-colors hover:bg-muted/50 has-[input:checked]:border-primary has-[input:checked]:bg-primary/5 has-[input:checked]:shadow-sm">
                              <FormControl><RadioGroupItem value="budget_period" className="sr-only" /></FormControl>
                              <span className="font-normal text-sm">
                                Budget Period
                                <span className="text-xs text-muted-foreground block">
                                  Recommended spending is spread across the remaining budget period.
                                </span>
                              </span>
                            </label>
                            <label className="flex items-center rounded-lg border border-border p-3 cursor-pointer transition-colors hover:bg-muted/50 has-[input:checked]:border-primary has-[input:checked]:bg-primary/5 has-[input:checked]:shadow-sm">
                              <FormControl><RadioGroupItem value="weekly" className="sr-only" /></FormControl>
                              <span className="font-normal text-sm">
                                Weekly
                                <span className="text-xs text-muted-foreground block">
                                  Your allowance resets every week.
                                </span>
                              </span>
                            </label>
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {watchedAllowanceType === "weekly" && (
                    <FormField
                      control={form.control}
                      name="weeklyResetDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reset Every</FormLabel>
                          <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString() ?? "1"}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">Sunday</SelectItem>
                              <SelectItem value="1">Monday</SelectItem>
                              <SelectItem value="2">Tuesday</SelectItem>
                              <SelectItem value="3">Wednesday</SelectItem>
                              <SelectItem value="4">Thursday</SelectItem>
                              <SelectItem value="5">Friday</SelectItem>
                              <SelectItem value="6">Saturday</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  )}
                  {watchedAllowanceType === "weekly" && (
                    <p className="text-xs text-muted-foreground -mt-2">
                      Your weekly allowance resets every{' '}
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][watchedWeeklyResetDay ?? 1]}.
                    </p>
                  )}
                </div>
              )}

              {/* Breakdown Card */}
              {categoryId && (
                  <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-tight">Budget Breakdown</p>
                      <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Starting Balance (Rollover)</span>
                              <span className={cn(
                                  "font-medium tabular-nums",
                                  carryover > 0 ? "text-success" : carryover < 0 ? "text-destructive" : ""
                              )}>
                                  {carryover > 0 ? `+${carryover.toLocaleString()}` : carryover.toLocaleString()}
                              </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">New Allocation</span>
                              <span className="font-medium tabular-nums">+{newAllocation.toLocaleString()}</span>
                          </div>
                      </div>
                      <div className="border-t border-border/50 pt-3 flex justify-between items-center">
                          <span className="text-sm font-semibold">Total Available to Spend</span>
                          <span className="text-base font-bold text-primary tabular-nums">{totalEffective.toLocaleString()}</span>
                      </div>
                  </div>
              )}
              
              {assistanceData && (
                  <div className="space-y-2.5">
                      <p className="text-xs text-muted-foreground font-medium">Quick Suggestions</p>
                      <div className={cn(
                          "gap-2",
                          [assistanceData.lastMonthBudget, assistanceData.lastMonthSpent > 0, assistanceData.averageSpent > 0].filter(Boolean).length >= 3
                            ? "grid grid-cols-3"
                            : "flex flex-wrap"
                      )}>
                          {assistanceData.lastMonthBudget && (
                              <Button type="button" variant="outline" size="sm" className="h-auto py-2.5 px-2 text-xs flex flex-col items-center gap-0.5" onClick={() => applySuggestion(assistanceData.lastMonthBudget!)}>
                                  <span className="font-semibold">{parseFloat(assistanceData.lastMonthBudget).toLocaleString()}</span>
                                  <span className="text-[10px] text-muted-foreground">Last Budget</span>
                              </Button>
                          )}
                          {assistanceData.lastMonthSpent > 0 && (
                              <Button type="button" variant="outline" size="sm" className="h-auto py-2.5 px-2 text-xs flex flex-col items-center gap-0.5" onClick={() => applySuggestion(assistanceData.lastMonthSpent)}>
                                  <span className="font-semibold">{assistanceData.lastMonthSpent.toLocaleString()}</span>
                                  <span className="text-[10px] text-muted-foreground">Last Spent</span>
                              </Button>
                          )}
                          {assistanceData.averageSpent > 0 && (
                              <Button type="button" variant="outline" size="sm" className="h-auto py-2.5 px-2 text-xs flex flex-col items-center gap-0.5" onClick={() => applySuggestion(assistanceData.averageSpent)}>
                                  <span className="font-semibold">{assistanceData.averageSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                  <span className="text-[10px] text-muted-foreground">3-Mo Avg</span>
                              </Button>
                          )}
                      </div>
                  </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                  <Button 
                    type="submit" 
                    disabled={isProcessing}
                    className="h-11 text-base font-semibold"
                    onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(10);
                    }}
                  >
                      {isProcessing ? (
                          <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving Budget...
                          </>
                      ) : (
                          'Save Budget'
                      )}
                  </Button>
                  <DrawerClose asChild>
                      <Button variant="ghost" disabled={isProcessing} className="h-11 text-base">Cancel</Button>
                  </DrawerClose>
              </div>
              </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
    <CategoryDrawer
      open={categoryDrawerOpen}
      onOpenChange={setCategoryDrawerOpen}
      defaultType={categoryType}
    />
    </>
  );
};

export default BudgetDrawer;
