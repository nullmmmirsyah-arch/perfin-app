import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Doc } from '../convex/_generated/dataModel';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format, differenceInMonths, addMonths, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

const CategoryFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  targetAmount: z.string().optional(),
  targetDate: z.date().optional(),
  enablePacing: z.boolean(),
  goalType: z.enum(['investment', 'bill', 'purchase']).optional(),
});

type CategoryFormValues = z.infer<typeof CategoryFormSchema>;

type CategoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Doc<'categories'>;
  defaultType?: 'income' | 'expense' | 'saving';
};

// Internal Component for Date Input
const DateInput = ({ value, onChange }: { value: Date | undefined, onChange: (date: Date | undefined) => void }) => {
    const [inputValue, setInputValue] = useState("");

    // Sync input value when external value (calendar selection) changes
    useEffect(() => {
        if (value) {
            setInputValue(format(value, "dd/MM/yyyy"));
        } else {
            setInputValue("");
        }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, ""); // Keep only digits
        
        // Apply mask: DD/MM/YYYY
        if (val.length > 2 && val.length <= 4) {
            val = `${val.slice(0, 2)}/${val.slice(2)}`;
        } else if (val.length > 4) {
            val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4, 8)}`;
        }
        
        // Limit to 10 chars (DD/MM/YYYY)
        const finalVal = val.slice(0, 10);
        setInputValue(finalVal);

        // Try parsing only when we have enough data (at least MM/YYYY or DD/MM/YYYY)
        const parts = finalVal.split("/");
        if (parts.length >= 2) {
            let d = 1, m = 0, y = 0;
            const lastPart = parts[parts.length - 1];
            
            // Only sync to form if the year part is complete (4 digits)
            if (lastPart.length === 4) {
                const year = parseInt(lastPart);
                if (parts.length === 2) {
                    // MM/YYYY format
                    m = parseInt(parts[0]) - 1;
                    y = year;
                } else if (parts.length === 3) {
                    // DD/MM/YYYY format
                    d = parseInt(parts[0]);
                    m = parseInt(parts[1]) - 1;
                    y = year;
                }
                
                const newDate = new Date(y, m, d);
                if (isValid(newDate) && y > 1900 && y < 2100) {
                    onChange(newDate);
                }
            }
        } else if (finalVal === "") {
            onChange(undefined);
        }
    };

    return (
        <div className="relative flex-1">
            <Input 
                placeholder="DD/MM/YYYY"
                value={inputValue}
                onChange={handleInputChange}
                className="pr-10 font-mono"
                maxLength={10}
            />
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground"
                >
                    <CalendarIcon className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
        </div>
    );
};

const CategoryDrawer = ({ open, onOpenChange, category, defaultType }: CategoryDrawerProps) => {
  const { householdId } = useHousehold();
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);

  const isEditMode = !!category;

  // Local State for Calculator
  const [monthlyContribution, setMonthlyContribution] = useState<string>('');
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);

  // Fetch Existing Budgets to fill the calculator in Edit Mode
  const allBudgets = useQuery(api.budgets.get, open && isEditMode ? { 
      householdId: householdId ?? undefined 
  } : "skip");

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(CategoryFormSchema),
    defaultValues: {
      name: '',
      type: defaultType || '',
      targetAmount: '',
      enablePacing: false,
      goalType: 'purchase',
    }
  });

  const categoryType = useWatch({ control: form.control, name: 'type' });
  const targetAmountStr = useWatch({ control: form.control, name: 'targetAmount' });
  const targetDate = useWatch({ control: form.control, name: 'targetDate' });

  const formatNumber = (value: string | undefined) => {
    if (!value) return '';
    const parsed = parseFloat(value.replace(/,/g, ''));
    if (isNaN(parsed)) return '';
    return new Intl.NumberFormat('en-US').format(parsed);
  };

  // Derived Calculation for Alert Box
  const getCalculationFeedback = () => {
      if (!targetAmountStr) return null;
      
      const amount = parseFloat(targetAmountStr.replace(/,/g, ''));
      const contrib = monthlyContribution ? parseFloat(monthlyContribution.replace(/,/g, '')) : 0;
      
      if (isNaN(amount)) return null;

      // Scenario 1: User set Date & Amount, but Contribution is empty (or 0)
      if (targetDate && contrib <= 0) {
          const selectedMonths = differenceInMonths(targetDate, new Date()) + (targetDate.getDate() >= new Date().getDate() ? 0 : 1);
          const divisor = Math.max(1, selectedMonths);
          const required = amount / divisor;
          
          return {
              status: 'suggestion',
              message: `To reach this by ${format(targetDate, 'MMM yyyy')}, set contribution to:`,
              requiredContrib: required
          };
      }

      // Scenario 2: User set Contribution (Calculated projection)
      if (contrib > 0) {
        const monthsNeeded = Math.ceil(amount / contrib);
        // Safety cap for months to prevent Date overflow (approx 270k years limit)
        // If monthsNeeded is absurdly high, projectedDate will be Invalid Date.
        const projectedDate = addMonths(new Date(), monthsNeeded);
        
        if (!isValid(projectedDate)) {
            return {
                status: 'late',
                message: "Contribution is too low to reach the goal in a reasonable time.",
                // No projectedDate implies we can't show "Change date to..."
            };
        }

        // 2. Compare with Selected Date (if any)
        if (targetDate) {
            const selectedMonths = differenceInMonths(targetDate, new Date()) + (targetDate.getDate() >= new Date().getDate() ? 0 : 1);
            const diff = selectedMonths - monthsNeeded;

            if (diff >= 1) { 
                return {
                    status: 'early',
                    message: "You'll finish this goal early!",
                    projectedDate,
                    requiredContrib: amount / Math.max(1, selectedMonths)
                };
            }
            
            if (diff <= -1) {
                return {
                    status: 'late',
                    message: "You won't make it by the target date.",
                    projectedDate,
                    requiredContrib: amount / Math.max(1, selectedMonths)
                };
            }
        } else {
            // If no date selected yet, just show projection with Action
            return {
                status: 'info',
                message: "Based on this contribution, you'll finish by:",
                projectedDate // Pass the date so UI can render a button
            };
        }
      }
      return null;
  };

  const feedback = getCalculationFeedback();

  const handleApplyDate = (date: Date) => {
      form.setValue('targetDate', date);
  };

  const handleApplyContrib = (amount: number) => {
      setMonthlyContribution(new Intl.NumberFormat('en-US').format(Math.ceil(amount)));
      setIsManuallyEdited(true);
  };

  const onSubmit = (data: CategoryFormValues) => {
    const payload = {
        name: data.name,
        type: data.type,
        targetAmount: data.targetAmount,
        targetDate: data.targetDate ? data.targetDate.toISOString() : undefined,
        enablePacing: data.enablePacing,
        goalType: data.type === 'saving' ? data.goalType : undefined,
        monthlyBudget: monthlyContribution ? monthlyContribution.replace(/,/g, '') : undefined,
    };

    if (isEditMode) {
      updateCategory({
        id: category._id,
        ...payload,
      });
    } else {
      createCategory({
        ...payload,
        householdId: householdId ?? undefined,
      });
    }
    onOpenChange(false);
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
                            <Popover>
                            <div className="flex gap-2">
                                <FormControl>
                                    <DateInput 
                                        value={field.value} 
                                        onChange={field.onChange} 
                                    />
                                </FormControl>
                            </div>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                    date < new Date("1900-01-01")
                                }
                                initialFocus
                                captionLayout="dropdown"
                                fromYear={new Date().getFullYear()}
                                toYear={new Date().getFullYear() + 30}
                                fixedWeeks
                                />
                            </PopoverContent>
                            </Popover>
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
                                setMonthlyContribution(formatNumber(e.target.value));
                                setIsManuallyEdited(true); // User explicitly typing -> Manual Mode
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
                <Button type="submit" onClick={form.handleSubmit(onSubmit)}>Save changes</Button>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
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
