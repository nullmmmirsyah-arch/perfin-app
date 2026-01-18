import React, { useEffect, useMemo, useState, useRef } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray, useWatch, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
  DrawerTrigger,
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
import { Calendar } from '@/components/ui/calendar';
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
import { 
  PlusCircle, 
  AlertCircle, 
  Wallet, 
  LayoutGrid, 
  CalendarDays, 
  FileText, 
  ArrowRight,
  ChevronDown,
  Tag,
  Check
} from 'lucide-react';
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

// --- Mobile Selection Drawer (Replaces Select on Mobile) ---
const MobileSelectionDrawer = ({ 
  title, 
  options, 
  value, 
  onSelect, 
  trigger,
  children
}: { 
  title: string, 
  options?: { value: string, label: React.ReactNode, subLabel?: string }[], 
  value?: string | Date, 
  onSelect?: (val: string) => void, 
  trigger: React.ReactNode,
  children?: React.ReactNode
}) => {
  const [open, setOpen] = useState(false);
  
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="z-200 max-h-[85vh]">
         <DrawerHeader className="text-left pb-2">
            <DrawerTitle>{title}</DrawerTitle>
         </DrawerHeader>
         <div className="p-4 pt-0 flex flex-col gap-2 overflow-y-auto">
            {children ? (
                <div className="flex justify-center" onClick={(e) => {
                    // For calendar, we intercept clicks to close drawer if a day is selected.
                    // This is a heuristic: if the click target is a button (day) inside the calendar
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'BUTTON' && target.getAttribute('name') === 'day') {
                         setOpen(false);
                    }
                }}>
                    {children}
                </div>
            ) : (
                options?.map((opt) => (
                    <button 
                    key={opt.value} 
                    type="button"
                    className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all active:scale-[0.98] text-left",
                        value === opt.value ? "border-primary bg-primary/5" : "border-border bg-card"
                    )}
                    onClick={() => {
                        onSelect?.(opt.value);
                        setOpen(false);
                    }}
                    >
                    <div className="flex flex-col gap-0.5">
                            <span className={cn("font-semibold text-base", value === opt.value ? "text-primary" : "text-foreground")}>{opt.label}</span>
                            {opt.subLabel && <span className="text-xs text-muted-foreground">{opt.subLabel}</span>}
                    </div>
                    {value === opt.value && <Check className="h-5 w-5 text-primary" />}
                    </button>
                ))
            )}
         </div>
         <DrawerFooter className="pt-2">
            <DrawerClose asChild>
                <Button variant="outline" className="w-full">Cancel</Button>
            </DrawerClose>
         </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// --- Main Wrapper Component ---
