import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray, useWatch, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, AlertCircle } from 'lucide-react';
import { cn, formatCurrency, parseAmount } from '@/lib/utils';
import { Doc, Id } from '../convex/_generated/dataModel';
import { toast } from 'sonner';
import { useHousehold } from '@/components/HouseholdProvider';
import { SplitEditorDrawer } from './SplitEditorDrawer';
import { useIsMobile } from '@/hooks/use-mobile';

type TransactionWithDetails = Doc<'transactions'> & {
  fromAccountName?: string;
  toAccountName?: string;
  categoryName?: string;
  label?: Doc<'labels'> | null;
  splits?: Array<{
    categoryId: string;
    amount: string;
    description?: string;
    labelId?: string;
    categoryName?: string;
  }>;
};

// Adapted for use with api.budgets.getBudgetStatus
type CategoryOption = {
    _id: Id<'categories'>;
    name: string;
    type: string;
    budgetLimit?: number;
    remaining?: number;
};

const createTransactionFormSchema = (accounts: Doc<'accounts'>[]) => z.object({
  type: z.enum(['expense', 'income', 'transfer']),
  amount: z.string().refine(val => !isNaN(parseFloat(val.replace(/,/g, ''))), {
    message: 'Amount must be a number',
  }),
  date: z.date(),
  description: z.string().optional(),
  accountId: z.string(),
  categoryId: z.string().optional(),
  toAccountId: z.string().optional(),
  isSplit: z.boolean().optional(),
  splits: z.array(z.object({
    categoryId: z.string(),
    amount: z.string().refine(val => !isNaN(parseFloat(val.replace(/,/g, ''))), {
      message: 'Amount must be a number',
    }),
    description: z.string().optional(),
    labelId: z.string().optional(),
  })).optional(),
  labelId: z.string().optional(),
  assetDetails: z.object({
    quantity: z.string().optional(),
    unitPrice: z.number().optional(),
  }).optional(),
}).superRefine((data, ctx) => {
  if (data.type === 'transfer') {
    if (!data.toAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toAccountId'],
        message: 'To account is required for transfers',
      });
    }
    if (data.accountId === data.toAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toAccountId'],
        message: 'From and To accounts cannot be the same',
      });
    }

    // Asset / Saving Transaction Logic
    const sourceAccount = accounts.find(a => a._id === data.accountId);
    const destAccount = accounts.find(a => a._id === data.toAccountId);
    
    // Helper to determine liquidity
    const isLiquid = (type?: string) => !type || type === 'CASH';
    const sourceIsSpecial = !isLiquid(sourceAccount?.type);
    const destIsSpecial = !isLiquid(destAccount?.type);

    // Require category if ANY side involves a Special Account (Saving/Asset)
    const requiresCategory = sourceIsSpecial || destIsSpecial;

    if (requiresCategory) {
      if (!data.categoryId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['categoryId'],
            message: 'Category is required to track this Saving/Asset movement',
        });
      }
    }

    if (sourceAccount?.type === 'ASSET' || destAccount?.type === 'ASSET') {
        if (!data.assetDetails?.quantity || parseFloat(data.assetDetails.quantity) <= 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['assetDetails', 'quantity'],
            message: 'Quantity/Weight is required for asset transfers',
        });
        }
    }

  } else {
    if (!data.isSplit && !data.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryId'],
        message: 'Category is required',
      });
    }
    if (data.isSplit) {
      if (!data.splits || data.splits.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['splits'],
          message: 'Splits are required for split transactions',
        });
      } else {
        const totalSplitAmount = data.splits.reduce((acc, split) => acc + parseFloat(split.amount.replace(/,/g, '')), 0);
        if (totalSplitAmount !== parseFloat(data.amount.replace(/,/g, ''))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['splits'],
            message: 'Total split amount must equal the total amount',
          });
        }
      }
    }
  }
});

type TransactionFormValues = z.infer<ReturnType<typeof createTransactionFormSchema>>;

type TransactionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionWithDetails;
};

