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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BudgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.string().min(1, 'Amount is required'),
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

const BudgetDrawer = ({ open, onOpenChange, defaultCategory, currentAmount, year, month }: BudgetDrawerProps) => {
  const { householdId } = useHousehold();
  const upsertBudget = useMutation(api.budgets.upsertBudget);
  const categories = useQuery(api.categories.get, { type: 'expense', householdId: householdId ?? undefined });
  
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(BudgetFormSchema),
    defaultValues: {
      categoryId: '',
      amount: '',
    },
  });

  const categoryId = useWatch({ control: form.control, name: 'categoryId' });

  // Fetch assistance data when category is selected
  const assistanceData = useQuery(api.budgets.getBudgetAssistance, 
    categoryId ? { categoryId: categoryId as Id<"categories">, targetMonth: month, targetYear: year, householdId: householdId ?? undefined } : "skip"
  );

  useEffect(() => {
    if (open) {
      form.reset({
        categoryId: defaultCategory?._id ?? '',
        amount: currentAmount ?? '',
      });
    }
  }, [open, defaultCategory, currentAmount, form]);

  const onSubmit = async (data: BudgetFormValues) => {
    try {
      await upsertBudget({
        householdId: householdId ?? undefined,
        categoryId: data.categoryId as Id<'categories'>,
        amount: data.amount,
        year,
        month,
      });
      toast.success("Budget saved successfully");
      onOpenChange(false);
    } catch (error) {
      // 1. Convert error to a searchable string representation
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = JSON.stringify(error); // Backup check for nested objects

      // 2. Check for the specific insufficient funds keyword
      if (errorMessage.includes("Insufficient funds") || errorString.includes("Insufficient funds")) {
          // 3. Extract the clean message
          // We look for the sentence starting with "Insufficient funds"
          // The error often comes as "Uncaught Error: Insufficient funds..."
          const match = (errorMessage + errorString).match(/Insufficient funds[^.]+\./);
          const cleanMessage = match ? match[0] : "Insufficient funds to set this budget.";

          form.setError('amount', {
              type: 'manual',
              message: cleanMessage
          });
      } else {
          // Fallback for other errors
          form.setError('root', {
              type: 'manual',
              message: "An unexpected error occurred. Please try again."
          });
      }
    }
  };

  const applySuggestion = (amount: number | string) => {
      if (!amount) return;
      form.setValue('amount', amount.toString());
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Set Budget for {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4">
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
              
              <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center">
                            <FormLabel>Monthly Limit</FormLabel>
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
                          <Input placeholder="e.g., 500.00" {...field} type="number" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {assistanceData && (
                      <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">Quick Suggestions:</p>
                          <div className="flex flex-wrap gap-2">
                              {assistanceData.lastMonthBudget && (
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-auto py-1 px-2 text-xs flex flex-col items-start gap-0.5"
                                    onClick={() => applySuggestion(assistanceData.lastMonthBudget!)}
                                  >
                                      <span className="font-semibold">{parseFloat(assistanceData.lastMonthBudget).toLocaleString()}</span>
                                      <span className="text-[10px] opacity-70">Last Budget</span>
                                  </Button>
                              )}
                              
                              {assistanceData.lastMonthSpent > 0 && (
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-auto py-1 px-2 text-xs flex flex-col items-start gap-0.5"
                                    onClick={() => applySuggestion(assistanceData.lastMonthSpent)}
                                  >
                                      <span className="font-semibold">{assistanceData.lastMonthSpent.toLocaleString()}</span>
                                      <span className="text-[10px] opacity-70">Last Spent</span>
                                  </Button>
                              )}

                              {assistanceData.averageSpent > 0 && (
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-auto py-1 px-2 text-xs flex flex-col items-start gap-0.5"
                                    onClick={() => applySuggestion(assistanceData.averageSpent)}
                                  >
                                      <span className="font-semibold">{assistanceData.averageSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                      <span className="text-[10px] opacity-70">3-Mo Avg</span>
                                  </Button>
                              )}
                              
                              {(!assistanceData.lastMonthBudget && assistanceData.lastMonthSpent === 0 && assistanceData.averageSpent === 0) && (
                                  <span className="text-xs text-muted-foreground italic">No historical data available yet.</span>
                              )}
                          </div>
                      </div>
                  )}
              </div>

              <DrawerFooter className="px-0">
                <Button type="submit">Save Budget</Button>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default BudgetDrawer;