import React, { useEffect, useMemo } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Doc, Id } from '../convex/_generated/dataModel';
import { toast } from 'sonner';
import { useHousehold } from '@/components/HouseholdProvider';
import { SplitEditorDrawer } from './SplitEditorDrawer';
import { useState } from 'react';

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
    // This ensures we track both Inflow (Saving) and Outflow (Withdrawal) from goals.
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

const TransactionDrawer = ({ open, onOpenChange, transaction }: TransactionDrawerProps) => {
  const { householdId } = useHousehold();
  const createTransaction = useMutation(api.transactions.create);
  const updateTransaction = useMutation(api.transactions.update);
  
  const [splitDrawerOpen, setSplitDrawerOpen] = useState(false);

  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined });

  const isEditMode = !!transaction;

  const formSchema = useMemo(() => createTransactionFormSchema(accounts || []), [accounts]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(formSchema),
  });

  const transactionType = useWatch({
    control: form.control,
    name: 'type',
  });
  const categories = useQuery(
    api.categories.get,
    transactionType === 'transfer' 
        ? { type: 'saving', householdId: householdId ?? undefined } 
        : { type: transactionType, householdId: householdId ?? undefined }
  );
  const labels = useQuery(api.labels.get, { householdId: householdId ?? undefined });

  useEffect(() => {
    if (open && isEditMode && transaction) {
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
    } else if (open && !isEditMode) {
      form.reset({
        type: 'expense',
        amount: '',
        date: new Date(),
        description: '',
        accountId: '',
        isSplit: false,
        splits: [{ categoryId: '', amount: '', description: '', labelId: '' }],
        labelId: undefined,
        assetDetails: {
          quantity: '',
          unitPrice: undefined,
        },
      });
    }
  }, [open, isEditMode, transaction, form]);

  const { fields, append, replace } = useFieldArray({
    control: form.control,
    name: 'splits',
  });

  // Filter accounts for Expense/Income (Cash only)
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

  const isSplit = useWatch({
    control: form.control,
    name: 'isSplit',
  });
  const splits = useWatch({
    control: form.control,
    name: 'splits',
  });

  useEffect(() => {
    if (!isSplit) {
      replace([]);
    } else if (fields.length === 0) {
      append({ categoryId: '', amount: '', description: '', labelId: '' });
    }
  }, [isSplit, replace, append, fields.length]);


  const allocated = splits?.reduce((acc, split) => acc + parseFloat(split.amount?.replace(/,/g, '') || '0'), 0) || 0;

  const handleTabChange = (value: string) => {
    form.setValue('type', value as 'expense' | 'income' | 'transfer');
  };

  const splitCount = splits?.length || 0;

  const handleSplitToggle = (checked: boolean) => {
      form.setValue('isSplit', checked);
      if (checked) {
          setSplitDrawerOpen(true);
          // Auto-add first item if empty
          if (!splits || splits.length === 0) {
             form.setValue('splits', [{ categoryId: '', amount: '', description: '', labelId: '' }]);
          }
      }
  };

  return (
    <Form {...form}>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-dvh flex flex-col">
          <DrawerHeader>
            <DrawerTitle>{isEditMode ? 'Edit transaction' : 'Create a new transaction'}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <Tabs value={transactionType} className="w-full" onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="expense">Expense</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
                <TabsTrigger value="transfer">Transfer</TabsTrigger>
              </TabsList>
              
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <TabsContent value="expense" className="space-y-4 mt-0">
                    <TransactionFormFields 
                      form={form} 
                      categories={categories || []} 
                      accounts={cashAccounts} 
                      labels={labels || []} 
                      onSplitToggle={handleSplitToggle}
                      splitSummary={isSplit ? { count: splitCount, total: allocated } : undefined}
                      onEditSplit={() => setSplitDrawerOpen(true)}
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
                    />
                  </TabsContent>
                  <TabsContent value="transfer" className="space-y-4 mt-0">
                    <TransferFormFields form={form} accounts={accounts || []} labels={labels || []} categories={categories || []} />
                  </TabsContent>

                  {/* Hidden submit button to allow Enter key submission within form fields if needed */}
                  <button type="submit" className="hidden" />
                </form>
              
            </Tabs>
          </div>
          <DrawerFooter className="border-t bg-background pt-4 pb-safe">
            <Button onClick={form.handleSubmit(onSubmit)}>Save changes</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <SplitEditorDrawer 
        open={splitDrawerOpen} 
        onOpenChange={setSplitDrawerOpen}
        form={form}
        categories={categories || []}
        labels={labels || []}
      />
    </Form>
  );
};

const TransactionFormFields = ({ 
    form, categories, accounts, labels, onSplitToggle, splitSummary, onEditSplit 
}: { 
    form: UseFormReturn<TransactionFormValues>, 
    categories: Doc<'categories'>[], 
    accounts: Doc<'accounts'>[], 
    labels: Doc<'labels'>[],
    onSplitToggle?: (checked: boolean) => void,
    splitSummary?: { count: number, total: number },
    onEditSplit?: () => void
}) => {
  const isSplit = useWatch({
    control: form.control,
    name: 'isSplit',
  });

  return (
    <>
      <FormField
        control={form.control}
        name="date"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Date</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Amount</FormLabel>
            <FormControl>
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
            <FormLabel>Account</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account._id} value={account._id}>{account.name}</SelectItem>
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
                    {categories.map(category => (
                      <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>
                    ))}
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
      )}
    </>
  );
};

const TransferFormFields = ({ form, accounts, labels, categories }: { form: UseFormReturn<TransactionFormValues>, accounts: Doc<'accounts'>[], labels: Doc<'labels'>[], categories: Doc<'categories'>[] }) => {
  const fromAccountId = useWatch({ control: form.control, name: 'accountId' });
  const toAccountId = useWatch({ control: form.control, name: 'toAccountId' });
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
  // This allows tracking both Inflow (Saving) and Outflow (Withdrawal)
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

  const amount = useWatch({ control: form.control, name: 'amount' });
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
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
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
                  <SelectItem key={account._id} value={account._id}>{account.name}</SelectItem>
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
            <FormLabel>To Account</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account._id} value={account._id}>{account.name}</SelectItem>
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
          <FormItem>
            <FormLabel>{amountLabel}</FormLabel>
            <FormControl>
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
            </FormControl>
            <FormMessage />
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