const formatNumber = (value: string | undefined) => {
  if (!value) return '';
  const parsed = parseFloat(value.replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US').format(parsed);
};

// --- Main Wrapper Component ---
const TransactionDrawer = (props: TransactionDrawerProps) => {
  const isMobile = useIsMobile();
  const { open, onOpenChange, transaction } = props;
  const isEditMode = !!transaction;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[96dvh] flex flex-col">
          <DrawerHeader>
            <DrawerTitle>{isEditMode ? 'Edit transaction' : 'Create a new transaction'}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4">
             <TransactionForm {...props} isMobile={true} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
           <DialogTitle>{isEditMode ? 'Edit transaction' : 'Create a new transaction'}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 pt-2">
            <TransactionForm {...props} isMobile={false} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- Form Logic Component ---
const TransactionForm = ({ open, onOpenChange, transaction, isMobile }: TransactionDrawerProps & { isMobile: boolean }) => {
  const { householdId } = useHousehold();
  const createTransaction = useMutation(api.transactions.create);
  const updateTransaction = useMutation(api.transactions.update);
  
  const [splitDrawerOpen, setSplitDrawerOpen] = useState(false);

  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined });
  const isEditMode = !!transaction;

  const formSchema = useMemo(() => createTransactionFormSchema(accounts || []), [accounts]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'expense',
      amount: '',
      date: new Date(),
      description: '',
      accountId: '',
      isSplit: false,
      splits: [{ categoryId: '', amount: '', description: '', labelId: '' }],
      labelId: undefined,
      assetDetails: { quantity: '', unitPrice: undefined },
    }
  });

  const transactionType = useWatch({ control: form.control, name: 'type' });
  const transactionDate = useWatch({ control: form.control, name: 'date' });
  
  // Dynamic Month/Year for Budget Status (Consistent with Dashboard)
  const selectedMonth = transactionDate ? transactionDate.getMonth() : new Date().getMonth();
  const selectedYear = transactionDate ? transactionDate.getFullYear() : new Date().getFullYear();

  // Use EXISTING budget status query
  const budgetStatus = useQuery(api.budgets.getBudgetStatus, { 
      householdId: householdId ?? undefined, 
      month: selectedMonth, 
      year: selectedYear 
  });

  // Also fetch simple categories list for Income (which might not be in budgetStatus fully if filtered)
  // Optimization: budgetStatus only returns expense/saving. We need income categories too.
  const allCategories = useQuery(api.categories.get, {
      householdId: householdId ?? undefined
  });

  // Merge Data
  const categories: CategoryOption[] = useMemo(() => {
      const typeFilter = transactionType === 'transfer' ? 'saving' : transactionType;
      
      // If Expense/Saving, prefer budgetStatus data
      if (typeFilter === 'expense' || typeFilter === 'saving') {
          if (!budgetStatus?.data) return [];
          
          return budgetStatus.data
            .filter(item => item.category.type === typeFilter)
            .map(item => {
                const limit = item.budget ? parseFloat(item.budget.amount.replace(/,/g, '') || '0') : 0;
                // remaining can be negative
                const remaining = limit - (item.spent || 0);
                
                return {
                    _id: item.category._id,
                    name: item.category.name,
                    type: item.category.type,
                    budgetLimit: limit,
                    remaining: remaining
                };
            });
      }
      
      // Fallback for Income (or if budgetStatus fails)
      if (!allCategories) return [];
      return allCategories
        .filter(c => c.type === typeFilter)
        .map(c => ({
            _id: c._id,
            name: c.name,
            type: c.type
        }));

  }, [transactionType, budgetStatus, allCategories]);

  const labels = useQuery(api.labels.get, { householdId: householdId ?? undefined });

  // Reset form when opening/closing or changing transaction
  useEffect(() => {
    if (open) {
      if (isEditMode && transaction) {
        form.reset({
          type: transaction.type as 'expense' | 'income' | 'transfer',
          amount: transaction.amount,
          date: new Date(transaction.date),
          description: transaction.description || '',
          accountId: transaction.accountId,
          categoryId: transaction.categoryId || undefined,
          toAccountId: transaction.toAccountId || undefined,
          isSplit: transaction.isSplit || false,
          splits: transaction.splits?.map(s => ({
            categoryId: s.categoryId,
            amount: s.amount,
            description: s.description || '',
            labelId: s.labelId || undefined,
          })) || [{ categoryId: '', amount: '', description: '', labelId: '' }],
          labelId: transaction.labelId || undefined,
          assetDetails: transaction.assetDetails ? {
            quantity: transaction.assetDetails.quantity,
            unitPrice: transaction.assetDetails.unitPrice,
          } : undefined,
        });
      } else {
        form.reset({
          type: 'expense',
          amount: '',
          date: new Date(),
          description: '',
          accountId: '',
          isSplit: false,
          splits: [{ categoryId: '', amount: '', description: '', labelId: '' }],
          labelId: undefined,
          assetDetails: { quantity: '', unitPrice: undefined },
        });
      }
    }
  }, [open, isEditMode, transaction, form]);

  const { fields, append, replace } = useFieldArray({
    control: form.control,
    name: 'splits',
  });

  const cashAccounts = useMemo(() => 
    accounts?.filter(a => !a.type || a.type === 'CASH') || [], 
  [accounts]);

  const onSubmit = async (data: TransactionFormValues) => {
    const assetDetails = data.assetDetails?.quantity 
      ? { quantity: data.assetDetails.quantity, unitPrice: data.assetDetails.unitPrice }
      : undefined;

    try {
        if (isEditMode && transaction) {
            await updateTransaction({
              id: transaction._id,
              type: data.type,
              amount: data.amount,
              date: data.date.toISOString(),
              description: data.description,
              accountId: data.accountId as Id<'accounts'>,
              categoryId: data.categoryId as Id<'categories'> | undefined,
              toAccountId: data.toAccountId as Id<'accounts'> | undefined,
              isSplit: data.isSplit,
              splits: data.splits?.map(s => ({
                categoryId: s.categoryId as Id<'categories'>,
                amount: s.amount,
                description: s.description,
                labelId: s.labelId ? s.labelId as Id<'labels'> : undefined,
              })),
              labelId: data.labelId ? data.labelId as Id<'labels'> : undefined,
              assetDetails,
            });
            toast.success("Transaction updated");
          } else {
            await createTransaction({
              householdId: householdId ?? undefined,
              type: data.type,
              amount: data.amount,
              date: data.date.toISOString(),
              description: data.description,
              accountId: data.accountId as Id<'accounts'>,
              categoryId: data.categoryId as Id<'categories'> | undefined,
              toAccountId: data.toAccountId as Id<'accounts'> | undefined,
              isSplit: data.isSplit,
              splits: data.splits?.map(s => ({
                categoryId: s.categoryId as Id<'categories'>,
                amount: s.amount,
                description: s.description,
                labelId: s.labelId ? s.labelId as Id<'labels'> : undefined,
              })),
              labelId: data.labelId ? data.labelId as Id<'labels'> : undefined,
              assetDetails,
            });
            toast.success("Transaction created");
          }
          onOpenChange(false);
    } catch (error) {
        console.error(error);
        toast.error("Failed to save transaction");
    }
  };

  const isSplit = useWatch({ control: form.control, name: 'isSplit' });
  const splits = useWatch({ control: form.control, name: 'splits' });

  useEffect(() => {
    if (!isSplit) {
      replace([]);
    } else if (fields.length === 0) {
      append({ categoryId: '', amount: '', description: '', labelId: '' });
    }
  }, [isSplit, replace, append, fields.length]);

  const allocated = splits?.reduce((acc, split) => acc + parseFloat(split.amount?.replace(/,/g, '') || '0'), 0) || 0;
  const splitCount = splits?.length || 0;

  const handleSplitToggle = (checked: boolean) => {
      form.setValue('isSplit', checked);
      if (checked) {
          setSplitDrawerOpen(true);
          if (!splits || splits.length === 0) {
             form.setValue('splits', [{ categoryId: '', amount: '', description: '', labelId: '' }]);
          }
      }
  };
  
  const handleTabChange = (value: string) => {
    form.setValue('type', value as 'expense' | 'income' | 'transfer');
  };

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 flex flex-col">
          <Tabs value={transactionType} className="w-full" onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger 
                value="expense"
                className={cn(transactionType === 'expense' && "bg-destructive! text-destructive-foreground!")}
              >
                Expense
              </TabsTrigger>
              <TabsTrigger 
                value="income"
                className={cn(transactionType === 'income' && "bg-success! text-success-foreground!")}
              >
                Income
              </TabsTrigger>
              <TabsTrigger 
                value="transfer"
                className={cn(transactionType === 'transfer' && "bg-primary! text-primary-foreground!")}
              >
                Transfer
              </TabsTrigger>
            </TabsList>

            <div className="pt-4">
                <TabsContent value="expense" className="space-y-4 mt-0">
                  <TransactionFormFields 
                    form={form} 
                    categories={categories || []} 
                    accounts={cashAccounts} 
                    labels={labels || []} 
                    onSplitToggle={handleSplitToggle}
                    splitSummary={isSplit ? { count: splitCount, total: allocated } : undefined}
                    onEditSplit={() => setSplitDrawerOpen(true)}
                    isMobile={isMobile}
                  />
                </TabsContent>
                <TabsContent value="income" className="space-y-4 mt-0">
                  <TransactionFormFields 
                    form={form} 
                    categories={categories || []} 
                    accounts={cashAccounts} 
                    labels={labels || []} 
                    onSplitToggle={handleSplitToggle}
                    splitSummary={isSplit ? { count: splitCount, total: allocated } : undefined}
                    onEditSplit={() => setSplitDrawerOpen(true)}
                    isMobile={isMobile}
                  />
                </TabsContent>
                <TabsContent value="transfer" className="space-y-4 mt-0">
                  <TransferFormFields 
                    form={form} 
                    accounts={accounts || []} 
                    labels={labels || []} 
                    categories={categories || []} 
                    isMobile={isMobile} 
                  />
                </TabsContent>
            </div>
          </Tabs>

           {/* Footer Rendering */}
           {isMobile ? (
              <DrawerFooter className="border-t bg-background -mx-4 pt-4 mt-auto">
                <Button type="submit">Save changes</Button>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
           ) : (
              <div className="flex justify-end gap-2 border-t -mx-6 pt-4 px-6 mt-6">
                 <DialogClose asChild>
                    <Button variant="outline" type="button">Cancel</Button>
                 </DialogClose>
                 <Button type="submit">Save changes</Button>
              </div>
           )}
        </form>

      <SplitEditorDrawer 
        open={splitDrawerOpen} 
        onOpenChange={setSplitDrawerOpen}
        form={form}
        categories={categories || []}
        labels={labels || []}
      />
    </Form>
  );
}