const TransactionDrawer = (props: TransactionDrawerProps) => {
  const isMobile = useIsMobile();
  const { open, onOpenChange, transaction } = props;
  const isEditMode = !!transaction;
  const title = isEditMode ? 'Edit transaction' : 'Create a new transaction';

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[96dvh] flex flex-col bg-background">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          
          {/* Visual Handle for Mobile */}
          <div className="pt-2 px-4 flex justify-center">
             <div className="w-12 h-1.5 bg-muted rounded-full mb-4" />
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 pb-4">
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
           <DialogTitle>{title}</DialogTitle>
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 flex flex-col h-full">
          <Tabs value={transactionType} className="w-full" onValueChange={(v) => form.setValue('type', v as any)}>
            <TabsList className={cn(
              "p-1 w-full mb-6",
              isMobile ? "bg-muted/50 rounded-full h-12 flex items-center" : "grid grid-cols-3 h-11 bg-muted/30"
            )}>
              {['expense', 'income', 'transfer'].map(t => (
                <TabsTrigger 
                  key={t} 
                  value={t} 
                  className={cn(
                    "rounded-full transition-all duration-200 font-semibold text-xs uppercase tracking-wider",
                    isMobile ? "h-10 flex-1" : "h-9",
                    // Custom active states for each tab type
                    t === 'expense' && "data-[state=active]:bg-destructive! data-[state=active]:text-destructive-foreground! shadow-sm",
                    t === 'income' && "data-[state=active]:bg-success! data-[state=active]:text-success-foreground! shadow-sm",
                    t === 'transfer' && "data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground! shadow-sm"
                  )}
                >
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="">
                <TabsContent value="expense" className="space-y-4 mt-0 outline-none">
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
                <TabsContent value="income" className="space-y-4 mt-0 outline-none">
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
                <TabsContent value="transfer" className="space-y-4 mt-0 outline-none">
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
              <div className="mt-auto pt-6 pb-2">
                <Button type="submit" size="lg" className="w-full rounded-full h-14 text-base font-semibold shadow-lg">
                    Save Transaction <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
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

const MobileInputCard = ({ 
    label, 
    icon: Icon, 
    children, 
    valueDisplay, 
    subValueDisplay,
    onClick 
}: { 
    label: string, 
    icon: React.ElementType, 
    children?: React.ReactNode, 
    valueDisplay?: string,
    subValueDisplay?: string,
    onClick?: () => void
}) => {
    // This is a visual wrapper that looks like a card.
    return (
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border relative group active:scale-[0.99] transition-transform duration-100" onClick={onClick}>
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="font-semibold text-foreground truncate text-base">
                        {valueDisplay || "Select..."}
                    </p>
                    {subValueDisplay && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">{subValueDisplay}</p>
                    )}
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground/50" />
            </div>
            {children && (
                <div className="absolute inset-0 opacity-0 cursor-pointer">
                    {children}
                </div>
            )}
        </div>
    );
};

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
  const categoryId = useWatch({ control: form.control, name: 'categoryId' });
  const labelId = useWatch({ control: form.control, name: 'labelId' });
  
  const descriptionRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const selectedAccount = accounts.find(a => a._id === accountId);
  const selectedCategory = categories.find(c => c._id === categoryId);
  const selectedLabel = labels?.find(l => l._id === labelId);

  const amountValue = parseAmount(amount);
  const balanceValue = parseAmount(selectedAccount?.balance);
  const isOverspent = (type === 'expense' || type === 'transfer') && selectedAccount && amountValue > balanceValue;

  return (
    <>
      <div className={cn(isMobile && "space-y-6")}>
          {/* AMOUNT FIELD */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem className={cn(isMobile ? "mb-2" : "")}>
                {!isMobile && <FormLabel>Amount</FormLabel>}
                <FormControl>
                  {isMobile ? (
                      <div className="relative flex flex-col items-center justify-center py-6">
                        <div className="flex items-start justify-center gap-1 text-foreground">
                            <span className="text-lg font-medium text-muted-foreground mt-2">Rp</span>
                            <Input
                                placeholder="0"
                                inputMode="numeric"
                                enterKeyHint="next"
                                className={cn(
                                    "h-auto p-0 text-6xl font-bold text-center border-none shadow-none focus-visible:ring-0 bg-transparent transition-colors w-full min-w-[100px]",
                                    isOverspent ? "text-destructive" : "text-foreground"
                                )}
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    field.onChange(formatNumber(value));
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                    }
                                }}
                            />
                        </div>
                        {isOverspent && (
                            <div className="flex items-center justify-center gap-1 mt-2 text-destructive text-xs font-medium bg-destructive/10 px-3 py-1 rounded-full">
                                <AlertCircle className="h-3 w-3" /> Insufficient Balance
                            </div>
                        )}
                        <div className="h-1 w-16 bg-primary/20 rounded-full mt-4" />
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
                    />
                  )}
                </FormControl>
                <FormMessage className={cn(isMobile && "text-center")} />
              </FormItem>
            )}
          />

          {/* CARD INPUTS FOR MOBILE */}
          {isMobile ? (
             <div className="space-y-3">
                <FormField
                    control={form.control}
                    name="accountId"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <MobileSelectionDrawer
                                    title="Select Account"
                                    value={field.value}
                                    onSelect={field.onChange}
                                    options={accounts.map(acc => ({
                                        value: acc._id,
                                        label: acc.name,
                                        subLabel: `Balance: ${formatCurrency(acc.balance)}`
                                    }))}
                                    trigger={
                                        <button type="button" className="w-full text-left outline-none">
                                            <MobileInputCard 
                                                label="Account" 
                                                icon={Wallet} 
                                                valueDisplay={selectedAccount?.name}
                                                subValueDisplay={selectedAccount ? `Balance: ${formatCurrency(selectedAccount.balance)}` : undefined}
                                            />
                                        </button>
                                    }
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <div className="flex gap-3">
                    <div className="flex-1">
                        {!isSplit ? (
                            <FormField
                                control={form.control}
                                name="categoryId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MobileSelectionDrawer
                                                title="Select Category"
                                                value={field.value}
                                                onSelect={field.onChange}
                                                options={categories.map(cat => ({
                                                    value: cat._id,
                                                    label: cat.name,
                                                    subLabel: cat.type === 'expense' && (cat.budgetLimit || 0) > 0 
                                                        ? `Available: ${formatCurrency(cat.remaining)}` 
                                                        : undefined
                                                }))}
                                                trigger={
                                                    <button type="button" className="w-full text-left outline-none">
                                                        <MobileInputCard 
                                                            label="Category" 
                                                            icon={LayoutGrid}
                                                            valueDisplay={selectedCategory?.name}
                                                            subValueDisplay={selectedCategory?.type === 'expense' && (selectedCategory.budgetLimit || 0) > 0 
                                                                ? `Avail: ${formatCurrency(selectedCategory.remaining)}` 
                                                                : undefined
                                                            }
                                                        />
                                                    </button>
                                                }
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        ) : (
                            <div 
                                className="bg-card rounded-2xl p-4 shadow-sm border border-dashed border-primary/50 relative active:scale-[0.99] transition-transform flex items-center justify-between cursor-pointer"
                                onClick={onEditSplit}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                        <LayoutGrid className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Category</p>
                                        <p className="font-semibold text-primary">Split Transaction</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{splitSummary?.count} Items • {formatCurrency(splitSummary?.total)}</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormControl>
                                    <MobileSelectionDrawer
                                        title="Select Date"
                                        trigger={
                                            <button type="button" className="w-full text-left outline-none">
                                                <MobileInputCard label="Date" icon={CalendarDays} valueDisplay={field.value ? field.value.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Pick'} />
                                            </button>
                                        }
                                    >
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={(date) => {
                                                if(date) {
                                                    field.onChange(date);
                                                }
                                            }}
                                            disabled={(date) =>
                                                date > new Date() || date < new Date("1900-01-01")
                                            }
                                            initialFocus
                                        />
                                    </MobileSelectionDrawer>
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    
                    <FormField
                        control={form.control}
                        name="labelId"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MobileSelectionDrawer
                                        title="Select Label"
                                        value={field.value}
                                        onSelect={field.onChange}
                                        options={[
                                            { value: 'none', label: 'None' },
                                            ...(labels?.map(lbl => ({
                                                value: lbl._id,
                                                label: lbl.name
                                            })) || [])
                                        ]}
                                        trigger={
                                            <button type="button" className="w-full text-left outline-none">
                                                <MobileInputCard label="Label" icon={Tag} valueDisplay={selectedLabel?.name || "None"} />
                                            </button>
                                        }
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-1">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Note</p>
                                    <Textarea 
                                        placeholder="Write a note..." 
                                        className="min-h-[60px] border-none shadow-none resize-none p-0 focus-visible:ring-0 text-base" 
                                        enterKeyHint="done"
                                        {...field}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                />
                
                {/* Split Toggle Button */}
                <div 
                    className="flex items-center justify-center gap-2 py-2 cursor-pointer text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => onSplitToggle?.(!isSplit)}
                >
                    {isSplit ? (
                        <span className="text-sm font-medium">Revert to Single Category</span>
                    ) : (
                        <>
                            <PlusCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Split Transaction</span>
                        </>
                    )}
                </div>

             </div>
          ) : (
             // DESKTOP LAYOUT (Standard)
             <>
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
                
                {/* ... (Existing Desktop Fields Logic for Category, Date, etc.) ... */}
                {/* Reusing existing logic blocks inside standard layout */}
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

                <div className="grid grid-cols-2 gap-4">
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
                </div>

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
             </>
          )}
      </div>
    </>
  );
};

const TransferFormFields = ({ form, accounts, labels, categories, isMobile }: { form: UseFormReturn<TransactionFormValues>, accounts: Doc<'accounts'>[], labels: Doc<'labels'>[], categories: CategoryOption[], isMobile?: boolean }) => {
  // Transfer form fields logic remains largely the same, but we can apply the card style here too if needed.
  // For brevity, I'll apply the same MobileInputCard pattern here.
  
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
        name="amount"
        render={({ field }) => (
          <FormItem className={cn(isMobile && "mb-8")}>
            <FormLabel className={cn(isMobile && "text-center block text-muted-foreground uppercase text-[10px] font-bold tracking-widest")}>
              {amountLabel}
            </FormLabel>
            <FormControl>
              {isMobile ? (
                  <div className="relative group">
                    <div className="flex items-start justify-center gap-1 text-foreground">
                        <span className="text-lg font-medium text-muted-foreground mt-2">Rp</span>
                        <Input
                            placeholder="0"
                            inputMode="numeric"
                            enterKeyHint="next"
                            className={cn(
                                "h-auto p-0 text-6xl font-bold text-center border-none shadow-none focus-visible:ring-0 bg-transparent transition-colors w-full min-w-[100px]",
                                isOverspent ? "text-destructive" : "text-foreground"
                            )}
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(formatNumber(value));
                            }}
                        />
                    </div>
                    {isOverspent && (
                        <div className="flex items-center justify-center gap-1 mt-2 text-destructive text-xs font-medium bg-destructive/10 px-3 py-1 rounded-full">
                            <AlertCircle className="h-3 w-3" /> Insufficient Balance
                        </div>
                    )}
                    <div className="h-1 w-16 bg-primary/20 rounded-full mt-4 mx-auto" />
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
                />
              )}
            </FormControl>
            <FormMessage className={cn(isMobile && "text-center")} />
          </FormItem>
        )}
      />

      {isMobile ? (
          <div className="space-y-3">
             <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <MobileSelectionDrawer
                                title="From Account"
                                value={field.value}
                                onSelect={field.onChange}
                                options={accounts.map(acc => ({
                                    value: acc._id,
                                    label: acc.name,
                                    subLabel: `Balance: ${formatCurrency(acc.balance)}`
                                }))}
                                trigger={
                                    <button type="button" className="w-full text-left outline-none">
                                        <MobileInputCard 
                                            label="From Account" 
                                            icon={Wallet} 
                                            valueDisplay={fromAccount?.name}
                                            subValueDisplay={fromAccount ? `Balance: ${formatCurrency(fromAccount.balance)}` : undefined}
                                        />
                                    </button>
                                }
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="toAccountId"
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <MobileSelectionDrawer
                                title="To Account"
                                value={field.value}
                                onSelect={field.onChange}
                                options={accounts.map(acc => ({
                                    value: acc._id,
                                    label: acc.name,
                                    subLabel: `Balance: ${formatCurrency(acc.balance)}`
                                }))}
                                trigger={
                                    <button type="button" className="w-full text-left outline-none">
                                        <MobileInputCard 
                                            label="To Account" 
                                            icon={ArrowRight} 
                                            valueDisplay={toAccount?.name}
                                            subValueDisplay={toAccount ? `Balance: ${formatCurrency(toAccount.balance)}` : undefined}
                                        />
                                    </button>
                                }
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <div className="grid grid-cols-2 gap-3">
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <div className="relative">
                            <button type="button" className="w-full text-left outline-none">
                                <MobileInputCard label="Date" icon={CalendarDays} valueDisplay={field.value ? field.value.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Pick'} />
                            </button>
                            <div className="opacity-0 absolute inset-0 overflow-hidden">
                                <DatePicker date={field.value} setDate={field.onChange} />
                            </div>
                        </div>
                    )}
                />
                
                {showCategory && (
                    <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MobileSelectionDrawer
                                        title="Category"
                                        value={field.value}
                                        onSelect={field.onChange}
                                        options={categories.map(cat => ({
                                            value: cat._id,
                                            label: cat.name,
                                            subLabel: linkedCategory?.name === cat.name ? '(Linked)' : undefined
                                        }))}
                                        trigger={
                                            <button type="button" className="w-full text-left outline-none">
                                                <MobileInputCard label="Category" icon={LayoutGrid} valueDisplay={linkedCategory?.name || "Select"} />
                                            </button>
                                        }
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                )}
            </div>

            {isAssetTransaction && (
                <FormField
                    control={form.control}
                    name="assetDetails.quantity"
                    render={({ field }) => (
                        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                    <Tag className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Quantity/Weight</p>
                                    <Input 
                                        type="number" 
                                        step="any" 
                                        placeholder="0.00" 
                                        className="h-auto p-0 border-none shadow-none text-lg font-semibold focus-visible:ring-0" 
                                        {...field}
                                    />
                                    {parsedAmount > 0 && parsedQuantity > 0 && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            @ {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(impliedPrice)} / unit
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                />
            )}

            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-1">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Note</p>
                                <Textarea 
                                    placeholder="Write a note..." 
                                    className="min-h-[60px] border-none shadow-none resize-none p-0 focus-visible:ring-0 text-base" 
                                    enterKeyHint="done"
                                    {...field}
                                />
                            </div>
                        </div>
                    </div>
                )}
            />
          </div>
      ) : (
          <div className="grid grid-cols-2 gap-4">
             <FormField control={form.control} name="accountId" render={({ field }) => (
                <FormItem><FormLabel>From</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="From" /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}</SelectContent></Select></FormItem>
             )} />
             <FormField control={form.control} name="toAccountId" render={({ field }) => (
                <FormItem><FormLabel>To</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="To" /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}</SelectContent></Select></FormItem>
             )} />
          </div>
      )}
    </>
  );
};

export default TransactionDrawer;