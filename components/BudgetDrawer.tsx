import React, { useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';

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
  year: number;
  month: number;
};

const formatAmount = (value: string) => {
  const cleanValue = value.replace(/[^\d.]/g, '');
  const parts = cleanValue.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0];
};

const BudgetDrawer = ({ open, onOpenChange, defaultCategory, currentAmount, year, month }: BudgetDrawerProps) => {
  const { householdId } = useHousehold();
  const upsertBudget = useMutation(api.budgets.upsertBudget);
  const updateAllowanceConfig = useMutation(api.categories.updateAllowanceConfig);
  
  const categories = useQuery(api.categories.get, { type: 'expense', householdId: householdId ?? undefined });
  
  const budgetStatus = useQuery(api.budgets.getBudgetStatus, {
      month,
      year,
      householdId: householdId ?? undefined,
  });

  const [isProcessing, setIsProcessing] = React.useState(false);
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
                          {...field} 
                          onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(formatAmount(value));
                          }}
                      />
                      </FormControl>
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
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl><RadioGroupItem value="budget_period" /></FormControl>
                              <FormLabel className="font-normal">
                                Budget Period
                                <span className="text-xs text-muted-foreground block">
                                  Recommended spending is spread across the remaining budget period.
                                </span>
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl><RadioGroupItem value="weekly" /></FormControl>
                              <FormLabel className="font-normal">
                                Weekly
                                <span className="text-xs text-muted-foreground block">
                                  Your allowance resets every week.
                                </span>
                              </FormLabel>
                            </FormItem>
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
                </div>
              )}

              {/* Breakdown Card */}
              {categoryId && (
                  <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border flex flex-col gap-2">
                      <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Starting Balance (Rollover)</span>
                          <span className={cn(
                              "font-medium",
                              carryover > 0 ? "text-success" : carryover < 0 ? "text-destructive" : ""
                          )}>
                              {carryover > 0 ? `+${carryover.toLocaleString()}` : carryover.toLocaleString()}
                          </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">New Allocation</span>
                          <span className="font-medium">+{newAllocation.toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-2 mt-1 flex justify-between items-center">
                          <span className="font-semibold text-sm">Total Available to Spend</span>
                          <span className="font-bold text-primary">{totalEffective.toLocaleString()}</span>
                      </div>
                  </div>
              )}
              
              {assistanceData && (
                  <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Quick Suggestions:</p>
                      <div className="flex flex-wrap gap-2">
                          {assistanceData.lastMonthBudget && (
                              <Button type="button" variant="outline" size="sm" className="h-auto py-1 px-2 text-xs flex flex-col items-start gap-0.5" onClick={() => applySuggestion(assistanceData.lastMonthBudget!)}>
                                  <span className="font-semibold">{parseFloat(assistanceData.lastMonthBudget).toLocaleString()}</span>
                                  <span className="text-[10px] opacity-70">Last Budget</span>
                              </Button>
                          )}
                          {assistanceData.lastMonthSpent > 0 && (
                              <Button type="button" variant="outline" size="sm" className="h-auto py-1 px-2 text-xs flex flex-col items-start gap-0.5" onClick={() => applySuggestion(assistanceData.lastMonthSpent)}>
                                  <span className="font-semibold">{assistanceData.lastMonthSpent.toLocaleString()}</span>
                                  <span className="text-[10px] opacity-70">Last Spent</span>
                              </Button>
                          )}
                          {assistanceData.averageSpent > 0 && (
                              <Button type="button" variant="outline" size="sm" className="h-auto py-1 px-2 text-xs flex flex-col items-start gap-0.5" onClick={() => applySuggestion(assistanceData.averageSpent)}>
                                  <span className="font-semibold">{assistanceData.averageSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                  <span className="text-[10px] opacity-70">3-Mo Avg</span>
                              </Button>
                          )}
                      </div>
                  </div>
              )}

              <div className="flex flex-col gap-2">
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
                          Saving Budget...
                        </>
                      ) : (
                        'Save Budget'
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

export default BudgetDrawer;