const TransactionFormFields = ({ 
    form, categories, accounts, labels, onSplitToggle, splitSummary, onEditSplit, isMobile 
}: { 
    form: UseFormReturn<TransactionFormValues>, 
    categories: CategoryOption[], 
    accounts: Doc<'accounts'>[], 
    labels: Doc<'labels'>[],
    onSplitToggle?: (checked: boolean) => void,
    splitSummary?: { count: number, total: number },
    onEditSplit?: () => void,
    isMobile?: boolean
}) => {
  const isSplit = useWatch({ control: form.control, name: 'isSplit' });
  const type = useWatch({ control: form.control, name: 'type' });
  const amount = useWatch({ control: form.control, name: 'amount' });
  const accountId = useWatch({ control: form.control, name: 'accountId' });
  
  const selectedAccount = accounts.find(a => a._id === accountId);
  const amountValue = parseAmount(amount);
  const balanceValue = parseAmount(selectedAccount?.balance);
  const isOverspent = (type === 'expense' || type === 'transfer') && selectedAccount && amountValue > balanceValue;

  return (
    <>
      <FormField
        control={form.control}
        name="date"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Date</FormLabel>
            <FormControl>
              <DatePicker 
                date={field.value}
                setDate={field.onChange}
                disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem className={cn(isMobile && "mb-8")}>
            <FormLabel className={cn(isMobile && "text-center block text-muted-foreground uppercase text-[10px] font-bold tracking-widest")}>
              Amount
            </FormLabel>
            <FormControl>
              {isMobile ? (
                  <div className="relative group">
                    <Input
                        placeholder="0"
                        inputMode="numeric"
                        className={cn(
                            "h-24 text-5xl font-bold text-center border-none shadow-none focus-visible:ring-0 bg-transparent transition-colors",
                            isOverspent ? "text-destructive animate-pulse" : "text-foreground"
                        )}
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(formatNumber(value));
                        }}
                    />
                    <div className={cn(
                        "h-px w-full mt-1 bg-linear-to-r from-transparent via-border to-transparent",
                        isOverspent && "via-destructive"
                    )} />
                    {isOverspent && (
                        <div className="flex items-center justify-center gap-1 mt-2 text-destructive text-[10px] font-medium uppercase tracking-tighter">
                            <AlertCircle className="h-3 w-3" /> Insufficient Balance
                        </div>
                    )}
                  </div>
              ) : (
                <Input
                    placeholder="0"
                    inputMode="numeric"
                    {...field}
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
              )}
            </FormControl>
            <FormMessage className={cn(isMobile && "text-center")} />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="accountId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Account</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account._id} value={account._id}>
                     <div className="flex w-full items-center justify-between gap-4">
                        <span className="font-medium truncate">{account.name}</span>
                        <span className="text-muted-foreground text-xs font-normal shrink-0">
                            {formatCurrency(account.balance)}
                        </span>
                     </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormItem className="space-y-2">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            <FormLabel className="mb-0">Category</FormLabel>
            <FormField
                control={form.control}
                name="isSplit"
                render={({ field }) => (
                <div 
                    className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-md border cursor-pointer transition-colors select-none",
                        field.value ? "bg-primary/10 border-primary text-primary" : "bg-muted/20 hover:bg-muted/50 text-muted-foreground"
                    )}
                    onClick={() => onSplitToggle?.(!field.value)}
                >
                    <input 
                    type="checkbox" 
                    className="h-3 w-3 pointer-events-none accent-primary" 
                    checked={field.value} 
                    readOnly
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Split</span>
                </div>
                )}
            />
            </div>
            {isSplit && (
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onEditSplit}>
                    Edit Splits
                </Button>
            )}
        </div>

        {!isSplit ? (
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map(category => {
                        const showBudget = category.type === 'expense' && (category.budgetLimit || 0) > 0;
                        const remaining = category.remaining || 0;
                        const isLow = remaining < 0;

                        return (
                          <SelectItem key={category._id} value={category._id}>
                             <div className="flex w-full items-center justify-between gap-4">
                                <span className="font-medium truncate">{category.name}</span>
                                {showBudget && (
                                    <span className={cn(
                                        "text-xs font-normal shrink-0",
                                        isLow ? "text-destructive" : "text-muted-foreground"
                                    )}>
                                        Avail: {formatCurrency(remaining)}
                                    </span>
                                )}
                             </div>
                          </SelectItem>
                        );
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </>
            )}
          />
        ) : (
            <div 
                className="p-3 border rounded-md bg-muted/30 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={onEditSplit}
            >
                <div className="space-y-1">
                    <p className="text-sm font-medium">{splitSummary?.count || 0} Items</p>
                    <p className="text-xs text-muted-foreground">Total: {new Intl.NumberFormat().format(splitSummary?.total || 0)}</p>
                </div>
                <div className="bg-background border rounded-full p-1">
                    <PlusCircle className="h-4 w-4 text-muted-foreground" />
                </div>
            </div>
        )}
      </FormItem>
      {!isSplit && (
        <>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  {isMobile ? (
                      <Textarea 
                        placeholder="Add a description..." 
                        className="resize-none min-h-[80px]" 
                        {...field} 
                      />
                  ) : (
                      <Input placeholder="Add a description" {...field} />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="labelId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Label</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a label (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {labels?.map(label => (
                      <SelectItem key={label._id} value={label._id}>{label.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </>
  );
};

const TransferFormFields = ({ form, accounts, labels, categories, isMobile }: { form: UseFormReturn<TransactionFormValues>, accounts: Doc<'accounts'>[], labels: Doc<'labels'>[], categories: CategoryOption[], isMobile?: boolean }) => {
  const fromAccountId = useWatch({ control: form.control, name: 'accountId' });
  const toAccountId = useWatch({ control: form.control, name: 'toAccountId' });
  const amount = useWatch({ control: form.control, name: 'amount' });
  const quantity = useWatch({ control: form.control, name: 'assetDetails.quantity' });

  // Prefill category if destination account has a linked category
  useEffect(() => {
    if (toAccountId) {
      const destAccount = accounts.find(a => a._id === toAccountId);
      if (destAccount?.linkedCategoryId) {
        form.setValue('categoryId', destAccount.linkedCategoryId);
      }
    }
  }, [toAccountId, accounts, form]);

  const fromAccount = accounts.find(a => a._id === fromAccountId);
  const toAccount = accounts.find(a => a._id === toAccountId);
  
  // Helper to determine liquidity
  const isLiquid = (type?: string) => !type || type === 'CASH';
  const sourceIsSpecial = !isLiquid(fromAccount?.type);
  const destIsSpecial = !isLiquid(toAccount?.type);

  // Show category selector if ANY side involves a Special Account
  const showCategory = sourceIsSpecial || destIsSpecial;
  
  const isAssetTransaction = fromAccount?.type === 'ASSET' || toAccount?.type === 'ASSET';

  // Auto-linked category logic
  const linkedCategory = useMemo(() => {
      const linkedId = toAccount?.linkedCategoryId || fromAccount?.linkedCategoryId;
      return categories.find(c => c._id === linkedId);
  }, [toAccount, fromAccount, categories]);

  let amountLabel = 'Amount';
  if (fromAccount?.type !== 'ASSET' && toAccount?.type === 'ASSET') {
    amountLabel = 'Total Cost'; // Buy
  } else if (fromAccount?.type === 'ASSET' && toAccount?.type !== 'ASSET') {
    amountLabel = 'Total Sale Value'; // Sell
  }

  const amountValue = parseAmount(amount);
  const fromBalanceValue = parseAmount(fromAccount?.balance);
  const isOverspent = fromAccount && amountValue > fromBalanceValue;

  const parsedAmount = parseFloat(amount?.replace(/,/g, '') || '0');
  const parsedQuantity = parseFloat(quantity || '0');
  const impliedPrice = parsedQuantity > 0 ? parsedAmount / parsedQuantity : 0;

  return (
    <>
      <FormField
        control={form.control}
        name="date"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Date</FormLabel>
            <FormControl>
              <DatePicker 
                date={field.value}
                setDate={field.onChange}
                disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="accountId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>From Account</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account._id} value={account._id}>
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="font-medium truncate">{account.name}</span>
                        <span className="text-muted-foreground text-xs font-normal shrink-0">
                            {formatCurrency(account.balance)}
                        </span>
                     </div>
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
        name="toAccountId"
        render={({ field }) => (
          <FormItem>
            <div className="flex justify-between items-center">
              <FormLabel>To Account</FormLabel>
              {toAccount && (
                <span className="text-xs text-muted-foreground font-medium">
                   Balance: {formatCurrency(toAccount.balance)}
                </span>
              )}
            </div>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account._id} value={account._id}>
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="font-medium truncate">{account.name}</span>
                        <span className="text-muted-foreground text-xs font-normal shrink-0">
                            {formatCurrency(account.balance)}
                        </span>
                     </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      
      {showCategory && (
        linkedCategory ? (
            <div className="bg-muted/30 p-3 rounded-md border border-dashed flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Goal Detected</span>
                <span className="text-sm font-medium flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    {linkedCategory.name}
                </span>
            </div>
        ) : (
            <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Category (Saving/Goal)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select a saving category" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {categories.map(category => (
                        <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
        )
      )}

      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem className={cn(isMobile && "mb-8")}>
            <FormLabel className={cn(isMobile && "text-center block text-muted-foreground uppercase text-[10px] font-bold tracking-widest")}>
              {amountLabel}
            </FormLabel>
            <FormControl>
              {isMobile ? (
                  <div className="relative group">
                    <Input
                        placeholder="0"
                        inputMode="numeric"
                        className="h-24 text-5xl font-bold text-center border-none shadow-none focus-visible:ring-0 bg-transparent"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(formatNumber(value));
                        }}
                    />
                    <div className="h-px w-full bg-linear-to-r from-transparent via-border to-transparent mt-1" />
                  </div>
              ) : (
                <Input
                    placeholder="0"
                    inputMode="numeric"
                    {...field}
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
              )}
            </FormControl>
            <FormMessage className={cn(isMobile && "text-center")} />
          </FormItem>
        )}
      />
      
      {isAssetTransaction && (
        <FormField
          control={form.control}
          name="assetDetails.quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity / Weight</FormLabel>
              <FormControl>
                <Input
                  placeholder="0.00"
                  type="number"
                  step="any"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              {parsedAmount > 0 && parsedQuantity > 0 && (
                <div className="text-sm text-muted-foreground mt-1">
                  Implied Price: <span className="font-medium text-foreground">{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(impliedPrice)} / unit</span>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Input placeholder="Add a description" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="labelId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Label</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a label (optional)" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {labels?.map(label => (
                  <SelectItem key={label._id} value={label._id}>{label.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};

export default TransactionDrawer;